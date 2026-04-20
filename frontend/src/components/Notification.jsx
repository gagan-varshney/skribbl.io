import { useEffect, useState } from "react";

export default function Notification({ message, type = "error", onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, 5000); // Auto hide after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!visible || !message) return null;

  return (
    <div className={`notification notification-${type}`} style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: type === 'error' ? '#c53b3b' : '#57db3a',
      color: 'white',
      padding: '10px 20px',
      borderRadius: '5px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      zIndex: 1000,
      maxWidth: '300px',
      wordWrap: 'break-word'
    }}>
      {message}
      <button onClick={() => { setVisible(false); onClose?.(); }} style={{
        background: 'none',
        border: 'none',
        color: 'white',
        fontSize: '20px',
        cursor: 'pointer',
        marginLeft: '10px'
      }}>×</button>
    </div>
  );
}