import { createContext, useContext, useMemo } from "react";
import { io } from "socket.io-client";
import { BACKEND_URL } from "../utils/config";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socket = useMemo(
    () =>
      io(BACKEND_URL, {
        transports: ["websocket"],
        autoConnect: true
      }),
    []
  );

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const socket = useContext(SocketContext);
  if (!socket) {
    throw new Error("useSocket must be used inside SocketProvider");
  }
  return socket;
}
