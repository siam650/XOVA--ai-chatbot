const express = require("express");
const cors = require("cors");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

require("dotenv").config({ path: path.join(__dirname, ".env") });
const isDevelopment =
  process.env.NODE_ENV === "development" ||
  (!process.env.NODE_ENV && process.env.RENDER !== "true");

const { generateChatReply, generateAssessment } = require("./gemini");

const app = express();
const defaultOrigins = [
  "https://siam650.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://[::1]:5500",
];
const allowedOrigins = (process.env.FRONTEND_ORIGINS || defaultOrigins.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
}));
app.use(express.json({ limit: "256kb" }));

const MAX_MESSAGE_LENGTH = 1200;
const MAX_CONVERSATION_MESSAGES = 120;
const validModes = new Set([
  "Casual Chat",
  "Interview Practice",
  "Debate",
  "Debate & Discussion",
  "Storytelling",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateMode(mode) {
  if (typeof mode !== "string" || !validModes.has(mode)) {
    return "Choose one of Xova's four conversation modes.";
  }
  return null;
}

function validateMessages(messages, { requireUserMessage = false } = {}) {
  if (!Array.isArray(messages) || messages.length > MAX_CONVERSATION_MESSAGES) {
    return "Conversation history must be an array of no more than 120 messages.";
  }
  if (requireUserMessage && !messages.some((message) => message?.role === "user")) {
    return "The conversation must include at least one user message.";
  }

  for (const message of messages) {
    if (
      !isRecord(message) ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.text !== "string" ||
      !message.text.trim() ||
      message.text.length > MAX_MESSAGE_LENGTH
    ) {
      return "Each message needs a user/assistant role and text of 1–1200 characters.";
    }
    if (
      message.confidence !== undefined &&
      message.confidence !== null &&
      (typeof message.confidence !== "number" ||
        message.confidence < 0 ||
        message.confidence > 1)
    ) {
      return "Speech confidence must be a number between 0 and 1.";
    }
  }
  return null;
}

function sendValidationError(res, message) {
  res.status(400).json({ error: message });
}

app.get("/", (req, res) => {
  res.json({ status: "Xova backend is running." });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/chat", async (req, res) => {
  const requestReceivedAt = performance.now();
  if (isDevelopment) console.info("[Xova timing] Backend received chat request");
  const body = req.body;
  if (!isRecord(body)) {
    return sendValidationError(res, "Request body must be a JSON object.");
  }
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > MAX_MESSAGE_LENGTH) {
    return sendValidationError(res, "Message must contain 1–1200 characters.");
  }
  const modeError = validateMode(body.mode);
  if (modeError) return sendValidationError(res, modeError);
  const context = body.context === undefined ? [] : body.context;
  const contextError = validateMessages(context);
  if (contextError) return sendValidationError(res, contextError);

  try {
    const reply = await generateChatReply({
      message: body.message.trim(),
      mode: body.mode,
      context,
      onTiming: (stage, durationMs) => {
        if (isDevelopment) {
          if (typeof durationMs === "number") {
            console.info(`[Xova timing] ${stage}: ${durationMs.toFixed(0)} ms`);
          } else {
            console.info(`[Xova timing] ${stage}`);
          }
        }
      },
    });
    if (isDevelopment) {
      console.info(
        `[Xova timing] Backend completed chat request: ${(performance.now() - requestReceivedAt).toFixed(0)} ms`,
      );
    }
    return res.json({ reply });
  } catch (error) {
    return handleAiError(res, error, "Chat generation");
  }
});

app.post("/api/assessment", async (req, res) => {
  const body = req.body;
  if (!isRecord(body)) {
    return sendValidationError(res, "Request body must be a JSON object.");
  }
  const modeError = validateMode(body.mode);
  if (modeError) return sendValidationError(res, modeError);
  const messagesError = validateMessages(body.messages, { requireUserMessage: true });
  if (messagesError) return sendValidationError(res, messagesError);

  try {
    const report = await generateAssessment({
      mode: body.mode,
      messages: body.messages,
    });
    return res.json({ report });
  } catch (error) {
    return handleAiError(res, error, "Learning report generation");
  }
});

function handleAiError(res, error, operation) {
  const providerDetails = getProviderErrorDetails(error);
  const { providerStatus, providerCode, providerMessage } = providerDetails;
  let failure;

  if (error?.code === "AI_NOT_CONFIGURED") {
    failure = {
      status: 503,
      code: "AI_NOT_CONFIGURED",
      retryable: false,
      error: "The AI service is not configured. Add GEMINI_API_KEY to the backend environment.",
    };
  } else if (error?.code === "AI_CONFIGURATION_ERROR") {
    failure = {
      status: 503,
      code: "AI_CONFIGURATION_ERROR",
      retryable: false,
      error: "The AI service configuration is invalid. Check the backend timeout and model settings.",
    };
  } else if (providerStatus === 429) {
    failure = {
      status: 429,
      code: "AI_RATE_LIMITED",
      retryable: true,
      error: "The AI service is receiving too many requests. Please wait a moment and try again.",
    };
  } else if (
    providerStatus === 408 ||
    providerStatus === 504 ||
    ["AbortError", "TimeoutError"].includes(error?.name) ||
    /timed? ?out|timeout/i.test(providerMessage)
  ) {
    failure = {
      status: 504,
      code: "AI_TIMEOUT",
      retryable: true,
      error: "The AI service took too long to respond. Please try again.",
    };
  } else if ([401, 403].includes(providerStatus)) {
    failure = {
      status: 502,
      code: "AI_AUTHENTICATION_ERROR",
      retryable: false,
      error: "The AI provider rejected the backend credentials or permissions. Please try again later.",
    };
  } else if (providerStatus === 404) {
    failure = {
      status: 502,
      code: "AI_MODEL_UNAVAILABLE",
      retryable: false,
      error: "The configured AI model is unavailable. Please check the backend model setting.",
    };
  } else if (providerStatus === 400) {
    failure = {
      status: 400,
      code: "AI_REQUEST_REJECTED",
      retryable: false,
      error: "The AI provider rejected this request. Please check the request and model configuration.",
    };
  } else if ([500, 502, 503].includes(providerStatus)) {
    failure = {
      status: providerStatus,
      code: "AI_UPSTREAM_ERROR",
      retryable: true,
      error: "The AI provider is temporarily unavailable. Please try again shortly.",
    };
  } else if (providerStatus !== null && providerStatus >= 500) {
    failure = {
      status: 502,
      code: "AI_UPSTREAM_ERROR",
      retryable: true,
      error: "The AI provider could not complete this request. Please try again shortly.",
    };
  } else if (["TypeError", "FetchError", "ConnectTimeoutError"].includes(error?.name)) {
    failure = {
      status: 503,
      code: "AI_NETWORK_ERROR",
      retryable: true,
      error: "The server could not connect to the AI provider. Please try again shortly.",
    };
  } else {
    failure = {
      status: 500,
      code: "AI_INTERNAL_ERROR",
      retryable: false,
      error: "Xova could not complete this AI request. Please try again, and contact support if it continues.",
    };
  }

  if (isDevelopment) {
    console.error("[Xova diagnostics] AI request failed", {
      operation,
      errorName: typeof error?.name === "string" ? error.name : "Error",
      errorMessage: providerMessage || "No provider message available.",
      providerStatus,
      providerCode,
      model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
    });
  } else {
    console.error(
      `${operation} failed (${failure.code}${providerStatus === null ? "" : `, provider status ${providerStatus}`}).`,
    );
  }
  return res.status(failure.status).json({
    error: failure.error,
    code: failure.code,
    retryable: failure.retryable,
    ...(providerStatus === null ? {} : { providerStatus }),
  });
}

function getProviderErrorDetails(error) {
  let providerStatus = Number.isInteger(error?.status)
    ? error.status
    : Number.isInteger(error?.statusCode)
      ? error.statusCode
      : null;
  let providerCode =
    typeof error?.code === "string" && !error.code.startsWith("AI_")
      ? error.code
      : null;
  let providerMessage = typeof error?.message === "string" ? error.message : "";

  try {
    const parsed = JSON.parse(providerMessage);
    const details = parsed?.error;
    if (details && typeof details === "object") {
      if (providerStatus === null && Number.isInteger(details.code)) {
        providerStatus = details.code;
      }
      if (typeof details.status === "string") {
        providerCode = details.status;
      } else if (typeof details.code === "string") {
        providerCode = details.code;
      }
      if (typeof details.message === "string") {
        providerMessage = details.message;
      }
    }
  } catch {
    // SDK messages are not always JSON.
  }

  providerMessage = providerMessage
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:key|token|access_token)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|authorization|access[_-]?token)\s*[:=]\s*)["']?[^"',\s}]+/gi, "$1[REDACTED]");

  return { providerStatus, providerCode, providerMessage };
}

app.use((req, res) => {
  res.status(404).json({
    error: "The requested API endpoint was not found.",
    code: "NOT_FOUND",
    retryable: false,
  });
});

app.use((error, req, res, next) => {
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Request body must contain valid JSON.",
      code: "INVALID_JSON",
      retryable: false,
    });
  }
  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request body is too large.",
      code: "REQUEST_TOO_LARGE",
      retryable: false,
    });
  }

  console.error(`Request failed (${error?.name || "unknown error"}).`);
  return res.status(500).json({
    error: "The server could not process this request. Please try again.",
    code: "INTERNAL_SERVER_ERROR",
    retryable: true,
  });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a whole number between 1 and 65535.");
}

app.listen(port, () => {
  console.log(`Xova server running on port ${port}`);
});