export default function Scoreboard({ scores }) {
  return (
    <div>
      <h4>Scoreboard</h4>
      <ol className="score-list">
        {scores.map((entry) => (
          <li key={entry.id}>
            <span>{entry.name}</span>
            <strong>{entry.score}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}
