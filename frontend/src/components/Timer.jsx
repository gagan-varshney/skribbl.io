export default function Timer({ value }) {
  const safe = Math.max(0, Number(value || 0));
  return <div className="timer">{safe}s</div>;
}
