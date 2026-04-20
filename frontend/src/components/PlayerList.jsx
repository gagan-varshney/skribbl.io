export default function PlayerList({ players, hostPlayerId, selfId, showControls, onKick, onBan }) {
  return (
    <ul className="player-list">
      {players.map((player) => (
        <li key={player.id} className="player-item">
          <div>
            <strong>{player.name}</strong>
            {player.id === hostPlayerId && <span className="tag">HOST</span>}
            {player.isSpectator && <span className="tag">SPEC</span>}
            {!player.connected && <span className="tag">OFFLINE</span>}
          </div>
          <div className="row-mini">
            <span>{player.score} pts</span>
            {player.isReady && <span className="tag">READY</span>}
            {showControls && player.id !== selfId && !player.isHost && (
              <>
                <button className="btn btn-mini" onClick={() => onKick?.(player.id)}>
                  Kick
                </button>
                <button className="btn btn-mini danger" onClick={() => onBan?.(player.id)}>
                  Ban
                </button>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
