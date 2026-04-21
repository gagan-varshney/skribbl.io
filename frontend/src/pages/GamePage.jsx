import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { getStoredPlayerId, getStoredPlayerName } from "../utils/storage";
import CanvasBoard from "../components/CanvasBoard";
import ChatBox from "../components/ChatBox";
import Notification from "../components/Notification";
import logogif from "../img/logo.gif";

export default function GamePage() {
  const { roomCode } = useParams();
  const code = String(roomCode || "").toUpperCase();
  const socket = useSocket();
  const navigate = useNavigate();

  const playerId = useMemo(() => getStoredPlayerId(), []);
  const playerName = useMemo(() => getStoredPlayerName() || "Player", []);

  const [roomState, setRoomState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [wordChoices, setWordChoices] = useState([]);
  const [maskedWord, setMaskedWord] = useState("Waiting...");
  const [roundResult, setRoundResult] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(100);
  const [hotkeys, setHotkeys] = useState({
    brush: "B",
    fill: "F",
    undo: "U",
    clear: "C",
    swap: "S"
  });
  const [miscSettings, setMiscSettings] = useState({
    mobileKeyboard: "Disabled",
    keyboardLayout: "English",
    chatInputLayout: "Bottom",
    pressureSensitivity: "On",
    chatBubbles: "Enabled"
  });

  const players = roomState?.players || [];
  const me = players.find((p) => p.id === playerId);
  const canDraw = roomState?.game?.currentDrawerId === playerId;
  const drawer = players.find((p) => p.id === roomState?.game?.currentDrawerId);
  const canGuess = !canDraw && !me?.isSpectator;
  const leaderboard = roomState?.game?.leaderboard || [];

  useEffect(() => {
    socket.emit("join_room", { roomCode: code, name: playerName, playerId }, (res) => {
      if (!res?.ok) {
        setNotification(`Unable to join room: ${res?.reason || "unknown"}`);
        return;
      }
      setRoomState(res.roomState);
      if (res.roomState?.game?.wordDisplay) {
        setMaskedWord(res.roomState.game.wordDisplay);
      }
    });

    const onRoomState = (state) => {
      setRoomState(state);
      if (state?.game?.wordDisplay) {
        setMaskedWord(state.game.wordDisplay);
      }
    };
    const onRoundStart = () => {
      setRoundResult(null);
      setWordChoices([]);
    };
    const onWordChoices = ({ choices }) => setWordChoices(choices || []);
    const onWordChosen = ({ wordDisplay }) => setMaskedWord(wordDisplay);
    const onHintUpdate = ({ maskedWord: hintWord }) => setMaskedWord(hintWord);
    const onTimer = ({ remainingTime }) => {
      setRoomState((prev) => ({
        ...prev,
        game: {
          ...(prev?.game || {}),
          remainingTime
        }
      }));
    };
    const onChatMessage = (msg) => setMessages((prev) => [...prev.slice(-99), msg]);
    const onPlayerJoined = ({ player, reconnected }) => {
      setMessages((prev) => {
        // Prevent duplicates by checking if this player message already exists
        const isDuplicate = prev.some(
          (msg) =>
            msg.playerId === player.id &&
            (msg.message?.includes(player.name) ||
              Date.now() - (msg.timestamp || 0) < 100)
        );

        if (isDuplicate) return prev;

        const message = {
          type: "system",
          message: reconnected
            ? `${player.name} reconnected`
            : `${player.name} joined the game`,
          timestamp: Date.now(),
          playerId: player.id
        };
        return [...prev.slice(-99), message];
      });
    };
    const onRoundEnd = (payload) => setRoundResult(payload);
    const onGameOver = (payload) => setGameOver(payload);

    socket.on("room_state", onRoomState);
    socket.on("round_start", onRoundStart);
    socket.on("word_choices", onWordChoices);
    socket.on("word_chosen", onWordChosen);
    socket.on("hint_update", onHintUpdate);
    socket.on("timer_update", onTimer);
    socket.on("chat_message", onChatMessage);
    socket.on("player_joined", onPlayerJoined);
    socket.on("round_end", onRoundEnd);
    socket.on("game_over", onGameOver);

    return () => {
      socket.off("room_state", onRoomState);
      socket.off("round_start", onRoundStart);
      socket.off("word_choices", onWordChoices);
      socket.off("word_chosen", onWordChosen);
      socket.off("hint_update", onHintUpdate);
      socket.off("timer_update", onTimer);
      socket.off("chat_message", onChatMessage);
      socket.off("player_joined", onPlayerJoined);
      socket.off("round_end", onRoundEnd);
      socket.off("game_over", onGameOver);
    };
  }, [code, playerId, playerName, socket]);

  const sendChat = (text) => socket.emit("chat", { message: text });
  const sendGuess = (text) => socket.emit("guess", { text });

  const chooseWord = (word) => {
    socket.emit("word_chosen", { word }, (res) => {
      if (!res?.ok) {
        setNotification("Word selection failed.");
      }
    });
    setWordChoices([]);
  };

  const updateHotkey = (key, value) => {
    const clean = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 1);
    setHotkeys((prev) => ({ ...prev, [key]: clean }));
  };

  const resetHotkeys = () => {
    setHotkeys({
      brush: "B",
      fill: "F",
      undo: "U",
      clear: "C",
      swap: "S"
    });
  };

  return (
    <div className="page page-game game-classic">
      <div className="game-classic-wrap">
        <div className="game-logo-row">
          <h1 className="logo-word game-logo-small">
            <img src={logogif} alt="logo"
            className="cursor-pointer hover:scale-105 transition"
            onClick={() => navigate("/")} />
          </h1>
        </div>

        <header className="game-classic-topbar">
          <div className="classic-top-left">
            <span className="timer-badge">{roomState?.game?.remainingTime || 0}</span>
            <span>
              Round {roomState?.game?.currentRound || 1} of {roomState?.game?.totalRounds || 1}
            </span>
          </div>
          <div className="classic-top-center">
            <div className="classic-word-label">{canDraw ? "DRAW THIS" : "GUESS THE WORD"}</div>
            <div className="classic-word-value">{maskedWord || "_ _ _ _"}</div>
          </div>
          <button className="classic-top-right settings-btn" onClick={() => setShowSettings(true)} type="button">
            ⚙
          </button>
        </header>

        <div className="game-classic-body">
          <aside className="game-classic-left">
            <ul className="classic-rank-list">
              {leaderboard.map((entry, idx) => (
                <li key={entry.id}>
                  <span className="rank-no">#{idx + 1}</span>
                  <div className="rank-meta">
                    <strong>
                      {entry.name}
                      {entry.id === playerId ? " (You)" : ""}
                    </strong>
                    <span>{entry.score} points</span>
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          <main className="game-classic-center">
            <CanvasBoard socket={socket} canDraw={Boolean(canDraw)} classic />
            {wordChoices.length > 0 && (
              <div className="choices-modal classic-choices-modal">
                <h3>Pick a word</h3>
                <div className="choices-row">
                  {wordChoices.map((word) => (
                    <button key={word} className="btn" onClick={() => chooseWord(word)}>
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </main>

          <aside className="game-classic-right">
            <ChatBox
              messages={messages}
              canGuess={canGuess}
              onSendChat={sendChat}
              onSendGuess={sendGuess}
              classic
            />
          </aside>
        </div>
      </div>

      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <section className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header-row">
              <h3>Settings</h3>
              <button className="settings-close" onClick={() => setShowSettings(false)} type="button">
                ×
              </button>
            </div>

            <div className="settings-section">
              <h4>Volume {volume}%</h4>
              <input
                className="settings-range"
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
            </div>

            <div className="settings-section">
              <div className="settings-subheader">
                <h4>Hotkeys</h4>
                <button className="btn btn-mini" onClick={resetHotkeys} type="button">
                  Reset
                </button>
              </div>
              <div className="hotkeys-grid">
                <label>
                  Brush
                  <input value={hotkeys.brush} onChange={(e) => updateHotkey("brush", e.target.value)} />
                </label>
                <label>
                  Fill
                  <input value={hotkeys.fill} onChange={(e) => updateHotkey("fill", e.target.value)} />
                </label>
                <label>
                  Undo
                  <input value={hotkeys.undo} onChange={(e) => updateHotkey("undo", e.target.value)} />
                </label>
                <label>
                  Clear
                  <input value={hotkeys.clear} onChange={(e) => updateHotkey("clear", e.target.value)} />
                </label>
                <label>
                  Swap
                  <input value={hotkeys.swap} onChange={(e) => updateHotkey("swap", e.target.value)} />
                </label>
              </div>
            </div>

            <div className="settings-section">
              <h4>Miscellaneous</h4>
              <div className="misc-grid">
                <label>
                  Mobile Keyboard (Experimental)
                  <select
                    value={miscSettings.mobileKeyboard}
                    onChange={(e) => setMiscSettings((prev) => ({ ...prev, mobileKeyboard: e.target.value }))}
                  >
                    <option>Disabled</option>
                    <option>Enabled</option>
                  </select>
                </label>
                <label>
                  Mobile Keyboard Language Layout
                  <select
                    value={miscSettings.keyboardLayout}
                    onChange={(e) => setMiscSettings((prev) => ({ ...prev, keyboardLayout: e.target.value }))}
                  >
                    <option>English</option>
                    <option>Spanish</option>
                  </select>
                </label>
                <label>
                  Mobile Chat Input Layout
                  <select
                    value={miscSettings.chatInputLayout}
                    onChange={(e) => setMiscSettings((prev) => ({ ...prev, chatInputLayout: e.target.value }))}
                  >
                    <option>Bottom</option>
                    <option>Top</option>
                  </select>
                </label>
                <label>
                  Brush Pressure Sensitivity
                  <select
                    value={miscSettings.pressureSensitivity}
                    onChange={(e) => setMiscSettings((prev) => ({ ...prev, pressureSensitivity: e.target.value }))}
                  >
                    <option>On</option>
                    <option>Off</option>
                  </select>
                </label>
                <label>
                  Mobile Chat Bubbles (chat messages on drawing board)
                  <select
                    value={miscSettings.chatBubbles}
                    onChange={(e) => setMiscSettings((prev) => ({ ...prev, chatBubbles: e.target.value }))}
                  >
                    <option>Enabled</option>
                    <option>Disabled</option>
                  </select>
                </label>
              </div>
            </div>
          </section>
        </div>
      )}

      {roundResult && (
        <div className="overlay panel">
          <h3>Round End</h3>
          <p>Word was: {roundResult.word}</p>
          <ul className="score-list">
            {(roundResult.scores || []).map((entry) => (
              <li key={entry.id}>
                <span>{entry.name}</span>
                <strong>{entry.score}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gameOver && (
        <div className="overlay panel">
          <h3>Game Over</h3>
          <ul className="score-list">
            {(gameOver.scores || []).map((entry) => (
              <li key={entry.id}>
                <span>{entry.name}</span>
                <strong>{entry.score}</strong>
              </li>
            ))}
          </ul>
          <button className="btn btn-primary" onClick={() => navigate(`/lobby/${code}`)}>
            Back to Lobby
          </button>
        </div>
      )}

      <Notification message={notification} onClose={() => setNotification(null)} />
    </div>
  );
}
