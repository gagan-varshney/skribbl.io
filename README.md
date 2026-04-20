# Skribbl.io Clone (Full Stack)

A production-ready multiplayer drawing and guessing game built with:

- Frontend: React + Vite
- Backend: Node.js + Express
- Real-time: Socket.IO
- Canvas: HTML5 Canvas API
- Optional persistence: MongoDB can be added later for user stats/history

## Project Structure

```txt
skribbl.io/
  backend/
    .env.example
    package.json
    src/
      config/
        env.js
      game/
        RoomManager.js
      models/
        Player.js
        Room.js
        Game.js
      socket/
        registerSocketHandlers.js
      utils/
        words.js
      server.js
  frontend/
    .env.example
    index.html
    package.json
    vite.config.js
    src/
      App.jsx
      main.jsx
      styles.css
      context/
        SocketContext.jsx
      pages/
        HomePage.jsx
        LobbyPage.jsx
        GamePage.jsx
      components/
        CanvasBoard.jsx
        ChatBox.jsx
        PlayerList.jsx
        Scoreboard.jsx
        Timer.jsx
        WordDisplay.jsx
      utils/
        config.js
        storage.js
  .gitignore
  README.md
```

## Features Implemented

### Core Features

- Room system
  - Create room with settings (max players, rounds, draw time, word choices, hints)
  - Join room via room code
  - Private room support via invite link
  - Lobby with player list, ready toggle, host start controls
- Game flow
  - Turn-based gameplay with drawer rotation
  - Drawer chooses one word from multiple choices
  - Timer countdown and automatic round switching
  - Final leaderboard and game over screen
- Real-time drawing
  - Brush, color picker, brush size, eraser
  - Undo and clear canvas (drawer-only)
  - Stroke-based synchronization via Socket.IO (`draw_data`)
- Chat and guessing
  - Global chat
  - Server-side guess validation (trim + case-insensitive)
  - Correct guess announcements
  - Correct word hidden from non-drawers during round
- Scoring system
  - Speed-based guessing points
  - Drawer points when guesses are correct
  - Live leaderboard updates
- Hint system
  - Gradual letter reveal over time
  - Configurable hint frequency
- Required socket events
  - `create_room`, `join_room`, `player_joined`, `player_left`, `start_game`
  - `round_start`, `word_chosen`
  - `draw_start`, `draw_move`, `draw_end`, `draw_data`
  - `guess`, `guess_result`
  - `chat`, `chat_message`
  - `hint_update`, `round_end`, `game_over`
- Game state per room with OOP classes
  - `Room`, `Player`, `Game`

### Advanced Features

- Spectator mode
- Reconnect support (same player ID from localStorage)
- Host kick/ban controls
- Word categories
- Custom word list input
- Basic language option field in settings (extensible)

## Architecture Overview

- Backend is authoritative for game logic and state.
- Each room has:
  - player registry
  - settings
  - game instance (`Game` class)
- Clients only emit intents (guess, draw stroke, select word, chat).
- Server validates all critical actions:
  - guess correctness
  - drawer-only drawing
  - host-only moderation/start actions
- Drawing sync uses stroke segments, not image snapshots, to reduce bandwidth.

## Local Setup

## 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend runs at `http://localhost:4000`.

## 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Environment Variables

### Backend (`backend/.env`)

- `PORT` (default: `4000`)
- `FRONTEND_ORIGIN` (default: `http://localhost:5173`)
- `ROOM_IDLE_TIMEOUT_MS` (default: 1800000)

### Frontend (`frontend/.env`)

- `VITE_BACKEND_URL` (default: `http://localhost:4000`)

## Deployment

## Frontend (Vercel)

1. Import `frontend` folder as project in Vercel.
2. Framework preset: `Vite`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add env var:
   - `VITE_BACKEND_URL=https://<your-backend-domain>`
6. Deploy.

## Backend (Render)

1. Create a new Web Service from `backend` folder.
2. Build command: `npm install`.
3. Start command: `npm run start`.
4. Add env vars:
   - `PORT=4000`
   - `FRONTEND_ORIGIN=https://<your-vercel-domain>`
   - `ROOM_IDLE_TIMEOUT_MS=1800000`
5. Deploy.

## Backend (Railway alternative)

1. Create a new project and point to `backend` folder.
2. Set start command to `npm run start`.
3. Configure same environment variables as above.
4. Deploy and copy public URL to frontend env.

## Production Notes

- Enable HTTPS on both frontend and backend.
- Keep `FRONTEND_ORIGIN` strict (single allowed origin or controlled allowlist).
- Add rate-limiting middleware and message moderation for public deployments.
- Add persistence (MongoDB) for user accounts, history, and statistics if needed.

## Verified Build Status

- Backend: starts successfully (`npm run start`)
- Frontend: production build succeeds (`npm run build`)

## Optional Next Enhancements

- Persist user profiles and match history in MongoDB
- Add anti-spam throttling and profanity filters
- Add room password support and moderator roles
- Add i18n dictionary-based UI strings and word packs
