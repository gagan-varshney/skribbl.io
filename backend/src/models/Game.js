import { getWordChoices, initialRevealIndexes, maskWordByMode, nextHintIndex, normalizeWord } from "../utils/words.js";

export class Game {
  constructor(room) {
    this.room = room;
    this.isRunning = false;
    this.currentRound = 1;
    this.currentTurn = 0;
    this.drawerOrder = [];
    this.drawerIndex = -1;
    this.currentDrawerId = null;
    this.currentWord = null;
    this.currentChoices = [];
    this.revealedIndexes = new Set();
    this.roundStartedAt = null;
    this.remainingTime = room.settings.drawTime;
    this.roundTimer = null;
    this.hintTimer = null;
    this.wordChoiceTimer = null;
    this.firstCorrectGuessAt = null;
    this.strokes = [];
  }

  get totalTurns() {
    return this.room.settings.rounds * Math.max(1, this.room.getActivePlayers().length);
  }

  start() {
    this.isRunning = true;
    this.currentRound = 1;
    this.currentTurn = 0;
    this.drawerOrder = this.room.shufflePlayerIds(this.room.getActivePlayers().map((p) => p.id));
    this.drawerIndex = -1;
    this.room.resetScores();
    this.nextTurn();
  }

  stop() {
    this.isRunning = false;
    this.clearTimers();
  }

  clearTimers() {
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
    if (this.hintTimer) {
      clearInterval(this.hintTimer);
      this.hintTimer = null;
    }
    if (this.wordChoiceTimer) {
      clearTimeout(this.wordChoiceTimer);
      this.wordChoiceTimer = null;
    }
  }

  nextTurn() {
    const activePlayers = this.room.getActivePlayers();
    if (!activePlayers.length) {
      this.stop();
      return;
    }

    this.clearTimers();
    this.currentTurn += 1;
    this.currentRound = Math.ceil(this.currentTurn / activePlayers.length);

    if (this.currentRound > this.room.settings.rounds) {
      this.endGame();
      return;
    }

    this.drawerIndex = (this.drawerIndex + 1) % activePlayers.length;
    this.currentDrawerId = activePlayers[this.drawerIndex].id;
    this.currentChoices = getWordChoices({
      category: this.room.settings.wordCategory,
      count: this.room.settings.wordChoicesCount,
      customWords: this.room.settings.customWords,
      customWordsOnly: this.room.settings.customWordsOnly
    });
    this.currentWord = null;
    this.revealedIndexes = new Set();
    this.roundStartedAt = null;
    this.remainingTime = this.room.settings.drawTime;
    this.firstCorrectGuessAt = null;
    this.strokes = [];

    for (const player of this.room.players.values()) {
      player.resetForTurn();
    }

    this.room.emitRoundStart();
    this.room.promptDrawerWordChoice(this.currentDrawerId, this.currentChoices);

    this.wordChoiceTimer = setTimeout(() => {
      if (!this.currentWord) {
        const fallback = this.currentChoices[Math.floor(Math.random() * this.currentChoices.length)];
        this.chooseWord(this.currentDrawerId, fallback);
      }
    }, 15000);
  }

  chooseWord(playerId, word) {
    if (playerId !== this.currentDrawerId || this.currentWord) {
      return false;
    }
    const selected = this.currentChoices.find((w) => normalizeWord(w) === normalizeWord(word));
    if (!selected) {
      return false;
    }

    this.currentWord = selected;
    this.revealedIndexes = initialRevealIndexes(this.currentWord, this.room.settings.wordMode);
    this.roundStartedAt = Date.now();
    this.room.broadcastWordChosen();
    this.startRoundTimer();
    this.startHintTimer();
    return true;
  }

  startRoundTimer() {
    this.roundTimer = setInterval(() => {
      this.remainingTime -= 1;
      this.room.broadcastTimer(this.remainingTime);

      if (this.remainingTime <= 0) {
        this.endRound("time_up");
      }

      if (this.allGuessersDone()) {
        this.endRound("all_guessed");
      }
    }, 1000);
  }

  startHintTimer() {
    if (!this.room.settings.hintsEnabled || this.room.settings.wordMode === "hidden") {
      return;
    }
    const hintsCount = Number(this.room.settings.hintsCount || 0);
    if (hintsCount <= 0) {
      return;
    }

    const intervalMs = Math.max(4000, Math.floor((this.room.settings.drawTime * 1000) / (hintsCount + 1)));
    let hintsGiven = 0;

    this.hintTimer = setInterval(() => {
      if (hintsGiven >= hintsCount) {
        clearInterval(this.hintTimer);
        this.hintTimer = null;
        return;
      }
      if (!this.currentWord) {
        return;
      }
      const revealIndex = nextHintIndex(this.currentWord, this.revealedIndexes);
      if (revealIndex === null) {
        clearInterval(this.hintTimer);
        this.hintTimer = null;
        return;
      }
      this.revealedIndexes.add(revealIndex);
      hintsGiven += 1;
      this.room.broadcastHint(maskWordByMode(this.currentWord, this.revealedIndexes, this.room.settings.wordMode));
    }, intervalMs);
  }

  allGuessersDone() {
    const guessers = this.room.getActivePlayers().filter((p) => p.id !== this.currentDrawerId);
    return guessers.length > 0 && guessers.every((p) => p.hasGuessedCorrectly);
  }

  processGuess(playerId, rawGuess) {
    const player = this.room.players.get(playerId);
    if (!player || player.isSpectator || player.id === this.currentDrawerId || !this.currentWord) {
      return { accepted: false, correct: false, reason: "invalid_guess" };
    }

    const guess = normalizeWord(rawGuess);
    const answer = normalizeWord(this.currentWord);

    if (!guess) {
      return { accepted: false, correct: false, reason: "empty_guess" };
    }

    if (player.hasGuessedCorrectly) {
      return { accepted: false, correct: false, reason: "already_guessed" };
    }

    if (guess !== answer) {
      return { accepted: true, correct: false };
    }

    player.hasGuessedCorrectly = true;
    player.guessTimestamp = Date.now();
    const elapsed = player.guessTimestamp - this.roundStartedAt;
    const maxMs = this.room.settings.drawTime * 1000;
    const speedRatio = Math.max(0.1, 1 - elapsed / maxMs);
    const isFirstCorrect = !this.firstCorrectGuessAt;

    if (isFirstCorrect) {
      this.firstCorrectGuessAt = player.guessTimestamp;
    }

    const guessPoints = Math.floor(100 + speedRatio * 200 + (isFirstCorrect ? 50 : 0));
    player.score += guessPoints;

    const drawer = this.room.players.get(this.currentDrawerId);
    if (drawer) {
      drawer.score += 60;
    }

    return {
      accepted: true,
      correct: true,
      guessPoints,
      drawerPoints: drawer ? 60 : 0,
      isFirstCorrect
    };
  }

  endRound(reason) {
    if (!this.currentWord) {
      return;
    }
    this.clearTimers();

    const payload = {
      reason,
      word: this.currentWord,
      scores: this.room.getLeaderboard(),
      nextTurnInSec: 4
    };

    this.room.io.to(this.room.code).emit("round_end", payload);

    setTimeout(() => {
      if (this.isRunning) {
        this.nextTurn();
      }
    }, 4000);
  }

  endGame() {
    this.stop();
    this.room.io.to(this.room.code).emit("game_over", {
      scores: this.room.getLeaderboard()
    });
    this.room.resetForLobby();
  }
}
