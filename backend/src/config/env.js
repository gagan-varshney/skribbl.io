import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "https://skribbl-io-omega.vercel.app/",
  roomIdleTimeoutMs: Number(process.env.ROOM_IDLE_TIMEOUT_MS || 30 * 60 * 1000)
};
