(() => {
  const FRONTEND_REQUEST_TIMEOUT_MS = 55000;
  const modes = {
    "casual-chat": "Casual Chat",
    "interview-practice": "Interview Practice",
    debate: "Debate & Discussion",
    storytelling: "Storytelling",
  };

  function getApiBaseUrl() {
    const configuredUrl = document
      .querySelector('meta[name="xova-api-base-url"]')
      ?.content.trim();
    if (configuredUrl) {
      let url;
      try {
        url = new URL(configuredUrl);
      } catch {
        throw new Error("The Xova backend URL is invalid. Set the xova-api-base-url meta tag to your Render service URL.");
      }

      const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
      const pageIsLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
      if (url.protocol !== "https:" && !(localHost && pageIsLocal && url.protocol === "http:")) {
        throw new Error("The deployed Xova backend URL must use HTTPS.");
      }
      if (localHost && !pageIsLocal) {
        throw new Error("A deployed page cannot use a localhost backend URL. Set the Render service URL in chat.html.");
      }
      if (url.username || url.password || url.search || url.hash) {
        throw new Error("The Xova backend URL must not contain credentials, a query string, or a fragment.");
      }

      const apiPath = url.pathname.replace(/\/+$/, "");
      url.pathname = apiPath.endsWith("/api") ? apiPath : `${apiPath}/api`;
      return url.toString().replace(/\/+$/, "");
    }

    if (["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) {
      return "http://localhost:3000/api";
    }

    throw new Error(
      "The AI backend URL is not configured for this site. Set the xova-api-base-url meta tag in chat.html to your Render service URL, ending in /api.",
    );
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
    try {
      response = await window.fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("The Xova backend took too long to respond. Please try again in a moment.");
      }
      throw new Error(
        "Cannot reach the Xova backend. Check that the Render service is running, the backend URL is correct, and CORS allows this website.",
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
