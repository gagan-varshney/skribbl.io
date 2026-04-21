import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { getStoredPlayerId, getStoredPlayerName, setStoredPlayerId } from "../utils/storage";
import PlayerList from "../components/PlayerList";
import Notification from "../components/Notification";
import img from "../img/logo.gif";

export default function LobbyPage() {
  const { roomCode } = useParams();
  const code = String(roomCode || "").toUpperCase();
  const socket = useSocket();
  const navigate = useNavigate();
  const [roomState, setRoomState] = useState(null);
  const [error, setError] = useState("");
  const [customWordsText, setCustomWordsText] = useState("");
  const [notification, setNotification] = useState(null);
  const [messages, setMessages] = useState([]);

  const playerId = useMemo(() => getStoredPlayerId(), []);

  const formatStartError = (reason) => {
    if (reason === "min_players") {
      return "You need at least 2 players to start the game.";
    }
    if (reason === "not_allowed") {
      return "Only the room host can start the game.";
    }
    return `Cannot start game: ${reason || "unknown"}`;
  };
  const playerName = useMemo(() => getStoredPlayerName() || "Player", []);

  const myPlayer = roomState?.players?.find((p) => p.id === playerId);
  const isHost = myPlayer?.isHost;

  useEffect(() => {
    socket.emit("join_room", { roomCode: code, name: playerName, playerId }, (res) => {
      if (!res?.ok) {
        setNotification(`Unable to join room: ${res?.reason || "unknown"}`);
        return;
      }
      setStoredPlayerId(res.playerId);
      setRoomState(res.roomState);
    });

    const onRoomState = (state) => {
      setRoomState(state);
      setCustomWordsText(state?.settings?.customWords?.join(", ") || "");
    };
    const onStartGame = () => navigate(`/game/${code}`);
    const onKicked = () => {
      setNotification("You were kicked from the room.");
      navigate("/");
    };
    const onBanned = () => {
      setNotification("You were banned from the room.");
      navigate("/");
    };
    const onPlayerJoined = ({ player, reconnected }) => {
      setMessages((prev) => {
        // Prevent duplicates by checking if this player message already exists
        const messageId = `${player.id}-${Date.now()}`;
        const isDuplicate = prev.some(
          (msg) =>
            msg.playerId === player.id &&
            (msg.text.includes(player.name) ||
              Date.now() - (msg.timestamp || 0) < 100)
        );

        if (isDuplicate) return prev;

        const message = {
          type: "system",
          text: reconnected
            ? `${player.name} reconnected`
            : `${player.name} joined the room`,
          timestamp: Date.now(),
          playerId: player.id,
          messageId
        };
        return [...prev.slice(-19), message];
      });
    };

    socket.on("room_state", onRoomState);
    socket.on("start_game", onStartGame);
    socket.on("kicked", onKicked);
    socket.on("banned", onBanned);
    socket.on("player_joined", onPlayerJoined);

    return () => {
      socket.off("room_state", onRoomState);
      socket.off("start_game", onStartGame);
      socket.off("kicked", onKicked);
      socket.off("banned", onBanned);
      socket.off("player_joined", onPlayerJoined);
    };
  }, [code, navigate, playerId, playerName, socket]);

  useEffect(() => {
    if (error && roomState?.players?.length >= 2) {
      setError("");
    }
  }, [error, roomState]);

  const startGame = () => {
    setError("");
    socket.emit("start_game", null, (res) => {
      if (!res?.ok) {
        const message = formatStartError(res?.reason);
        setNotification(message);
        setError(message);
      }
    });
  };

  const toggleReady = () => {
    socket.emit("toggle_ready");
  };

  const updateSetting = (key, value) => {
    if (!isHost) return;
    socket.emit("update_setting", { key, value });
  };

  const inviteLink = `${window.location.origin}/?room=${code}`;
  const players = roomState?.players || [];

  return (
    <div className="page page-lobby lobby-classic">
      <div className="lobby-wrap">
        <div className="logo-word game-logo-small">
          <img src={img} alt="logo" className="cursor-pointer hover:scale-105 transition"
            onClick={() => navigate("/")} />

        </div>
        <header className="lobby-topbar">
          <div className="top-left">Round 1 of {roomState?.settings?.rounds || 3}</div>
          <div className="top-center">WAITING</div>
          <div className="top-right">Room {code}</div>
        </header>

        <div className="lobby-body">
          <aside className="lobby-left">
            <div className="lobby-player-title">Players</div>
            <PlayerList
              players={players}
              hostPlayerId={roomState?.hostPlayerId}
              selfId={playerId}
              showControls={isHost}
              onKick={(targetId) => socket.emit("kick_player", { playerId: targetId })}
              onBan={(targetId) => socket.emit("ban_player", { playerId: targetId })}
            />
            <button className="btn btn-mini" onClick={toggleReady}>
              Ready
            </button>
          </aside>

          <main className="lobby-center">
            <div className="classic-settings-row">
              <label>Players</label>
              <select value={roomState?.settings?.maxPlayers || 8} onChange={(e) => updateSetting("maxPlayers", Number(e.target.value))} disabled={!isHost}>
                {Array.from({ length: 19 }, (_, i) => i + 2).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
            <div className="classic-settings-row">
              <label>Language</label>
              <select value={roomState?.settings?.language || "en"} onChange={(e) => updateSetting("language", e.target.value)} disabled={!isHost}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </div>
            <div className="classic-settings-row">
              <label>Drawtime</label>
              <select value={roomState?.settings?.drawTime || 80} onChange={(e) => updateSetting("drawTime", Number(e.target.value))} disabled={!isHost}>
                {[15, 30, 45, 60, 75, 80, 90, 105, 120, 135, 150, 180, 210, 240].map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
            <div className="classic-settings-row">
              <label>Rounds</label>
              <select value={roomState?.settings?.rounds || 3} onChange={(e) => updateSetting("rounds", Number(e.target.value))} disabled={!isHost}>
                {Array.from({ length: 9 }, (_, i) => i + 2).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
            <div className="classic-settings-row">
              <label>Game Mode</label>
              <select value={roomState?.settings?.wordMode || "normal"} onChange={(e) => updateSetting("wordMode", e.target.value)} disabled={!isHost}>
                <option value="normal">Normal</option>
                <option value="hidden">Hidden</option>
                <option value="combination">Combination</option>
              </select>
            </div>
            <div className="classic-settings-row">
              <label>Word Count</label>
              <select value={roomState?.settings?.wordChoicesCount || 3} onChange={(e) => updateSetting("wordChoicesCount", Number(e.target.value))} disabled={!isHost}>
                {Array.from({ length: 5 }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
            <div className="classic-settings-row">
              <label>Hints</label>
              <select value={roomState?.settings?.hintsCount || 2} onChange={(e) => updateSetting("hintsCount", Number(e.target.value))} disabled={!isHost}>
                {Array.from({ length: 9 }, (_, i) => i).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            <div className="classic-custom-label">Custom words</div>
            <textarea
              className="classic-custom-area"
              value={roomState?.settings?.customWords?.join(", ") || ""}
              readOnly
              placeholder="Minimum of 10 words. 1-32 characters per word. Separated by a comma."
            />

            <div className="classic-actions-row">
              {isHost ? (
                <button className="btn classic-start-btn" onClick={startGame}>
                  Start!
                </button>
              ) : (
                <button className="btn classic-start-btn" disabled>
                  Waiting for host...
                </button>
              )}
              <button className="btn classic-invite-btn" onClick={() => navigator.clipboard.writeText(inviteLink)}>
                Invite
              </button>
            </div>
          </main>

          <aside className="lobby-right">
            <div className="lobby-feed">
              {messages.length > 0 ? (
                messages.map((msg, idx) => (
                  <p key={idx} className="lobby-feed-system">
                    {msg.text}
                  </p>
                ))
              ) : (
                <p className="lobby-feed-system">
                  {myPlayer?.name || "Player"} is now {isHost ? "the room owner" : "in the room"}.
                </p>
              )}
              {error && (
                <p className="lobby-feed-system lobby-feed-error">{error}</p>
              )}
            </div>
            <input className="lobby-guess-placeholder" disabled placeholder="Type your guess here..." />
          </aside>
        </div>
      </div>

      <Notification message={notification} onClose={() => setNotification(null)} />
    </div>
  );
}
