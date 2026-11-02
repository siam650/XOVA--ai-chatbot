
(() => {
  const FRONTEND_REQUEST_TIMEOUT_MS = 120000;

  const modes = {
    "casual-chat": "Casual Chat",
    "interview-practice": "Interview Practice",
    debate: "Debate & Discussion",
    storytelling: "Storytelling",
  };

  // Both local and deployed frontends use the Render backend.
  // To use a local backend, change this to "http://localhost:3000".
  function getApiBaseUrl() {
    return "https://xova-ai-chatbot.onrender.com";
  }

  async function request(endpoint, body, { onTiming } = {}) {
    const baseUrl = getApiBaseUrl();
    const requestUrl = `${baseUrl}${endpoint}`;

    let response;
    const requestStartedAt = performance.now();

    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, FRONTEND_REQUEST_TIMEOUT_MS);

    onTiming?.("Frontend sent API request", 0);

    console.debug("[Xova] API request:", requestUrl);

    try {
      response = await window.fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      console.debug("[Xova] Backend response:", {
        url: requestUrl,
        status: response.status,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(
          `Xova's backend did not respond within ${
            FRONTEND_REQUEST_TIMEOUT_MS / 1000
          } seconds. Please try again.`,
        );
      }

      console.error("[Xova] Network request failed:", error);

      throw new Error(
        "Could not connect to Xova's backend. Check your internet connection and try again.",
      );
    } finally {
      window.clearTimeout(timeoutId);
    }

    onTiming?.(
      "Frontend received API response",
      performance.now() - requestStartedAt,
    );

    let result;

    try {
      result = await response.json();
    } catch {
      if (!response.ok) {
        throw new Error(
          `Xova's backend returned HTTP ${response.status}. Please try again.`,
        );
      }

      throw new Error("Xova's backend returned an invalid response.");
    }

    if (!response.ok) {
      console.error("[Xova] Backend returned an error:", {
        status: response.status,
        response: result,
      });

      throw new Error(
        typeof result?.error === "string"
          ? result.error
          : `Xova's backend could not complete the request (HTTP ${response.status}).`,
      );
    }

    return result;
  }

  async function getReply(message, mode, context, options = {}) {
    const result = await request(
      "/api/chat",
      {
        message,
        mode,
        context,
      },
      options,
    );

    if (typeof result.reply !== "string" || !result.reply.trim()) {
      throw new TypeError(
        "The conversation service returned an invalid reply.",
      );
    }

    return result.reply.trim();
  }

  async function createLearningReport(conversation) {
    const result = await request("/api/assessment", {
      mode: conversation.mode,

      messages: conversation.messages.map(
        ({ role, text, source, confidence }) => ({
          role,
          text,
          ...(role === "user" ? { source, confidence } : {}),
        }),
      ),
    });

    const report = result.report;

    if (
      !report ||
      typeof report.summary !== "string" ||
      !Array.isArray(report.grammarMistakes) ||
      !Array.isArray(report.priorityAreas)
    ) {
      throw new TypeError(
        "The learning report service returned an invalid report.",
      );
    }

    return report;
  }

  window.XovaConversationAI = {
    modes,
    getReply,
    createLearningReport,
  };
})();
