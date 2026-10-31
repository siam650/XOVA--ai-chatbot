const app = document.querySelector("#chat-app");
const sidebar = document.querySelector("#sidebar");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const sidebarBackdrop = document.querySelector("#sidebar-backdrop");
const sidebarNewChat = document.querySelector("#sidebar-new-chat");
const headerNewChat = document.querySelector("#header-new-chat");
const historyList = document.querySelector("#history-list");
const historyEmpty = document.querySelector("#history-empty");
const messageForm = document.querySelector("#message-form");
const messageInput = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const messageList = document.querySelector("#message-list");
const emptyState = document.querySelector("#empty-state");
const conversationScroll = document.querySelector("#conversation-scroll");
const currentMode = document.querySelector("#current-mode");
const endChatButton = document.querySelector("#end-chat-button");
const viewReportButton = document.querySelector("#view-report-button");
const reportDialog = document.querySelector("#report-dialog");
const reportClose = document.querySelector("#report-close");
const reportContent = document.querySelector("#report-content");
const storageNotice = document.querySelector("#storage-notice");
const voicePanel = document.querySelector("#voice-panel");
const voiceButton = document.querySelector("#voice-button");
const voiceButtonLabel = document.querySelector("#voice-button-label");
const voiceStatus = document.querySelector("#voice-status");
const liveTranscript = document.querySelector("#live-transcript");
const muteVoiceButton = document.querySelector("#mute-voice-button");
const stopSpeakingButton = document.querySelector("#stop-speaking-button");
const mobileLayout = window.matchMedia("(max-width: 700px)");

let conversation;
let thinkingTimer;
let isThinking = false;
let replyIndex = 0;
let noticeTimer;
let voiceStatusText = "Voice ready · tap to speak";
let isEnding = false;
let voiceRecognitionError = false;

function showNotice(message) {
  storageNotice.textContent = message;
  storageNotice.hidden = false;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    storageNotice.hidden = true;
  }, 6000);
}

function makeTemporaryConversation(mode) {
  const timestamp = new Date().toISOString();
  return {
    id: `temporary-${Date.now()}`,
    mode,
    title: "New conversation",
    createdAt: timestamp,
    updatedAt: timestamp,
    endedAt: null,
    messages: [],
    report: null,
  };
}

function saveConversation() {
  conversation.updatedAt = new Date().toISOString();
  try {
    window.XovaConversationStore.save(conversation);
    window.XovaConversationStore.setActiveId(conversation.id);
  } catch (error) {
    console.error("Could not save this conversation.", error);
    showNotice("This conversation could not be saved in this browser. Your latest changes may not survive a refresh.");
  }
}

function updateAddress() {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("conversation", conversation.id);
  window.history.replaceState(null, "", url);
}

function selectConversation(nextConversation) {
  window.XovaVoice.stopAll();
  isEnding = false;
  liveTranscript.textContent = "";
  conversation = nextConversation;
  replyIndex = conversation.messages.filter((message) => message.role === "assistant").length;
  try {
    window.XovaConversationStore.setActiveId(conversation.id);
  } catch (error) {
    console.error("Could not set the active conversation.", error);
    showNotice("Your browser could not remember the selected conversation.");
  }
  updateAddress();
  renderConversation();
  renderHistory();
  if (mobileLayout.matches) {
    setSidebarOpen(false);
    sidebarToggle.focus();
  }
}

function startConversation(mode) {
  window.XovaVoice.stopAll();
  isEnding = false;
  try {
    selectConversation(window.XovaConversationStore.create(mode));
  } catch (error) {
    console.error("Could not create a saved conversation.", error);
    showNotice("Browser storage is unavailable. This conversation is temporary and may be lost.");
    selectConversation(makeTemporaryConversation(mode));
  }
}

function initializeConversation() {
  const params = new URLSearchParams(window.location.search);
  const conversationId = params.get("conversation");
  const requestedMode = params.get("mode");

  if (conversationId) {
    try {
      const saved = window.XovaConversationStore.get(conversationId);
      if (saved) {
        conversation = saved;
      } else {
        showNotice("That saved conversation could not be found. A new conversation was started.");
      }
    } catch (error) {
      console.error("Could not load the saved conversation.", error);
      showNotice("Saved history could not be read. A temporary conversation was started.");
    }
  }

  if (!conversation && requestedMode && window.XovaMockAI.modes[requestedMode]) {
    try {
      conversation = window.XovaConversationStore.create(window.XovaMockAI.modes[requestedMode]);
    } catch (error) {
      console.error("Could not create a saved conversation.", error);
      showNotice("Browser storage is unavailable. This conversation is temporary and may be lost.");
      conversation = makeTemporaryConversation(window.XovaMockAI.modes[requestedMode]);
    }
  }

  if (!conversation) {
    try {
      const activeId = window.XovaConversationStore.getActiveId();
      conversation = activeId ? window.XovaConversationStore.get(activeId) : null;
    } catch (error) {
      console.error("Could not restore the last conversation.", error);
      showNotice("Saved history could not be read. A temporary conversation was started.");
    }
  }

  if (!conversation) {
    startConversation("Casual Chat");
    return;
  }

  try {
    window.XovaConversationStore.setActiveId(conversation.id);
  } catch (error) {
    console.error("Could not restore the active conversation.", error);
    showNotice("Your browser could not remember the selected conversation.");
  }
  updateAddress();
  renderConversation();
  renderHistory();
}

function createAvatar() {
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = "x";
  return avatar;
}

function createMessageRow(message) {
  const isUser = message.role === "user";
  const row = document.createElement("article");
  row.className = `message-row ${isUser ? "user-message" : "assistant-message"}`;
  row.setAttribute("aria-label", isUser ? "Your message" : "Xova's reply");

  const content = document.createElement("div");
  content.className = "message-content";
  const author = document.createElement("span");
  author.className = "message-author";
  author.textContent = isUser ? "You" : "Xova";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = message.text;
  content.append(author, bubble);
  if (isUser && message.source === "speech") {
    const source = document.createElement("span");
    source.className = "transcript-source";
    source.textContent =
      typeof message.confidence === "number" && message.confidence < 0.55
        ? "Voice transcript · recognition may be uncertain"
        : "Voice transcript · check wording if it seems inaccurate";
    if (typeof message.confidence === "number" && message.confidence < 0.55) {
      source.classList.add("is-uncertain");
    }
    content.append(source);
  }
  if (!isUser) row.append(createAvatar());
  row.append(content);
  return row;
}

function createThinkingRow() {
  const row = document.createElement("div");
  row.className = "thinking-row";
  row.id = "thinking-row";
  row.setAttribute("role", "status");
  row.setAttribute("aria-label", "Xova is thinking");
  const bubble = document.createElement("span");
  bubble.className = "thinking-bubble";
  bubble.append(document.createTextNode("Xova is thinking"));
  const dots = document.createElement("span");
  dots.className = "thinking-dots";
  dots.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 3; index += 1) {
    dots.append(document.createElement("span"));
  }
  bubble.append(dots);
  row.append(createAvatar(), bubble);
  return row;
}

function renderConversation() {
  window.clearTimeout(thinkingTimer);
  isThinking = false;
  voiceStatusText = conversation.endedAt ? "Conversation complete" : getVoiceReadyStatus();
  currentMode.textContent = conversation.mode;
  document.title = `${conversation.mode} — Xova`;
  messageList.replaceChildren(emptyState);
  emptyState.hidden = conversation.messages.length > 0;
  conversation.messages.forEach((message) => messageList.append(createMessageRow(message)));
  messageInput.value = "";
  resizeInput();
  updateControls();
  scrollToLatest();
}

function renderHistory() {
  let conversations;
  try {
    conversations = window.XovaConversationStore.getAll();
  } catch (error) {
    console.error("Could not read conversation history.", error);
    showNotice("Saved history could not be loaded from this browser.");
    historyList.replaceChildren();
    historyEmpty.hidden = false;
    return;
  }

  historyList.replaceChildren();
  conversations.forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-item";
    row.classList.toggle("is-selected", item.id === conversation.id);
    const selectButton = document.createElement("button");
    selectButton.className = "history-select";
    selectButton.type = "button";
    selectButton.setAttribute("aria-pressed", String(item.id === conversation.id));
    selectButton.setAttribute("aria-label", `${item.title}, ${item.mode}${item.report ? ", completed" : ""}`);
    const title = document.createElement("span");
    title.className = "history-title";
    title.textContent = item.title;
    const mode = document.createElement("span");
    mode.className = "history-mode";
    const date = new Date(item.createdAt);
    const dateText = Number.isNaN(date.getTime())
      ? ""
      : ` · ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    mode.textContent = `${item.mode}${dateText}`;
    selectButton.append(title, mode);
    selectButton.addEventListener("click", () => selectConversation(item));

    const deleteButton = document.createElement("button");
    deleteButton.className = "history-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Delete ${item.title}`);
    deleteButton.title = "Delete conversation";
    selectButton.disabled = isThinking;
    deleteButton.disabled = isThinking;
    deleteButton.addEventListener("click", () => deleteConversation(item));
    row.append(selectButton, deleteButton);
    historyList.append(row);
  });
  historyEmpty.hidden = conversations.length > 0;
}

function deleteConversation(item) {
  if (!window.confirm(`Delete “${item.title}” and its learning report? This cannot be undone.`)) {
    return;
  }

  try {
    window.XovaConversationStore.remove(item.id);
  } catch (error) {
    console.error("Could not delete the conversation.", error);
    showNotice("This conversation could not be deleted from browser storage.");
    return;
  }

  if (item.id === conversation.id) {
    startConversation(conversation.mode);
  } else {
    renderHistory();
  }
}

function scrollToLatest() {
  conversationScroll.scrollTop = conversationScroll.scrollHeight;
}

function resizeInput() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 150)}px`;
}

function getVoiceReadyStatus() {
  if (!window.XovaVoice.isRecognitionSupported) {
    return "Speech recognition unsupported · type messages instead";
  }
  if (!window.XovaVoice.isSpeechSynthesisSupported) {
    return "Voice ready · playback unsupported";
  }
  return "Voice ready · tap to speak";
}

function updateControls() {
  const hasMessages = conversation.messages.some((message) => message.role === "user");
  const ended = Boolean(conversation.endedAt);
  messageInput.disabled = ended || isEnding;
  sendButton.disabled = ended || isEnding || isThinking || messageInput.value.trim().length === 0;
  sidebarNewChat.disabled = isThinking || isEnding;
  headerNewChat.disabled = isThinking || isEnding;
  endChatButton.disabled =
    !hasMessages || isThinking || ended || isEnding || window.XovaVoice.isStarting;
  endChatButton.hidden = ended;
  viewReportButton.hidden = !conversation.report;
  voiceButton.disabled =
    ended || isEnding || window.XovaVoice.isStarting || !window.XovaVoice.isRecognitionSupported;
  voiceButton.setAttribute("aria-pressed", String(window.XovaVoice.isListening));
  voiceButton.setAttribute(
    "aria-label",
    window.XovaVoice.isListening ? "Stop listening" : "Start speaking",
  );
  voiceButton.classList.toggle("is-listening", window.XovaVoice.isListening);
  voiceButtonLabel.textContent = window.XovaVoice.isListening ? "Stop" : "Speak";
  muteVoiceButton.disabled = ended || !window.XovaVoice.isSpeechSynthesisSupported;
  muteVoiceButton.setAttribute("aria-pressed", String(window.XovaVoice.isMuted));
  muteVoiceButton.textContent = window.XovaVoice.isMuted ? "Unmute voice" : "Mute voice";
  stopSpeakingButton.disabled = ended || !window.XovaVoice.isSpeaking;
  voicePanel.classList.toggle("is-listening", window.XovaVoice.isListening);
  voicePanel.classList.toggle("is-speaking", window.XovaVoice.isSpeaking);
  voiceStatus.textContent = voiceStatusText;
  historyList.querySelectorAll("button").forEach((button) => {
    button.disabled = isThinking || isEnding;
  });
  messageForm.classList.toggle("is-ended", ended);
  const status = document.querySelector(".ready-status");
  status.lastChild.textContent = ended ? " Conversation complete" : " Ready to practice";
}

function updateConversationTitle() {
  if (conversation.title !== "New conversation") return;
  const firstUserMessage = conversation.messages.find((message) => message.role === "user");
  if (!firstUserMessage) return;
  conversation.title = firstUserMessage.text.replace(/\s+/g, " ").trim().slice(0, 38);
  if (firstUserMessage.text.length > 38) conversation.title += "…";
}

function sendMessage(text, metadata = {}) {
  const cleanText = text.trim();
  if (!cleanText || isThinking || conversation.endedAt) return;

  if (window.XovaVoice.isListening && metadata.source !== "speech") {
    window.XovaVoice.abortListening();
    liveTranscript.textContent = "";
    voiceStatusText = "Voice input stopped";
  }
  emptyState.hidden = true;
  conversation.messages.push({
    role: "user",
    text: cleanText,
    timestamp: new Date().toISOString(),
    source: metadata.source ?? "text",
    confidence: metadata.confidence ?? null,
  });
  updateConversationTitle();
  saveConversation();
  messageList.append(createMessageRow(conversation.messages.at(-1)));

  isThinking = true;
  updateControls();
  renderHistory();
  messageList.append(createThinkingRow());
  scrollToLatest();

  thinkingTimer = window.setTimeout(async () => {
    document.querySelector("#thinking-row")?.remove();
    let reply;
    try {
      reply = await window.XovaConversationAI.getReply(
        cleanText,
        conversation.mode,
        conversation.messages,
        replyIndex,
      );
    } catch (error) {
      console.error("Could not generate Xova's reply.", error);
      isThinking = false;
      voiceStatusText = "Xova could not respond · try again";
      showNotice("Xova could not generate a reply. Your message is saved; you can send another one.");
      updateControls();
      if (isEnding) finishConversation();
      return;
    }
    replyIndex += 1;
    conversation.messages.push({
      role: "assistant",
      text: reply,
      timestamp: new Date().toISOString(),
    });
    isThinking = false;
    saveConversation();
    messageList.append(createMessageRow(conversation.messages.at(-1)));
    if (!window.XovaVoice.isMuted && !isEnding) {
      voiceStatusText = "Xova is speaking";
      updateControls();
      window.XovaVoice.speak(reply, {
        onStart: () => {
          voiceStatusText = "Xova is speaking";
          updateControls();
        },
        onEnd: () => {
          voiceStatusText = getVoiceReadyStatus();
          updateControls();
        },
        onError: () => {
          voiceStatusText = "Voice playback unavailable · read the transcript below";
          updateControls();
        },
        onUnavailable: () => {
          voiceStatusText = "Voice playback unsupported · read Xova’s written reply";
          updateControls();
        },
      });
    } else {
      voiceStatusText = "Voice muted · read Xova’s reply below";
    }
    updateControls();
    renderHistory();
    scrollToLatest();
    if (isEnding) {
      finishConversation();
      return;
    }
    if (!mobileLayout.matches) messageInput.focus({ preventScroll: true });
  }, 850);
}

function setSidebarOpen(isOpen) {
  app.classList.toggle("sidebar-open", isOpen);
  sidebarToggle.setAttribute("aria-expanded", String(isOpen));
  sidebarToggle.setAttribute("aria-label", isOpen ? "Close conversation menu" : "Open conversation menu");
  sidebar.inert = mobileLayout.matches && !isOpen;
  sidebarBackdrop.hidden = !isOpen || !mobileLayout.matches;
}

function syncSidebar() {
  if (!mobileLayout.matches) {
    app.classList.remove("sidebar-open");
    sidebar.inert = false;
    sidebarBackdrop.hidden = true;
    sidebarToggle.setAttribute("aria-expanded", "false");
    sidebarToggle.setAttribute("aria-label", "Open conversation menu");
    return;
  }
  setSidebarOpen(false);
}

function createNewConversation() {
  if (!isThinking) startConversation(conversation.mode);
}

function appendReportSection(title, items = [], renderItem) {
  const section = document.createElement("section");
  section.className = "report-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const list = document.createElement("ul");
  items.forEach((item) => list.append(renderItem(item)));
  section.append(heading, list);
  reportContent.append(section);
  return section;
}

function reportListItem(title, detail, extraLabel, extraText) {
  const item = document.createElement("li");
  const heading = document.createElement("strong");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = detail;
  item.append(heading, paragraph);
  if (extraLabel && extraText) {
    const extra = document.createElement("p");
    extra.className = "report-extra";
    extra.textContent = `${extraLabel}: ${extraText}`;
    item.append(extra);
  }
  return item;
}

function renderReport(report) {
  reportContent.replaceChildren();
  const note = document.createElement("p");
  note.className = "report-note";
  note.textContent = report.note ?? "Saved prototype learning report.";
  const summary = document.createElement("p");
  summary.className = "report-summary";
  summary.textContent = report.summary;
  reportContent.append(note, summary);

  reportContent.append(
    createReportTextSection(
      "What you did well",
      report.strengths ?? ["You completed this practice conversation and kept sharing ideas."],
    ),
  );
  appendReportSection("Three priority areas", report.priorityAreas ?? [], (area) =>
    reportListItem(area.title, area.detail),
  );
  appendReportSection("Voice transcripts to review", report.uncertainTranscripts ?? [], (item) =>
    reportListItem(
      `“${item.text}”`,
      item.reason,
      "Recognition confidence",
      typeof item.confidence === "number"
        ? `${Math.round(item.confidence * 100)}% · a confidence score cannot confirm that every word was transcribed correctly`
        : "Not provided by the browser · verify the transcript against what you said",
    ),
  );
  const grammarSection = appendReportSection("Grammar to practice", report.grammarMistakes ?? [], (mistake) =>
    reportListItem(
      mistake.original,
      `Suggested correction: ${mistake.corrected}`,
      "Explanation",
      mistake.explanation,
    ),
  );
  (report.grammarMistakes ?? []).forEach((mistake, index) => {
    const item = grammarSection.querySelectorAll("li")[index];
    if (!item) return;
    const rule = document.createElement("p");
    rule.className = "report-rule";
    rule.textContent = `Grammar rule: ${mistake.rule ?? mistake.category ?? "Example-based pattern"}. How to avoid it: ${mistake.tip ?? "Review the suggested correction and practice a similar sentence."}`;
    const example = document.createElement("p");
    example.className = "report-example";
    example.textContent = `Correct example: ${mistake.example ?? mistake.corrected}`;
    if (mistake.source === "speech") {
      const source = document.createElement("p");
      source.className = "report-extra";
      source.textContent =
        typeof mistake.confidence === "number"
          ? `Voice transcript confidence: ${Math.round(mistake.confidence * 100)}%. Verify the transcript before treating this as an error.`
          : "Voice transcript: recognition confidence was not provided. Verify the transcript before treating this as an error.";
      item.append(source);
    }
    item.append(rule, example);
  });
  if (!(report.grammarMistakes ?? []).length) {
    const message = document.createElement("p");
    message.className = "report-empty-note";
    message.textContent = "No matching examples from the demo grammar patterns appeared in this conversation.";
    reportContent.append(message);
  }
  appendReportSection("More natural expressions", report.naturalSuggestions ?? [], (suggestion) =>
    reportListItem(suggestion.original, `Try: ${suggestion.suggestion}`, "Note", suggestion.note),
  );
  appendReportSection("Useful vocabulary", report.usefulVocabulary ?? [], (entry) =>
    reportListItem(entry.word, entry.meaning, "Example", entry.example),
  );
  const exercises = (report.exercises ?? []).map((exercise, index) =>
    reportListItem(`Exercise ${index + 1}`, exercise.prompt),
  );
  appendReportSection("Short personalized exercises", exercises, (exercise) => exercise);
  reportContent.append(
    createReportTextSection(
      "What to practice next",
      report.practiceNext ?? ["Keep practicing in short, relaxed conversations."],
    ),
  );

  const final = document.createElement("section");
  final.className = "report-final";
  const finalHeading = document.createElement("h3");
  finalHeading.textContent = "Your learning summary";
  const finalText = document.createElement("p");
  finalText.textContent = report.finalSummary;
  final.append(finalHeading, finalText);
  reportContent.append(final);
}

function createReportTextSection(title, items) {
  const section = document.createElement("section");
  section.className = "report-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const list = document.createElement("ul");
  items.forEach((text) => list.append(reportListItem(text, "")));
  section.append(heading, list);
  return section;
}

function endConversation() {
  if ((endChatButton.disabled && !window.XovaVoice.isListening) || isEnding) return;
  if (window.XovaVoice.isListening) {
    isEnding = true;
    voiceStatusText = "Finishing the current transcript…";
    window.XovaVoice.cancelSpeech();
    updateControls();
    window.XovaVoice.stopListening();
    return;
  }
  finishConversation();
}

async function finishConversation() {
  if (isThinking) {
    isEnding = true;
    voiceStatusText = "Finishing Xova’s reply before creating your report…";
    updateControls();
    return;
  }
  try {
    isEnding = true;
    window.XovaVoice.stopAll();
    voiceStatusText = "Preparing your learning report…";
    updateControls();
    const endedAt = new Date().toISOString();
    const report = await window.XovaConversationAI.createLearningReport(conversation);
    conversation.endedAt = endedAt;
    conversation.report = report;
    isEnding = false;
    voiceStatusText = "Conversation complete";
    saveConversation();
    renderConversation();
    renderHistory();
    openReport();
  } catch (error) {
    isEnding = false;
    console.error("Could not generate the learning report.", error);
    showNotice("The learning report could not be generated. Your conversation is still available.");
    voiceStatusText = "Report generation failed · your conversation is saved";
    updateControls();
  }
}

function openReport() {
  if (!conversation.report) return;
  renderReport(conversation.report);
  if (!reportDialog.open) reportDialog.showModal();
}

sidebarToggle.addEventListener("click", () => {
  setSidebarOpen(sidebarToggle.getAttribute("aria-expanded") !== "true");
});
sidebarBackdrop.addEventListener("click", () => {
  setSidebarOpen(false);
  sidebarToggle.focus();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && sidebarToggle.getAttribute("aria-expanded") === "true") {
    setSidebarOpen(false);
    sidebarToggle.focus();
  }
  if (event.key === "Escape" && document.activeElement === messageInput) messageInput.blur();
});
mobileLayout.addEventListener("change", syncSidebar);

sidebarNewChat.addEventListener("click", createNewConversation);
headerNewChat.addEventListener("click", createNewConversation);
endChatButton.addEventListener("click", endConversation);
viewReportButton.addEventListener("click", openReport);
reportClose.addEventListener("click", () => reportDialog.close());
reportDialog.addEventListener("click", (event) => {
  if (event.target === reportDialog) reportDialog.close();
});
reportDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  reportDialog.close();
});
reportDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    reportDialog.close();
  }
});

function updateVoiceActivity() {
  if (window.XovaVoice.isListening) {
    voiceStatusText = "Listening · speak naturally";
  } else if (window.XovaVoice.isSpeaking) {
    voiceStatusText = "Xova is speaking";
  }
  updateControls();
}

voiceButton.addEventListener("click", () => {
  if (window.XovaVoice.isListening) {
    voiceStatusText = "Finishing your sentence…";
    window.XovaVoice.stopListening();
    updateControls();
    return;
  }

  liveTranscript.textContent = "";
  voiceRecognitionError = false;
  voiceStatusText = "Requesting microphone access…";
  updateControls();
  const started = window.XovaVoice.startListening({
    onListening: updateVoiceActivity,
    onInterim: (text) => {
      liveTranscript.textContent = text ? `Hearing: ${text}` : "";
    },
    onTranscript: ({ text, confidence, source }) => {
      liveTranscript.textContent = `You said: ${text}`;
      sendMessage(text, { source, confidence });
    },
    onRecognitionEnd: () => {
      if (voiceRecognitionError) {
        voiceRecognitionError = false;
        if (!isEnding) return;
      }
      if (isEnding && !isThinking) {
        finishConversation();
      } else if (!isThinking && !conversation.endedAt) {
        voiceStatusText = getVoiceReadyStatus();
        updateControls();
      }
    },
    onError: ({ message }) => {
      voiceRecognitionError = true;
      voiceStatusText = message;
      liveTranscript.textContent = "";
      updateControls();
      showNotice(message);
    },
  });
  if (!started && window.XovaVoice.isRecognitionSupported) {
    voiceStatusText = "Could not start microphone · check browser permissions";
    updateControls();
  }
});

muteVoiceButton.addEventListener("click", () => {
  window.XovaVoice.setMuted(!window.XovaVoice.isMuted);
  voiceStatusText = window.XovaVoice.isMuted ? "Voice muted · replies remain visible" : "Voice playback enabled";
  updateControls();
});

stopSpeakingButton.addEventListener("click", () => {
  window.XovaVoice.cancelSpeech();
  voiceStatusText = "Playback stopped · transcript remains available";
  updateControls();
});

window.addEventListener("pagehide", () => window.XovaVoice.stopAll());
messageInput.addEventListener("input", updateControls);
messageInput.addEventListener("input", resizeInput);
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    messageForm.requestSubmit();
  }
});
messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (messageInput.value.trim()) sendMessage(messageInput.value);
  messageInput.value = "";
  resizeInput();
  updateControls();
});
document.querySelectorAll(".suggestion").forEach((suggestion) => {
  suggestion.addEventListener("click", () => sendMessage(suggestion.dataset.prompt));
});

syncSidebar();
initializeConversation();
