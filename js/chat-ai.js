(() => {
  const FRONTEND_REQUEST_TIMEOUT_MS = 120000;
  const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "::1"];
  const API_BASE_URL = "https://xova-ai-chatbot.onrender.com";
  const isLocalDevelopment = LOCAL_HOSTNAMES.includes(window.location.hostname);
  const modes = {
    "casual-chat": "Casual Chat",
    "interview-practice": "Interview Practice",
    debate: "Debate & Discussion",
    storytelling: "Storytelling",
  };

  function getApiBaseUrl() {
    if (LOCAL_HOSTNAMES.includes(window.location.hostname)) {
      return LOCAL_API_BASE_URL;
    }

    const configuredUrl = document
      .querySelector('meta[name="xova-api-base-url"]')
      ?.content.trim();
    if (!configuredUrl) {
      throw new Error(
        "The AI backend URL is not configured for this site. Set the xova-api-base-url meta tag in chat.html to your Render API URL, ending in /api.",
      );
    }

    let url;
    try {
      url = new URL(configuredUrl);
    } catch {
      throw new Error("The Xova backend URL is invalid. Set the xova-api-base-url meta tag to your Render service URL.");
    }
    if (url.protocol !== "https:") {
      throw new Error("The deployed Xova backend URL must use HTTPS.");
    }
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname.replace(/\/+$/, "") !== "/api"
    ) {
      throw new Error("The Xova backend URL must end in /api and must not contain credentials, a query string, or a fragment.");
    }
    return `${url.origin}/api`;
  }

  async function request(endpoint, body, { onTiming } = {}) {
    const baseUrl = getApiBaseUrl();
    let response;
    const requestStartedAt = performance.now();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      FRONTEND_REQUEST_TIMEOUT_MS,
    );
    onTiming?.("Frontend sent API request", 0);
    if (isLocalDevelopment) {
      console.debug("[Xova voice] API request starts", { endpoint });
    }
    try {
      response = await window.fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (isLocalDevelopment) {
        console.debug("[Xova voice] Backend response received", {
          endpoint,
          status: response.status,
        });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Xova is taking longer than expected to respond. The server may be waking up; please try again shortly.");
      }
      throw new Error(
        "Cannot reach Xova yet. The server may be waking up; please check your connection and try again shortly.",
      );
    } finally {
      window.clearTimeout(timeoutId);
    }
    onTiming?.("Frontend received API response", performance.now() - requestStartedAt);

    let result;
    try {
      result = await response.json();
    } catch {
      if (!response.ok) {
        throw new Error(
          response.status >= 500
            ? `The Xova backend is temporarily unavailable (HTTP ${response.status}). Please try again shortly.`
            : `The Xova backend returned HTTP ${response.status}. Check the backend configuration and try again.`,
        );
      }
      throw new Error("The Xova backend returned an invalid response.");
    }
    if (!response.ok) {
      throw new Error(
        typeof result.error === "string"
          ? result.error
          : `The Xova backend could not complete this request (HTTP ${response.status}).`,
      );
    }
    return result;
  }

  async function getReply(message, mode, context, options = {}) {
    const result = await request("/chat", { message, mode, context }, options);
    if (typeof result.reply !== "string" || !result.reply.trim()) {
      throw new TypeError("The conversation service returned an invalid reply.");
    }
    return result.reply.trim();
  }

  async function createLearningReport(conversation) {
    const result = await request("/assessment", {
      mode: conversation.mode,
      messages: conversation.messages.map(({ role, text, source, confidence }) => ({
        role,
        text,
        ...(role === "user" ? { source, confidence } : {}),
      })),
    });
    const report = result.report;
    if (
      !report ||
      typeof report.summary !== "string" ||
      !Array.isArray(report.grammarMistakes) ||
      !Array.isArray(report.priorityAreas)
    ) {
      throw new TypeError("The learning report service returned an invalid report.");
    }
    return report;
  }

  window.XovaConversationAI = {
    modes,
    getReply,
    createLearningReport,
  };
})();
