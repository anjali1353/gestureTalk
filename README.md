# 🤟 GestureSpeak — React + Node

AI-powered Sign Language to Speech Converter.
Browser camera → MediaPipe hand detection → gesture classification → voice output.

---

## Project Structure

```
gesturespeakapp/
├── package.json          ← root scripts (run both client + server)
├── server/
│   ├── index.js          ← Express + Socket.io backend
│   └── package.json
└── client/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── components/
        │   ├── CameraFeed.jsx
        │   ├── ConversationLog.jsx
        │   ├── GestureGuide.jsx
        │   └── OutputPanel.jsx
        ├── hooks/
        │   ├── useMediaPipe.js
        │   ├── useVoice.js
        │   └── useGestureLogger.js
        ├── utils/
        │   ├── gestures.js
        │   └── socket.js
        └── styles/
            └── global.css
```

---

## Quick Start

### 1. Install all dependencies
```bash
npm run install:all
```

### 2. Run dev servers (both at once)
```bash
npm run dev
```

This starts:
- **React frontend** → http://localhost:5173
- **Node backend**  → http://localhost:4000

### 3. Open in Chrome
Go to **http://localhost:5173**, allow camera access, click **▶ Start**.

---

## Backend API

| Method | Endpoint    | Description              |
|--------|-------------|--------------------------|
| GET    | /api/logs   | Get all session logs     |
| POST   | /api/logs   | Save a gesture entry     |
| DELETE | /api/logs   | Clear session            |
| GET    | /api/health | Server health check      |

### WebSocket Events (Socket.io)

| Event              | Direction       | Payload                  |
|--------------------|-----------------|--------------------------|
| `gesture:new`      | server → client | `{ id, gesture, confidence, timestamp }` |
| `gesture:history`  | server → client | Array of log entries     |
| `gesture:cleared`  | server → client | (empty)                  |

---

## Supported Gestures

| Gesture      | Hand Shape            |
|--------------|-----------------------|
| Hello        | Open spread hand wave |
| Yes          | Thumbs up             |
| No           | Thumbs down           |
| Help / SOS   | Raised fist           |
| Thank You    | Hand curved to chest  |
| Please       | Flat open palm        |
| I Love You   | ASL ILY sign          |
| Stop         | Palm facing outward   |

---

## Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express + Socket.io
- **AI/ML**: MediaPipe Hands (Google)
- **Voice**: Web Speech API (built into Chrome)
- **Styling**: Pure CSS with CSS variables

---

## Tips for the Demo

- Use Chrome — Web Speech API works best there
- Good lighting improves detection accuracy
- Hold gestures steady for ~0.5s for reliable detection
- The confidence bar shows detection certainty — retry if below 70%
