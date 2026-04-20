import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { RoomManager } from "./game/RoomManager.js";
import { registerSocketHandlers } from "./socket/registerSocketHandlers.js";

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === env.frontendOrigin) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      callback(new Error("CORS blocked"));
    }
  },
  credentials: true
}));

app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: env.frontendOrigin,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const roomManager = new RoomManager(io, env.roomIdleTimeoutMs);
registerSocketHandlers(io, roomManager);

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${env.port}`);
});
