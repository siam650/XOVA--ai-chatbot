# Xova — Speak Freely. Grow Naturally.

Xova is an English-speaking practice platform. During a conversation it is a friendly practice partner; after the conversation it becomes an AI tutor.

## What it does

- Supports Casual Chat, Interview Practice, Debate & Discussion, and Storytelling.
- Sends conversation history to Gemini through an Express backend.
- Creates a structured AI learning report after a conversation, including grammar corrections, recurring practice priorities, natural expressions, vocabulary, strengths, and exercises.
- Keeps conversation text, timestamps, voice-source metadata, and learning reports in this browser's `localStorage`. Each saved conversation can be deleted from the history list; clearing this site's browser data also deletes all saved conversations. There is no database or user authentication, and local history is not encrypted.
- Preserves browser speech recognition, text-to-speech, and typed input as a fallback.

Voice recognition and playback depend on browser support and microphone permission. Recognition keeps finalized speech across browser session restarts and waits for 2.5 seconds of silence before submitting a spoken turn. To adjust this during development, call `XovaVoice.setEndOfSpeechSilenceThreshold(milliseconds)` in the browser console (valid range: 500–10000 ms). Use `localhost` or HTTPS; opening the page directly from disk may not work.

## Run locally

1. Copy `server\.env.example` to `server\.env` and add your own Gemini API key from Google AI Studio. Never put the key in frontend code or commit `server\.env`.
2. Start the backend from the `server` directory:

   ```powershell
   npm run dev
   ```

   The server defaults to `http://localhost:3000`; set `PORT` in `server/.env` to change it. The Gemini key is required at startup. The example config allows the local frontend origin; replace it with the exact deployed origin on production. If PowerShell blocks the `npm` script, run `npm.cmd run dev` instead of changing the execution policy.

3. Serve the project root using VS Code Live Server on port 5500, or run `python -m http.server 5500` from the project root.
4. Open `http://localhost:5500/chat.html?mode=casual-chat`. The backend allows this local origin and the project's GitHub Pages origin by default.

The backend reads `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS`, `PORT`, `FRONTEND_ORIGINS`, `RATE_LIMIT_WINDOW_MS`, `CHAT_RATE_LIMIT_MAX`, `ASSESSMENT_RATE_LIMIT_MAX`, and `TRUST_PROXY_HOPS`. The Gemini timeout defaults to 45 seconds; provider retries are disabled so each chat turn creates one upstream generation request. The frontend's API base URL is configured in `getApiBaseUrl()` in `js/chat-ai.js`; its current value targets the Render service, so local frontend/backend integration requires temporarily setting it to `http://localhost:3000`. CORS defaults are environment-specific: local origins in development and the GitHub Pages origin in production. Set `FRONTEND_ORIGINS` to the exact comma-separated frontend origins for that environment; do not include paths or wildcards.

Chat requests are limited to 30 per IP per 15 minutes and assessments to 5 per IP per 15 minutes by default. Configure these values with the rate-limit environment variables. The default limiter uses in-memory counters, which reset on restart and are not shared across instances; deployments with multiple backend instances should use a shared rate-limit store. CORS controls browser access, not API authentication or automated abuse. Render deployments trust one proxy hop by default; set `TRUST_PROXY_HOPS` to the actual number of trusted reverse proxies in front of the service, and do not trust client-controlled proxy headers.

## Deploy the backend to Render

1. Deploy the repository's `server` directory as a Node web service. Set the service root directory to `server`, build command to `npm install`, start command to `npm start`, and health-check path to `/api/health`.
2. Set `GEMINI_API_KEY` in the Render service's environment settings. Do not put this key in frontend files or logs. Set `FRONTEND_ORIGINS=https://siam650.github.io` for the current GitHub Pages project and `TRUST_PROXY_HOPS=1` for Render's reverse proxy. Optionally set `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS` (10000–50000 milliseconds; default 45000), `RATE_LIMIT_WINDOW_MS` (default 900000), `CHAT_RATE_LIMIT_MAX` (default 30), and `ASSESSMENT_RATE_LIMIT_MAX` (default 5).
3. If the Render service URL changes, update the production URL returned by `getApiBaseUrl()` in `js/chat-ai.js` and redeploy the static frontend.
4. Confirm `GET <Render service URL>/api/health` returns `{"status":"ok"}`. Send a test chat from the deployed site and inspect Render logs for safe status/timing diagnostics; logs do not include API keys or provider error messages.

The source on the existing GitHub Pages deployment must include the current frontend changes, and the Render service must be deployed from a branch containing the `server` directory. Helmet protects backend responses; the frontend pages also carry CSP and referrer-policy meta tags. Inline styles remain allowed for the existing animation and input-sizing behavior; inline scripts are blocked, and the homepage import map is allowed by its SHA-256 hash. Update that hash if the import map changes. GitHub Pages does not inherit backend headers, so configure response-header protections such as `frame-ancestors` and HSTS at a hosting/CDN layer if available. A missing frontend API URL, a stale frontend build, or a Render service deployed from a branch without `server` cannot be corrected by changing Gemini settings alone.

## Beginner's architecture guide

### 1. The browser sends a request

`js/chat.js` calls `window.XovaConversationAI.getReply(...)` after saving the learner's message. `js/chat-ai.js` uses `fetch()` to POST JSON to `/api/chat`. The browser never receives the Gemini key.

An API endpoint is a URL on the server that handles a specific operation. Xova uses `POST /api/chat` for replies, `POST /api/assessment` for the end-of-conversation report, and `GET /api/health` for a simple health check.

### 2. Express receives JSON

`server/server.js` enables `express.json()` with a 256 KB limit so Express can read the JSON request body as `req.body`. It checks allowed fields, mode, message length, conversation history, and speech metadata, and rate-limits the paid AI endpoints before sending anything to Gemini.

### 3. The server calls Gemini

`server/gemini.js` creates the official `GoogleGenAI` client from `@google/genai`. For chat it sends the selected mode's instructions plus recent user/assistant messages. The SDK's `generateContent()` method is asynchronous, so the Express route uses `await` before returning `{ "reply": "..." }`. Development timing logs report frontend request/response, backend receive/complete, Gemini generation, and speech-start durations.

### 4. Environment variables protect the key

`server/.env` is a private local configuration file. `dotenv` loads it on the backend, where `GEMINI_API_KEY` is read by `server/gemini.js`. `.gitignore` excludes the file from Git. `server/.env.example` documents the required settings but contains only a placeholder.

### 5. The learning report

When the user ends a conversation, `js/chat.js` sends all saved messages to `POST /api/assessment`. Gemini returns schema-constrained JSON; the server parses and validates it before returning it to the frontend. The frontend renders the result and stores it with the conversation in localStorage. The tutor prompt avoids correcting acceptable informal English and asks Gemini to treat uncertain speech recognition cautiously.

### 6. Errors

Invalid requests receive a 400 response, oversized request bodies receive 413, missing `GEMINI_API_KEY` stops the server at startup, invalid runtime AI configuration receives 503, rate limits receive 429, upstream timeouts receive 504, and model/authentication/provider failures return safe error codes. Development logs include the operation, error name, sanitized provider message, provider status/code, and model; they never log API keys or authorization headers. Production logs remain concise and do not include provider messages or upstream status in API responses. The frontend displays actionable backend/network errors and keeps the conversation saved so the user can try again.

The assessment is AI-generated learning feedback, not a guarantee of perfect grammar or speech recognition. Review voice transcripts before treating a suggested correction as your own mistake.
