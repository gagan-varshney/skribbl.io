import { v4 as uuidv4 } from "uuid";
import { Room } from "../models/Room.js";

function randomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export class RoomManager {
  constructor(io, roomIdleTimeoutMs) {
    this.io = io;
    this.rooms = new Map();
    this.socketToRoomCode = new Map();
    this.socketToPlayerId = new Map();
    this.roomIdleTimeoutMs = roomIdleTimeoutMs;
  }

  createRoom({ hostSocketId, hostName, settings, privateRoom, playerId }) {
    let code = randomCode();
    while (this.rooms.has(code)) {
      code = randomCode();
    }

    const room = new Room({
      io: this.io,
      code,
      hostSocketId,
      hostName,
      settings,
      privateRoom,
      hostPlayerId: playerId || uuidv4()
    });

    this.rooms.set(code, room);
    this.socketToRoomCode.set(hostSocketId, code);
    this.socketToPlayerId.set(hostSocketId, room.hostPlayerId);

    return room;
  }

  getRoom(code) {
    return this.rooms.get(String(code || "").toUpperCase()) || null;
  }

  joinRoom({ roomCode, socketId, playerId, name, spectator = false }) {
    const room = this.getRoom(roomCode);
    if (!room) {
      return { ok: false, reason: "room_not_found" };
    }

    const joinResult = room.addOrReconnectPlayer({
      playerId: playerId || uuidv4(),
      socketId,
      name,
      spectator
    });

    if (!joinResult.ok) {
      return joinResult;
    }

    this.socketToRoomCode.set(socketId, room.code);
    this.socketToPlayerId.set(socketId, joinResult.player.id);
    return { ok: true, room, player: joinResult.player, reconnected: joinResult.reconnected };
  }

  leaveBySocket(socketId) {
    const roomCode = this.socketToRoomCode.get(socketId);
    if (!roomCode) {
      return null;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.socketToRoomCode.delete(socketId);
      this.socketToPlayerId.delete(socketId);
      return null;
    }

    const player = room.removeSocket(socketId);
    this.socketToRoomCode.delete(socketId);
    this.socketToPlayerId.delete(socketId);

    this.cleanupRoomIfStale(room);
    return { room, player };
  }

  cleanupRoomIfStale(room) {
    const hasConnected = room.getConnectedPlayers().length > 0;
    if (hasConnected) {
      return;
    }

    setTimeout(() => {
      const targetRoom = this.rooms.get(room.code);
      if (!targetRoom) {
        return;
      }
      const connectedCount = targetRoom.getConnectedPlayers().length;
      const age = Date.now() - targetRoom.updatedAt;
      if (connectedCount === 0 && age >= this.roomIdleTimeoutMs) {
        this.rooms.delete(targetRoom.code);
      }
    }, this.roomIdleTimeoutMs + 1000);
  }

  getRoomAndPlayerBySocket(socketId) {
    const roomCode = this.socketToRoomCode.get(socketId);
    const playerId = this.socketToPlayerId.get(socketId);
    if (!roomCode || !playerId) {
      return { room: null, player: null, playerId: null };
    }

    const room = this.rooms.get(roomCode) || null;
    const player = room ? room.players.get(playerId) || null : null;
    return { room, player, playerId };
  }
}
