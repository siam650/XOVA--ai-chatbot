const app = document.querySelector("#chat-app");
const sidebar = document.querySelector("#sidebar");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const sidebarBackdrop = document.querySelector("#sidebar-backdrop");
const sidebarNewChat = document.querySelector("#sidebar-new-chat");
const headerNewChat = document.querySelector("#header-new-chat");
const messageForm = document.querySelector("#message-form");
const messageInput = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const messageList = document.querySelector("#message-list");
const emptyState = document.querySelector("#empty-state");
const conversationScroll = document.querySelector("#conversation-scroll");
const correctionToggle = document.querySelector("#correction-toggle");
const currentMode = document.querySelector("#current-mode");
const modeButtons = [...document.querySelectorAll(".mode-button")];
const mobileLayout = window.matchMedia("(max-width: 700px)");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const correctionRules = [
  {
    pattern: /\byesterday\s+i\s+go\b/i,
    replace: (match) => match.replace(/\bgo\b/i, "went"),
    explanation: "Use the past tense after “yesterday” to describe a completed action.",
  },
  {
    pattern: /\b(?:and\s+)?meet\s+my\s+friend\b/i,
    replace: (match) => match.replace(/\bmeet\b/i, "met"),
    explanation: "“Meet” becomes “met” in the past tense.",
  },
  {
    pattern: /\bi am agree\b/i,
    replace: () => "I agree",
    explanation: "“Agree” is a verb, so it doesn’t need “am” before it.",
  },
  {
    pattern: /\bshe go\b/i,
    replace: (match) => match.replace(/\bgo\b/i, "goes"),
    explanation: "In the present tense, use “goes” with “she,” “he,” or “it.”",
  },
  {
    pattern: /\byou was\b/i,
    replace: (match) => match.replace(/\bwas\b/i, "were"),
    explanation: "Use “were” with “you.”",
  },
];

const genericReplies = [
  "I’m glad you shared that. What part of it would you like to tell me more about?",
  "That sounds interesting. What happened next?",
  "Thanks for telling me. How did that make you feel?",
  "I’d love to hear more. What do you think about it?",
];

const replyCounters = new Map();
let thinkingTimer;
let isThinking = false;

function selectMode(button, updateAddress = false) {
  modeButtons.forEach((modeButton) => {
    const selected = modeButton === button;
    modeButton.classList.toggle("is-active", selected);
    modeButton.setAttribute("aria-pressed", String(selected));
  });

  currentMode.textContent = button.dataset.mode;
  document.title = `${button.dataset.mode} — Xova`;

  if (updateAddress) {
    const query = new URLSearchParams(window.location.search);
    query.set("mode", button.dataset.modeKey);
    window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
  }
}

const requestedMode = new URLSearchParams(window.location.search).get("mode");
const initialMode = modeButtons.find((button) => button.dataset.modeKey === requestedMode);
selectMode(initialMode ?? modeButtons[0]);

function setSidebarOpen(isOpen) {
  app.classList.toggle("sidebar-open", isOpen);
  sidebarToggle.setAttribute("aria-expanded", String(isOpen));
  sidebarToggle.setAttribute(
    "aria-label",
    isOpen ? "Close conversation menu" : "Open conversation menu",
  );
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

  if (
    event.key === "Escape" &&
    document.activeElement === messageInput &&
    sidebarToggle.getAttribute("aria-expanded") !== "true"
  ) {
    messageInput.blur();
  }
});

mobileLayout.addEventListener("change", syncSidebar);
syncSidebar();

function scrollToLatest() {
  conversationScroll.scrollTo({
    top: conversationScroll.scrollHeight,
    behavior: prefersReducedMotion.matches ? "auto" : "smooth",
  });
}

function createAvatar() {
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = "x";
  return avatar;
}

function createMessageRow(text, sender) {
  const row = document.createElement("article");
  row.className = `message-row ${sender === "user" ? "user-message" : "assistant-message"}`;
  row.setAttribute("aria-label", sender === "user" ? "Your message" : "Xova's reply");

  const content = document.createElement("div");
  content.className = "message-content";

  const author = document.createElement("span");
  author.className = "message-author";
  author.textContent = sender === "user" ? "You" : "Xova";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;

  content.append(author, bubble);
  if (sender === "assistant") {
    row.append(createAvatar(), content);
  } else {
    row.append(content);
  }

  return { row, bubble };
}

function collectCorrections(text) {
  const matches = [];

  correctionRules.forEach((rule) => {
    const match = rule.pattern.exec(text);
    if (!match) {
      return;
    }

    const overlaps = matches.some(
      (item) => match.index < item.end && match.index + match[0].length > item.start,
    );
    if (!overlaps) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        original: match[0],
        replacement: rule.replace(match[0]),
        explanation: rule.explanation,
      });
    }
  });

  return matches.sort((first, second) => first.start - second.start);
}

function appendHighlightedText(container, text, corrections) {
  let position = 0;

  corrections.forEach((correction) => {
    container.append(document.createTextNode(text.slice(position, correction.start)));
    const highlighted = document.createElement("mark");
    highlighted.textContent = correction.original;
    container.append(highlighted);
    position = correction.end;
  });

  container.append(document.createTextNode(text.slice(position)));
}

function createGrammarCard(original, corrections) {
  if (corrections.length === 0) {
    return null;
  }

  const corrected = corrections
    .slice()
    .reverse()
    .reduce(
      (sentence, correction) =>
        sentence.slice(0, correction.start) +
        correction.replacement +
        sentence.slice(correction.end),
      original,
    );

  const card = document.createElement("details");
  card.className = "grammar-card";
  card.open = true;
  card.hidden = !correctionToggle.checked;

  const summary = document.createElement("summary");
  summary.className = "grammar-summary";

  const badge = document.createElement("span");
  badge.className = "grammar-badge";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = "✧";

  const title = document.createElement("span");
  title.textContent = "Gentle grammar note";
  summary.append(badge, title);

  const content = document.createElement("div");
  content.className = "grammar-content";

  const originalBlock = document.createElement("div");
  originalBlock.className = "grammar-block";
  const originalLabel = document.createElement("span");
  originalLabel.className = "grammar-label";
  originalLabel.textContent = "Your original";
  const originalSentence = document.createElement("div");
  originalSentence.className = "grammar-sentence";
  appendHighlightedText(originalSentence, original, corrections);
  originalBlock.append(originalLabel, originalSentence);

  const correctedBlock = document.createElement("div");
  correctedBlock.className = "grammar-block";
  const correctedLabel = document.createElement("span");
  correctedLabel.className = "grammar-label";
  correctedLabel.textContent = "A more natural version";
  const correctedSentence = document.createElement("div");
  correctedSentence.className = "grammar-sentence corrected";
  correctedSentence.textContent = corrected;
  correctedBlock.append(correctedLabel, correctedSentence);

  const explanation = document.createElement("p");
  explanation.className = "grammar-explanation";
  explanation.textContent = [...new Set(corrections.map((item) => item.explanation))].join(" ");

  const demoNote = document.createElement("p");
  demoNote.className = "grammar-explanation";
  demoNote.textContent = "Example-based demo — this is not an AI grammar checker.";

  content.append(originalBlock, correctedBlock, explanation, demoNote);
  card.append(summary, content);
  return card;
}

function getMockReply(message, mode) {
  const lowerMessage = message.toLowerCase();
  const firstName = message.match(/\b(?:my name is|i'm|i am)\s+([a-z'-]+)/i)?.[1];

  if (/\b(hello|hi|hey|good morning|good evening)\b/i.test(lowerMessage)) {
    return firstName
      ? `Hi, ${firstName}! It’s lovely to meet you. What would you like to chat about today?`
      : "Hi! It’s lovely to chat with you. How has your day been so far?";
  }

  if (mode === "Interview Practice") {
    if (/\b(weakness|challenge|difficult)\b/i.test(lowerMessage)) {
      return "That’s a thoughtful example. How did you handle the challenge, and what did you learn from it?";
    }
    return "Let’s practice shaping that into a clear interview answer. Could you share a specific example?";
  }

  if (mode === "Debate") {
    return "That’s an interesting point of view. What’s the strongest reason someone might agree with you?";
  }

  if (mode === "Storytelling") {
    return "I’m following along. What happened next, and what detail do you remember most?";
  }

  if (/\b(hobby|hobbies|free time|enjoy|love to|like to)\b/i.test(lowerMessage)) {
    return "That sounds like a lovely way to spend your time. How did you first get interested in it?";
  }

  if (/\b(sad|worried|nervous|stressed|tired|excited|happy|proud)\b/i.test(lowerMessage)) {
    return "Thank you for sharing how you feel. What do you think has been influencing that feeling?";
  }

  if (/\b(work|job|office|study|university|school|class)\b/i.test(lowerMessage)) {
    return "There’s often a lot to talk about with work or studies. What has been the most interesting part lately?";
  }

  if (message.trim().endsWith("?")) {
    return "That’s a good question. What made you curious about it?";
  }

  const nextReply = replyCounters.get(mode) ?? 0;
  replyCounters.set(mode, nextReply + 1);
  return genericReplies[nextReply % genericReplies.length];
}

function showThinking() {
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
  messageList.append(row);
  return row;
}

function updateSendButton() {
  sendButton.disabled = isThinking || messageInput.value.trim().length === 0;
}

function resizeInput() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 150)}px`;
}

function sendMessage(text) {
  const message = text.trim();
  if (!message || isThinking) {
    return;
  }

  emptyState.hidden = true;
  const { row, bubble } = createMessageRow(message, "user");
  messageList.append(row);

  const corrections = collectCorrections(message);
  const grammarCard = createGrammarCard(message, corrections);
  if (grammarCard) {
    bubble.after(grammarCard);
  }

  const selectedMode = currentMode.textContent;
  isThinking = true;
  updateSendButton();
  showThinking();
  scrollToLatest();

  window.clearTimeout(thinkingTimer);
  thinkingTimer = window.setTimeout(() => {
    document.querySelector("#thinking-row")?.remove();
    const reply = getMockReply(message, selectedMode);
    messageList.append(createMessageRow(reply, "assistant").row);
    isThinking = false;
    updateSendButton();
    scrollToLatest();
    messageInput.focus({ preventScroll: true });
  }, 850);
}

messageInput.addEventListener("input", () => {
  resizeInput();
  updateSendButton();
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    messageForm.requestSubmit();
  }
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = messageInput.value;
  if (!message.trim() || isThinking) {
    updateSendButton();
    return;
  }

  sendMessage(message);
  messageInput.value = "";
  resizeInput();
  updateSendButton();
});

document.querySelectorAll(".suggestion").forEach((suggestion) => {
  suggestion.addEventListener("click", () => {
    messageInput.value = suggestion.dataset.prompt;
    resizeInput();
    updateSendButton();
    messageForm.requestSubmit();
  });
});

correctionToggle.addEventListener("change", () => {
  messageList.querySelectorAll(".grammar-card").forEach((card) => {
    card.hidden = !correctionToggle.checked;
  });
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectMode(button, true);
    if (mobileLayout.matches) {
      setSidebarOpen(false);
      sidebarToggle.focus();
    }
  });
});

function resetConversation() {
  window.clearTimeout(thinkingTimer);
  isThinking = false;
  messageList.replaceChildren(emptyState);
  emptyState.hidden = false;
  messageInput.value = "";
  resizeInput();
  updateSendButton();
  conversationScroll.scrollTop = 0;
  messageInput.focus({ preventScroll: true });

  if (mobileLayout.matches) {
    setSidebarOpen(false);
  }
}

sidebarNewChat.addEventListener("click", resetConversation);
headerNewChat.addEventListener("click", resetConversation);
updateSendButton();
