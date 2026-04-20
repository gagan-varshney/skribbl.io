export default function WordDisplay({ word }) {
  return <div className="word-display">{word || "Waiting for word..."}</div>;
}
