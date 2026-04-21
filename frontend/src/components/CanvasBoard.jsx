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

function drawSegment(ctx, segment, scale = 1) {
  if (!ctx || !segment) return;

  if (segment.type === "clear") {
    const canvas = ctx.canvas;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || 900;
    const displayHeight = rect.height || 520;
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    return;
  }

  const isErase = segment.tool === "eraser";
  ctx.globalCompositeOperation = isErase ? "destination-out" : "source-over";
  ctx.strokeStyle = segment.color || "#111111";
  
  // Scale the brush size based on display scale
  ctx.lineWidth = Number(segment.size || 5) / scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (segment.type === "start") {
    // Convert logical coordinates back to display space
    const displayX = segment.x / scale;
    const displayY = segment.y / scale;
    ctx.beginPath();
    ctx.arc(displayX, displayY, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = isErase ? "rgba(0,0,0,1)" : ctx.strokeStyle;
    ctx.fill();
    return;
  }

  if (segment.type === "move") {
    // Convert logical coordinates back to display space
    const displayFromX = segment.fromX / scale;
    const displayFromY = segment.fromY / scale;
    const displayToX = segment.toX / scale;
    const displayToY = segment.toY / scale;
    
    ctx.beginPath();
    ctx.moveTo(displayFromX, displayFromY);
    ctx.lineTo(displayToX, displayToY);
    ctx.stroke();
  }
}

export default function CanvasBoard({ socket, canDraw, classic = false }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const strokeIdRef = useRef(null);
  const segmentsRef = useRef([]);
  const dprRef = useRef(window.devicePixelRatio || 1);
  const scaleRef = useRef(1); // Scale factor for normalizing coordinates

  const [tool, setTool] = useState("brush");
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(5);

  // Fixed logical canvas dimensions for consistent drawing across devices
  const LOGICAL_WIDTH = 900;
  const LOGICAL_HEIGHT = 520;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || 900;
    const displayHeight = rect.height || 520;
    
    // Calculate scale factor to map display coordinates to logical canvas
    scaleRef.current = LOGICAL_WIDTH / displayWidth;
    
    // Set physical canvas size for high DPI rendering
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = displayWidth + "px";
    canvas.style.height = displayHeight + "px";

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, displayWidth, displayHeight);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const redraw = () => {
      const rect = canvas.getBoundingClientRect();
      const displayWidth = rect.width || 900;
      const displayHeight = rect.height || 520;
      const scale = scaleRef.current;
      
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      for (const segment of segmentsRef.current) {
        drawSegment(ctx, segment, scale);
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
      const scale = scaleRef.current;
      drawSegment(ctx, segment, scale);
    };

    socket.on("draw_data", onDrawData);
    return () => socket.off("draw_data", onDrawData);
  }, [socket]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    
    // Support both pointer and touch events
    const clientX = event.clientX ?? (event.touches?.[0]?.clientX);
    const clientY = event.clientY ?? (event.touches?.[0]?.clientY);
    
    if (clientX === undefined || clientY === undefined) {
      return null;
    }
    
    // Calculate coordinates relative to canvas display position
    const displayX = clientX - rect.left;
    const displayY = clientY - rect.top;
    
    // Normalize to logical canvas space (0-900, 0-520) for consistent drawing
    const scale = scaleRef.current;
    return {
      x: displayX * scale,
      y: displayY * scale
    };
  };

  const handlePointerDown = (event) => {
    if (!canDraw) return;
    event.preventDefault();
    
    const point = getPoint(event);
    if (!point) return;
    
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
    event.preventDefault();
    
    const point = getPoint(event);
    if (!point) return;
    
    // Calculate distance for smoother drawing
    const distance = Math.sqrt(
      Math.pow(point.x - lastPointRef.current.x, 2) + 
      Math.pow(point.y - lastPointRef.current.y, 2)
    );
    
    // Lower threshold for more responsive drawing (0.5 pixels)
    if (distance < 0.5) return;
    
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
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || 900;
    const displayHeight = rect.height || 520;
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    socket.emit("clear_canvas");
  };

  const undo = () => {
    if (!canDraw) return;
    const lastStroke = [...segmentsRef.current].reverse().find((s) => s.strokeId)?.strokeId;
    if (!lastStroke) return;
    segmentsRef.current = segmentsRef.current.filter((s) => s.strokeId !== lastStroke);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || 900;
    const displayHeight = rect.height || 520;
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    for (const segment of segmentsRef.current) drawSegment(ctx, segment);
    socket.emit("undo_stroke");
  };

  return (
    <div className={`canvas-wrap ${classic ? "canvas-wrap-classic" : ""}`}>
      <canvas
        ref={canvasRef}
        className="draw-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={endStroke}
        style={{ width: "100%", height: "100%", display: "block" }}
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
