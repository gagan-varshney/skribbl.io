import { normalizeWord } from "../utils/words.js";

function sanitizeMessage(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 200);
}

export function registerSocketHandlers(io, roomManager) {
  io.on("connection", (socket) => {
    socket.on("create_room", (payload, ack) => {
      const name = sanitizeMessage(payload?.name) || "Host";
      const playerId = payload?.playerId;
      const room = roomManager.createRoom({
        hostSocketId: socket.id,
        hostName: name,
        settings: payload?.settings || {},
        privateRoom: Boolean(payload?.privateRoom),
        playerId
      });

      socket.join(room.code);
      room.emitRoomState();

      ack?.({
        ok: true,
        roomCode: room.code,
        playerId: room.hostPlayerId,
        inviteLink: payload?.origin ? `${payload.origin}/?room=${room.code}` : room.code
      });
    });

    socket.on("join_room", (payload, ack) => {
      const name = sanitizeMessage(payload?.name) || "Player";
      const spectator = Boolean(payload?.spectator);
      const result = roomManager.joinRoom({
        roomCode: payload?.roomCode,
        socketId: socket.id,
        playerId: payload?.playerId,
        name,
        spectator
      });

      if (!result.ok) {
        ack?.({ ok: false, reason: result.reason });
        return;
      }

      const { room, player, reconnected } = result;
      socket.join(room.code);

      io.to(room.code).emit("player_joined", { player: player.toClient(), reconnected });
      room.emitRoomState();

      ack?.({
        ok: true,
        roomCode: room.code,
        playerId: player.id,
        roomState: room.toClientState(player.id)
      });
    });

    socket.on("start_game", (_, ack) => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player || player.id !== room.hostPlayerId) {
        ack?.({ ok: false, reason: "not_allowed" });
        return;
      }

      if (room.getActivePlayers().length < 2) {
        ack?.({ ok: false, reason: "min_players" });
        return;
      }

      room.status = "in_game";
      room.game.start();
      room.emitRoomState();
      io.to(room.code).emit("start_game", { ok: true });
      ack?.({ ok: true });
    });

    socket.on("word_chosen", ({ word }, ack) => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player) {
        ack?.({ ok: false, reason: "room_not_found" });
        return;
      }

      const ok = room.game.chooseWord(player.id, word);
      ack?.({ ok });
    });

    socket.on("draw_start", (stroke) => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player || player.id !== room.game.currentDrawerId) {
        return;
      }
      const segment = { type: "start", ...stroke };
      room.game.strokes.push(segment);
      socket.to(room.code).emit("draw_data", segment);
      socket.to(room.code).emit("draw_start", segment);
    });

    socket.on("draw_move", (stroke) => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player || player.id !== room.game.currentDrawerId) {
        return;
      }
      const segment = { type: "move", ...stroke };
      room.game.strokes.push(segment);
      socket.to(room.code).emit("draw_data", segment);
      socket.to(room.code).emit("draw_move", segment);
    });

    socket.on("draw_end", (stroke) => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player || player.id !== room.game.currentDrawerId) {
        return;
      }
      const segment = { type: "end", ...stroke };
      room.game.strokes.push(segment);
      socket.to(room.code).emit("draw_data", segment);
      socket.to(room.code).emit("draw_end", segment);
    });

    socket.on("undo_stroke", () => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player || player.id !== room.game.currentDrawerId) {
        return;
      }
      const lastStrokeId = [...room.game.strokes].reverse().find((s) => s.strokeId)?.strokeId;
      if (!lastStrokeId) {
        return;
      }
      room.game.strokes = room.game.strokes.filter((s) => s.strokeId !== lastStrokeId);
      io.to(room.code).emit("draw_data", { type: "undo", strokeId: lastStrokeId });
    });

    socket.on("clear_canvas", () => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player || player.id !== room.game.currentDrawerId) {
        return;
      }
      room.game.strokes = [];
      io.to(room.code).emit("draw_data", { type: "clear" });
    });

    socket.on("guess", ({ text }, ack) => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player) {
        ack?.({ ok: false, reason: "room_not_found" });
        return;
      }

      const guessText = sanitizeMessage(text);
      const guessResult = room.game.processGuess(player.id, guessText);

      if (!guessResult.accepted) {
        ack?.({ ok: false, reason: guessResult.reason });
        return;
      }

      if (guessResult.correct) {
        io.to(room.code).emit("guess_result", {
          playerId: player.id,
          playerName: player.name,
          correct: true,
          guessPoints: guessResult.guessPoints,
          drawerPoints: guessResult.drawerPoints,
          leaderboard: room.getLeaderboard()
        });

        io.to(room.code).emit("chat_message", {
          type: "system",
          message: `${player.name} guessed correctly!`,
          timestamp: Date.now()
        });

        room.emitRoomState();

        if (room.game.allGuessersDone()) {
          room.game.endRound("all_guessed");
        }
      } else {
        io.to(room.code).emit("chat_message", {
          type: "guess",
          playerId: player.id,
          playerName: player.name,
          message: guessText,
          timestamp: Date.now()
        });
        io.to(player.socketId).emit("guess_result", {
          playerId: player.id,
          correct: false
        });
      }

      ack?.({ ok: true, result: guessResult.correct ? "correct" : "incorrect" });
    });

    socket.on("chat", ({ message }) => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player) {
        return;
      }
      const clean = sanitizeMessage(message);
      if (!clean) {
        return;
      }

      const guessedWord = room.game.currentWord ? normalizeWord(room.game.currentWord) : null;
      if (guessedWord && normalizeWord(clean) === guessedWord && player.id !== room.game.currentDrawerId) {
        return;
      }

      io.to(room.code).emit("chat_message", {
        type: "chat",
        playerId: player.id,
        playerName: player.name,
        message: clean,
        timestamp: Date.now()
      });
    });

    socket.on("toggle_ready", (_, ack) => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player) {
        ack?.({ ok: false });
        return;
      }
      player.isReady = !player.isReady;
      room.emitRoomState();
      ack?.({ ok: true, isReady: player.isReady });
    });

    socket.on("kick_player", ({ playerId }, ack) => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player || player.id !== room.hostPlayerId) {
        ack?.({ ok: false, reason: "not_allowed" });
        return;
      }

      const removed = room.kickPlayer(playerId);
      if (!removed) {
        ack?.({ ok: false, reason: "not_found" });
        return;
      }

      if (removed.socketId) {
        io.to(removed.socketId).emit("kicked", { roomCode: room.code });
      }
      io.to(room.code).emit("player_left", { playerId: removed.id, reason: "kicked" });
      room.emitRoomState();
      ack?.({ ok: true });
    });

    socket.on("ban_player", ({ playerId }, ack) => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player || player.id !== room.hostPlayerId) {
        ack?.({ ok: false, reason: "not_allowed" });
        return;
      }

      const removed = room.banPlayer(playerId);
      if (!removed) {
        ack?.({ ok: false, reason: "not_found" });
        return;
      }

      if (removed.socketId) {
        io.to(removed.socketId).emit("banned", { roomCode: room.code });
      }
      io.to(room.code).emit("player_left", { playerId: removed.id, reason: "banned" });
      room.emitRoomState();
      ack?.({ ok: true });
    });

    socket.on("update_custom_words", ({ customWords }, ack) => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player || player.id !== room.hostPlayerId) {
        ack?.({ ok: false, reason: "not_allowed" });
        return;
      }

      const words = Array.isArray(customWords) ? customWords : [];
      room.settings.customWords = words.map(w => String(w).trim()).filter(w => w.length >= 1 && w.length <= 32);
      room.emitRoomState();
      ack?.({ ok: true });
    });

    socket.on("update_setting", ({ key, value }, ack) => {
      const { room, player } = roomManager.getRoomAndPlayerBySocket(socket.id);
      if (!room || !player || player.id !== room.hostPlayerId) {
        ack?.({ ok: false, reason: "not_allowed" });
        return;
      }

      if (!room.settings.hasOwnProperty(key)) {
        ack?.({ ok: false, reason: "invalid_key" });
        return;
      }

      room.settings[key] = value;
      room.emitRoomState();
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const left = roomManager.leaveBySocket(socket.id);
      if (!left || !left.room || !left.player) {
        return;
      }
      const { room, player } = left;
      io.to(room.code).emit("player_left", { playerId: player.id, disconnected: true });
      room.emitRoomState();
    });
  });
}
