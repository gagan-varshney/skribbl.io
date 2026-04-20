import { useEffect, useRef, useState } from "react";

const CLASSIC_COLORS = [
  "#000000",
  "#ffffff",
  "#ff0000",
  "#ff7f00",
  "#ffd400",
  "#0ca70c",
  "#1ec7b6",
  "#1e5ce0",
  "#2b217b",
  "#8511c2",
  "#f08ad3",
  "#c86f50",
  "#7e401e"
];

function drawSegment(ctx, segment) {
  if (!ctx || !segment) return;

  if (segment.type === "clear") {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

  const isErase = segment.tool === "eraser";
  ctx.globalCompositeOperation = isErase ? "destination-out" : "source-over";
  ctx.strokeStyle = segment.color || "#111111";
  ctx.lineWidth = Number(segment.size || 5);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (segment.type === "start") {
    ctx.beginPath();
    ctx.arc(segment.x, segment.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = isErase ? "rgba(0,0,0,1)" : ctx.strokeStyle;
    ctx.fill();
    return;
  }

  if (segment.type === "move") {
    ctx.beginPath();
    ctx.moveTo(segment.fromX, segment.fromY);
    ctx.lineTo(segment.toX, segment.toY);
    ctx.stroke();
  }
}

export default function CanvasBoard({ socket, canDraw, classic = false }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const strokeIdRef = useRef(null);
  const segmentsRef = useRef([]);

  const [tool, setTool] = useState("brush");
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(5);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const redraw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const segment of segmentsRef.current) {
        drawSegment(ctx, segment);
      }
    };

    const onDrawData = (segment) => {
      if (segment.type === "clear") {
        segmentsRef.current = [];
        redraw();
        return;
      }
      if (segment.type === "undo") {
        const strokeId = segment.strokeId || [...segmentsRef.current].reverse().find((s) => s.strokeId)?.strokeId;
        if (strokeId) {
          segmentsRef.current = segmentsRef.current.filter((s) => s.strokeId !== strokeId);
        }
        redraw();
        return;
      }
      segmentsRef.current.push(segment);
      drawSegment(ctx, segment);
    };

    socket.on("draw_data", onDrawData);
    return () => socket.off("draw_data", onDrawData);
  }, [socket]);

  const getPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const handlePointerDown = (event) => {
    if (!canDraw) return;
    const point = getPoint(event);
    drawingRef.current = true;
    lastPointRef.current = point;
    strokeIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const segment = { type: "start", x: point.x, y: point.y, color, size, tool, strokeId: strokeIdRef.current };
    segmentsRef.current.push(segment);
    drawSegment(canvasRef.current.getContext("2d"), segment);
    socket.emit("draw_start", segment);
  };

  const handlePointerMove = (event) => {
    if (!canDraw || !drawingRef.current || !lastPointRef.current) return;
    const point = getPoint(event);
    const segment = {
      type: "move",
      fromX: lastPointRef.current.x,
      fromY: lastPointRef.current.y,
      toX: point.x,
      toY: point.y,
      color,
      size,
      tool,
      strokeId: strokeIdRef.current
    };

    segmentsRef.current.push(segment);
    drawSegment(canvasRef.current.getContext("2d"), segment);
    socket.emit("draw_move", segment);
    lastPointRef.current = point;
  };

  const endStroke = () => {
    if (!drawingRef.current || !canDraw) return;
    drawingRef.current = false;
    socket.emit("draw_end", { strokeId: strokeIdRef.current, tool, color, size });
    strokeIdRef.current = null;
  };

  const clearCanvas = () => {
    if (!canDraw) return;
    segmentsRef.current = [];
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socket.emit("clear_canvas");
  };

  const undo = () => {
    if (!canDraw) return;
    const lastStroke = [...segmentsRef.current].reverse().find((s) => s.strokeId)?.strokeId;
    if (!lastStroke) return;
    segmentsRef.current = segmentsRef.current.filter((s) => s.strokeId !== lastStroke);
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    for (const segment of segmentsRef.current) drawSegment(ctx, segment);
    socket.emit("undo_stroke");
  };

  return (
    <div className={`canvas-wrap ${classic ? "canvas-wrap-classic" : ""}`}>
      <canvas
        ref={canvasRef}
        className="draw-canvas"
        width={900}
        height={520}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
      />

      {classic ? (
        <div className="toolbar-classic">
          <div className="classic-colors">
            {CLASSIC_COLORS.map((c) => (
              <button
                key={c}
                className={`classic-color-swatch ${color === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                disabled={!canDraw}
                type="button"
              />
            ))}
          </div>
          <div className="classic-sizes">
            {[4, 8, 14].map((s) => (
              <button
                key={s}
                className={`size-dot-btn ${size === s ? "active" : ""}`}
                onClick={() => setSize(s)}
                disabled={!canDraw}
                type="button"
              >
                <span style={{ width: s, height: s }} />
              </button>
            ))}
          </div>
          <div className="classic-tools">
            <button
              className={`classic-tool-btn ${tool === "brush" ? "active" : ""}`}
              onClick={() => setTool("brush")}
              disabled={!canDraw}
              type="button"
            >
              B
            </button>
            <button
              className={`classic-tool-btn ${tool === "eraser" ? "active" : ""}`}
              onClick={() => setTool("eraser")}
              disabled={!canDraw}
              type="button"
            >
              E
            </button>
            <button className="classic-tool-btn" onClick={undo} disabled={!canDraw} type="button">
              U
            </button>
            <button className="classic-tool-btn" onClick={clearCanvas} disabled={!canDraw} type="button">
              C
            </button>
          </div>
        </div>
      ) : (
        <div className="toolbar">
          <button className="btn btn-mini" onClick={() => setTool("brush")}>
            Brush
          </button>
          <button className="btn btn-mini" onClick={() => setTool("eraser")}>
            Eraser
          </button>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={!canDraw} />
          <input
            type="range"
            min={1}
            max={24}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            disabled={!canDraw}
          />
          <button className="btn btn-mini" onClick={undo} disabled={!canDraw}>
            Undo
          </button>
          <button className="btn btn-mini" onClick={clearCanvas} disabled={!canDraw}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
