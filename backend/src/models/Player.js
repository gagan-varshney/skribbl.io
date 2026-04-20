export class Player {
  constructor({ id, socketId, name, isHost = false, isSpectator = false }) {
    this.id = id;
    this.socketId = socketId;
    this.name = name;
    this.isHost = isHost;
    this.isSpectator = isSpectator;
    this.isReady = false;
    this.score = 0;
    this.connected = true;
    this.hasGuessedCorrectly = false;
    this.guessTimestamp = null;
  }

  resetForTurn() {
    this.hasGuessedCorrectly = false;
    this.guessTimestamp = null;
  }

  toClient() {
    return {
      id: this.id,
      name: this.name,
      isHost: this.isHost,
      isSpectator: this.isSpectator,
      isReady: this.isReady,
      score: this.score,
      connected: this.connected,
      hasGuessedCorrectly: this.hasGuessedCorrectly
    };
  }
}
