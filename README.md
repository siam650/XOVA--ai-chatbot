# Xova — Speak Freely. Grow Naturally.

Xova is an English-speaking practice platform. During a conversation it is a friendly practice partner; after the conversation it becomes an AI tutor.

## What it does

- Supports Casual Chat, Interview Practice, Debate & Discussion, and Storytelling.
- Sends conversation history to Gemini through an Express backend.
- Creates a structured AI learning report after a conversation, including grammar corrections, recurring practice priorities, natural expressions, vocabulary, strengths, and exercises.
- Keeps conversation history in the browser's localStorage. There is no database or user authentication.
- Preserves browser speech recognition, text-to-speech, and typed input as a fallback.

Voice recognition and playback depend on browser support and microphone permission. Recognition keeps finalized speech across browser session restarts and waits for 2.5 seconds of silence before submitting a spoken turn. To adjust this during development, call `XovaVoice.setEndOfSpeechSilenceThreshold(milliseconds)` in the browser console (valid range: 500–10000 ms). Use `localhost` or HTTPS; opening the page directly from disk may not work.

## Run locally

1. Copy `server\.env.example` to `server\.env` and add your own Gemini API key from Google AI Studio. Never put the key in frontend code or commit `server\.env`.
2. Start the backend from the `server` directory:

   ```powershell
   npm run dev
   ```

   The server defaults to `http://localhost:3000`; set `PORT` in `server/.env` to change it. If port 3000 is already in use, stop the other server or choose another port and update the frontend API URL below. If PowerShell blocks the `npm` script, run `npm.cmd run dev` instead of changing the execution policy.

3. Serve the project root using VS Code Live Server on port 5500, or run `python -m http.server 5500` from the project root.
4. Open `http://localhost:5500/chat.html?mode=casual-chat`. The backend allows this local origin and the project's GitHub Pages origin by default.

The backend reads `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS`, `PORT`, and `FRONTEND_ORIGINS` from `server/.env`. The Gemini timeout defaults to 45 seconds; provider retries are disabled so each chat turn creates one upstream generation request. The frontend API base URL is the `xova-api-base-url` meta tag in `chat.html`. Leave it blank for local development on port 3000; if you change `PORT`, set this tag to `http://localhost:<PORT>/api`. For a deployed frontend, set it to the deployed backend API base URL (for example, `https://your-backend.onrender.com/api`). The frontend never falls back to localhost outside local development. Also set `FRONTEND_ORIGINS` on the backend to the exact frontend origin (for GitHub Pages, `https://siam650.github.io`; do not include a path). No hosted backend URL is configured in this repository.

## Deploy the backend to Render

1. Deploy the repository's `server` directory as a Node web service. Set the service root directory to `server`, build command to `npm install`, start command to `npm start`, and health-check path to `/api/health`.
2. Set `GEMINI_API_KEY` in the Render service's environment settings. Do not put this key in frontend files or logs. Set `FRONTEND_ORIGINS` to the exact deployed frontend origin; for the current GitHub Pages project this is `https://siam650.github.io`. Optionally set `GEMINI_MODEL` and `GEMINI_TIMEOUT_MS` (10000–50000 milliseconds; default 45000).
3. Copy the public Render service URL and set the `xova-api-base-url` meta tag in `chat.html` to `<Render service URL>/api`, for example `https://your-service.onrender.com/api`. Redeploy the static frontend after changing the tag.
4. Confirm `GET <Render service URL>/api/health` returns `{"status":"ok"}`. Send a test chat from the deployed site and inspect Render logs for safe status/timing diagnostics; logs do not include API keys or provider error messages.

The source on the existing GitHub Pages deployment must include the current frontend changes, and the Render service must be deployed from a branch containing the `server` directory. A missing frontend API URL, a stale frontend build, or a Render service deployed from a branch without `server` cannot be corrected by changing Gemini settings alone.

## Beginner's architecture guide

### 1. The browser sends a request

`js/chat.js` calls `window.XovaConversationAI.getReply(...)` after saving the learner's message. `js/chat-ai.js` uses `fetch()` to POST JSON to `/api/chat`. The browser never receives the Gemini key.

An API endpoint is a URL on the server that handles a specific operation. Xova uses `POST /api/chat` for replies, `POST /api/assessment` for the end-of-conversation report, and `GET /api/health` for a simple health check.

### 2. Express receives JSON

`server/server.js` enables `express.json()` so Express can read the JSON request body as `req.body`. It checks the mode, message length, conversation history, and speech-confidence values before sending anything to Gemini.

### 3. The server calls Gemini

`server/gemini.js` creates the official `GoogleGenAI` client from `@google/genai`. For chat it sends the selected mode's instructions plus recent user/assistant messages. The SDK's `generateContent()` method is asynchronous, so the Express route uses `await` before returning `{ "reply": "..." }`. Development timing logs report frontend request/response, backend receive/complete, Gemini generation, and speech-start durations.

### 4. Environment variables protect the key

`server/.env` is a private local configuration file. `dotenv` loads it on the backend, where `GEMINI_API_KEY` is read by `server/gemini.js`. `.gitignore` excludes the file from Git. `server/.env.example` documents the required settings but contains only a placeholder.

### 5. The learning report

When the user ends a conversation, `js/chat.js` sends all saved messages to `POST /api/assessment`. Gemini returns schema-constrained JSON; the server parses and validates it before returning it to the frontend. The frontend renders the result and stores it with the conversation in localStorage. The tutor prompt avoids correcting acceptable informal English and asks Gemini to treat uncertain speech recognition cautiously.

### 6. Errors

Invalid requests receive a 400 response, oversized request bodies receive 413, missing or invalid Gemini configuration receives 503, rate limits receive 429, upstream timeouts receive 504, and upstream provider failures receive 502. Responses use safe JSON messages; logs contain status codes but never API keys or provider error text. The frontend displays actionable backend/network errors and keeps the conversation saved so the user can try again.

The assessment is AI-generated learning feedback, not a guarantee of perfect grammar or speech recognition. Review voice transcripts before treating a suggested correction as your own mistake.
