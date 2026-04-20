import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { getStoredPlayerId, getStoredPlayerName, setStoredPlayerId, setStoredPlayerName } from "../utils/storage";
import logoGif from "../img/logo.gif";
import Notification from "../components/Notification";

export default function HomePage() {
  const socket = useSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState(getStoredPlayerName() || "");
  const [language, setLanguage] = useState("en");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState("idle");
  const [spectator, setSpectator] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [notification, setNotification] = useState(null);

  const playerId = useMemo(() => getStoredPlayerId(), []);

  // Handle direct room join via URL parameter
  useEffect(() => {
    const roomCode = searchParams.get("room");
    const storedName = getStoredPlayerName();

    if (roomCode && storedName) {
      const cleanCode = roomCode.trim().toUpperCase();
      socket.emit(
        "join_room",
        {
          name: storedName,
          roomCode: cleanCode,
          playerId,
          spectator: false
        },
        (res) => {
          if (!res?.ok) {
            setNotification(`Join failed: ${res?.reason || "unknown"}`);
            return;
          }
          setStoredPlayerId(res.playerId);
          navigate(`/lobby/${cleanCode}`);
        }
      );
    }
  }, [searchParams, socket, playerId, navigate]);

  const validateName = () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setNotification("Please enter your name first.");
      return null;
    }
    setStoredPlayerName(cleanName);
    setNotification(null);
    return cleanName;
  };

  const handleCreate = (usePrivateRoom) => {
    const cleanName = validateName();
    if (!cleanName) {
      return;
    }

    setIsCreatingRoom(true);

    socket.emit(
      "create_room",
      {
        name: cleanName,
        playerId,
        privateRoom: Boolean(usePrivateRoom),
        origin: window.location.origin,
        settings: {
          maxPlayers: 8,
          rounds: 3,
          drawTime: 80,
          wordChoicesCount: 3,
          hintsEnabled: true,
          hintsCount: 2,
          hintFrequencySec: 20,
          wordMode: "normal",
          wordCategory: "mixed",
          language,
          customWords: []
        }
      },
      (res) => {
        if (!res?.ok) {
          setIsCreatingRoom(false);
          setNotification("Failed to create room.");
          return;
        }
        setStoredPlayerId(res.playerId);
        setIsCreatingRoom(false);
        navigate(`/lobby/${res.roomCode}`);
      }
    );
  };

  const handleJoin = () => {
    const cleanName = validateName();
    const cleanCode = joinCode.trim().toUpperCase();

    if (!cleanName) {
      return;
    }
    if (!cleanCode) {
      setNotification("Room code is required.");
      return;
    }

    socket.emit(
      "join_room",
      {
        name: cleanName,
        roomCode: cleanCode,
        playerId,
        spectator
      },
      (res) => {
        if (!res?.ok) {
          setNotification(`Join failed: ${res?.reason || "unknown"}`);
          return;
        }
        setStoredPlayerId(res.playerId);
        navigate(`/lobby/${cleanCode}`);
      }
    );
  };

  const handlePlayClick = () => {
    if (!validateName()) {
      return;
    }
    setMode("join");
  };


  return (
    <div className="page page-home home-skribbl">
      <div className="home-pattern" />

      <section className="start-shell">
        <h1 className="logo-word">
          <img 
            src={logoGif} alt="Logo" 
            className="cursor-pointer hover:scale-105 transition"
            onClick={() => navigate("/")} />
        </h1>

        <div className="avatar-pills" aria-hidden>
          <span className="p red" />
          <span className="p orange" />
          <span className="p yellow" />
          <span className="p green" />
          <span className="p cyan" />
          <span className="p blue" />
          <span className="p purple" />
          <span className="p pink" />
        </div>

        <div className="start-card">
          <div className="start-row">
            <input
              className="start-input"
              placeholder="Enter your name"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
            />
            <select
              className="start-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="ru">Russian</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>

            </select>
          </div>

          <div className="avatar-box" aria-hidden>
            <button className="arrow-btn" type="button">
              &lt;
            </button>
            <div className="avatar-face">:)</div>
            <button className="arrow-btn" type="button">
              &gt;
            </button>
          </div>

          <button className="btn btn-play" onClick={handlePlayClick}>
            Play!
          </button>

          <button className="btn btn-room" onClick={() => handleCreate(true)} disabled={isCreatingRoom}>
            {isCreatingRoom ? "Starting..." : "Create Private Room"}
          </button>

          {/* JOIN */}
          {mode === "join" && (
            <div className="mode-box modern-box">
              <div className="mode-header">
                <strong>Join Room</strong>
                <button className="btn btn-mini" onClick={() => setMode("idle")}> 
                  Back
                </button>
              </div>

              <div className="mode-grid">
                <input
                  className="modern-input"
                  placeholder="Room code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={8}
                />
                <button className="btn btn-primary skribbl-blue" onClick={handleJoin}>
                  Join Room
                </button>
              </div>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={spectator}
                  onChange={(e) => setSpectator(e.target.checked)}
                />
                <span>Join as spectator</span>
              </label>
            </div>
          )}



        </div>
      </section>

      <section className="home-info-strip">
        <article className="info-card">
          <h3>About</h3>
          <p>Free online multiplayer drawing and guessing game with real-time rooms.</p>
        </article>
        <article className="info-card">
          <h3>News</h3>
          <p>Fresh paint update: improved moderation, hints, and room controls.</p>
        </article>
        <article className="info-card">
          <h3>How to play</h3>
          <p>Draw your chosen word while others race to guess it before time runs out.</p>
        </article>
      </section>

      <Notification message={notification} onClose={() => setNotification(null)} />
    </div>
  );
}
