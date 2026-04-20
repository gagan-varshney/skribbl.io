import { useMemo, useState } from "react";

export default function ChatBox({ messages, canGuess, onSendChat, onSendGuess, classic = false }) {
  const [text, setText] = useState("");

  const sortedMessages = useMemo(() => messages.slice(-60), [messages]);

  const submit = (e) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    if (canGuess) {
      onSendGuess(clean);
    } else {
      onSendChat(clean);
    }
    setText("");
  };

  return (
    <div className={`chat-box ${classic ? "chat-box-classic" : ""}`}>
      {!classic && <h4>Chat</h4>}
      <div className="chat-feed">
        {sortedMessages.map((message, index) => (
          <p key={`${message.timestamp || 0}-${index}`} className={`chat-${message.type || "chat"}`}>
            {message.playerName ? <strong>{message.playerName}: </strong> : null}
            {message.message}
          </p>
        ))}
      </div>

      <form className="stack-form" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canGuess ? "Type your guess here..." : "Type your chat here..."}
          maxLength={200}
        />
        {!classic && (
          <button className="btn btn-primary" type="submit">
            {canGuess ? "Guess" : "Send"}
          </button>
        )}
      </form>
    </div>
  );
}
