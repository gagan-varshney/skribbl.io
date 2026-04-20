import { v4 as uuidv4 } from "uuid";
import { Player } from "./Player.js";
import { Game } from "./Game.js";
import { maskWordByMode } from "../utils/words.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

export class Room {
  constructor({ io, code, hostSocketId, hostName, settings, privateRoom = false, hostPlayerId }) {
    this.io = io;
    this.code = code;
    this.hostPlayerId = hostPlayerId;
    this.privateRoom = privateRoom;
    this.players = new Map();
    this.bannedPlayerIds = new Set();
    this.settings = this.normalizeSettings(settings);
    this.status = "lobby";
    this.game = new Game(this);
    this.createdAt = Date.now();
    this.updatedAt = Date.now();

    const host = new Player({
      id: hostPlayerId,
      socketId: hostSocketId,
      name: hostName,
      isHost: true
    });

    this.players.set(host.id, host);
  }

  normalizeSettings(settings = {}) {
    return {
      maxPlayers: clamp(settings.maxPlayers || 8, 2, 20),
      rounds: clamp(settings.rounds || 3, 2, 10),
      drawTime: clamp(settings.drawTime || 80, 15, 240),
      wordChoicesCount: clamp(settings.wordChoicesCount || 3, 1, 5),
      hintsEnabled: settings.hintsEnabled !== false,
      hintsCount: clamp(settings.hintsCount ?? 2, 0, 8),
      hintFrequencySec: clamp(settings.hintFrequencySec || 20, 5, 60),
      wordMode: ["normal", "hidden", "combination"].includes(settings.wordMode)
        ? settings.wordMode
        : "normal",
      wordCategory: settings.wordCategory || "mixed",
      customWords: Array.isArray(settings.customWords) ? settings.customWords : [],
      customWordsOnly: Boolean(settings.customWordsOnly),
      language: settings.language || "en"
    };
  }

  resetScores() {
    for (const player of this.players.values()) {
      player.score = 0;
      player.resetForTurn();
    }
  }

  resetForLobby() {
    this.status = "lobby";
    this.game = new Game(this);
    for (const player of this.players.values()) {
      player.resetForTurn();
    }
    this.emitRoomState();
  }

  shufflePlayerIds(ids) {
    const copy = [...ids];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  addOrReconnectPlayer({ playerId, socketId, name, spectator = false }) {
    if (this.bannedPlayerIds.has(playerId)) {
      return { ok: false, reason: "banned" };
    }

    const existing = this.players.get(playerId);
    if (existing) {
      existing.socketId = socketId;
      existing.connected = true;
      existing.name = name || existing.name;
      existing.isSpectator = spectator || existing.isSpectator;
      existing.isHost = existing.id === this.hostPlayerId;
      this.updatedAt = Date.now();
      return { ok: true, player: existing, reconnected: true };
    }

    if (!spectator && this.getActivePlayers().length >= this.settings.maxPlayers) {
      return { ok: false, reason: "room_full" };
    }

    const player = new Player({
      id: playerId || uuidv4(),
      socketId,
      name,
      isHost: false,
      isSpectator: spectator
    });

    this.players.set(player.id, player);
    this.updatedAt = Date.now();
    return { ok: true, player, reconnected: false };
  }

  removeSocket(socketId) {
    const player = this.getPlayerBySocketId(socketId);
    if (!player) {
      return null;
    }

    player.connected = false;
    this.updatedAt = Date.now();

    if (player.id === this.hostPlayerId) {
      this.assignNewHost();
    }

    return player;
  }

  assignNewHost() {
    const eligible = this.getConnectedPlayers().filter((p) => !p.isSpectator);
    for (const p of this.players.values()) {
      p.isHost = false;
    }
    if (eligible.length) {
      this.hostPlayerId = eligible[0].id;
      eligible[0].isHost = true;
    }
  }

  kickPlayer(targetPlayerId) {
    const target = this.players.get(targetPlayerId);
    if (!target) {
      return null;
    }
    this.players.delete(targetPlayerId);
    if (targetPlayerId === this.hostPlayerId) {
      this.assignNewHost();
    }
    this.updatedAt = Date.now();
    return target;
  }

  banPlayer(targetPlayerId) {
    this.bannedPlayerIds.add(targetPlayerId);
    return this.kickPlayer(targetPlayerId);
  }

  getPlayerBySocketId(socketId) {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        return player;
      }
    }
    return null;
  }

  getConnectedPlayers() {
    return Array.from(this.players.values()).filter((p) => p.connected);
  }

  getActivePlayers() {
    return Array.from(this.players.values()).filter((p) => p.connected && !p.isSpectator);
  }

  getLeaderboard() {
    return Array.from(this.players.values())
      .filter((p) => !p.isSpectator)
      .sort((a, b) => b.score - a.score)
      .map((p) => ({ id: p.id, name: p.name, score: p.score }));
  }

  toClientState(viewerPlayerId = null) {
    const viewer = viewerPlayerId ? this.players.get(viewerPlayerId) : null;
    const isDrawer = viewer && this.game.currentDrawerId === viewer.id;

    return {
      code: this.code,
      privateRoom: this.privateRoom,
      status: this.status,
      hostPlayerId: this.hostPlayerId,
      settings: this.settings,
      players: Array.from(this.players.values()).map((p) => p.toClient()),
      game: {
        isRunning: this.game.isRunning,
        currentRound: this.game.currentRound,
        totalRounds: this.settings.rounds,
        currentTurn: this.game.currentTurn,
        totalTurns: this.game.totalTurns,
        currentDrawerId: this.game.currentDrawerId,
        remainingTime: this.game.remainingTime,
        wordDisplay: this.game.currentWord
          ? isDrawer
            ? this.game.currentWord
            : maskWordByMode(this.game.currentWord, this.game.revealedIndexes, this.settings.wordMode)
          : null,
        leaderboard: this.getLeaderboard(),
        strokes: this.game.strokes
      }
    };
  }

  emitRoomState() {
    for (const player of this.players.values()) {
      if (!player.connected) {
        continue;
      }
      this.io.to(player.socketId).emit("room_state", this.toClientState(player.id));
    }
  }

  emitRoundStart() {
    this.status = "in_game";
    for (const player of this.players.values()) {
      if (!player.connected) {
        continue;
      }
      const isDrawer = player.id === this.game.currentDrawerId;
      this.io.to(player.socketId).emit("round_start", {
        round: this.game.currentRound,
        totalRounds: this.settings.rounds,
        turn: this.game.currentTurn,
        totalTurns: this.game.totalTurns,
        drawerId: this.game.currentDrawerId,
        drawTime: this.settings.drawTime,
        wordDisplay: isDrawer ? null : "Waiting for drawer to pick a word...",
        canDraw: isDrawer
      });
    }
  }

  promptDrawerWordChoice(drawerId, choices) {
    const drawer = this.players.get(drawerId);
    if (!drawer || !drawer.connected) {
      this.game.nextTurn();
      return;
    }
    this.io.to(drawer.socketId).emit("word_choices", { choices });
  }

  broadcastWordChosen() {
    for (const player of this.players.values()) {
      if (!player.connected) {
        continue;
      }
      const isDrawer = player.id === this.game.currentDrawerId;
      this.io.to(player.socketId).emit("word_chosen", {
        wordDisplay: isDrawer
          ? this.game.currentWord
          : maskWordByMode(this.game.currentWord, this.game.revealedIndexes, this.settings.wordMode),
        drawerId: this.game.currentDrawerId,
        drawTime: this.settings.drawTime
      });
    }
  }

  broadcastTimer(remainingTime) {
    this.io.to(this.code).emit("timer_update", { remainingTime });
  }

  broadcastHint(maskedWord) {
    this.io.to(this.code).emit("hint_update", { maskedWord });
  }
}
