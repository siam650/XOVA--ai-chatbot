(() => {
  const conversationsKey = "xova.conversations.v1";
  const activeConversationKey = "xova.activeConversation.v1";

  function readConversations() {
    const stored = window.localStorage.getItem(conversationsKey);
    if (stored === null) {
      return [];
    }

    const conversations = JSON.parse(stored);
    if (!Array.isArray(conversations)) {
      throw new Error("Saved conversation history has an invalid format.");
    }

    return conversations;
  }

  function writeConversations(conversations) {
    window.localStorage.setItem(conversationsKey, JSON.stringify(conversations));
  }

  function create(mode) {
    const timestamp = new Date().toISOString();
    const conversation = {
      id: window.crypto?.randomUUID?.() ?? `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      mode,
      title: "New conversation",
      createdAt: timestamp,
      updatedAt: timestamp,
      endedAt: null,
      messages: [],
      report: null,
    };

    const conversations = readConversations();
    conversations.unshift(conversation);
    writeConversations(conversations);
    return conversation;
  }

  function getAll() {
    return readConversations().sort((first, second) =>
      second.updatedAt.localeCompare(first.updatedAt),
    );
  }

  function get(id) {
    return readConversations().find((conversation) => conversation.id === id) ?? null;
  }

  function save(conversation) {
    const conversations = readConversations();
    const index = conversations.findIndex((item) => item.id === conversation.id);
    if (index === -1) {
      conversations.unshift(conversation);
    } else {
      conversations[index] = conversation;
    }
    writeConversations(conversations);
  }

  function remove(id) {
    const conversations = readConversations().filter((conversation) => conversation.id !== id);
    writeConversations(conversations);
    if (getActiveId() === id) {
      window.localStorage.removeItem(activeConversationKey);
    }
    return conversations;
  }

  function getActiveId() {
    return window.localStorage.getItem(activeConversationKey);
  }

  function setActiveId(id) {
    window.localStorage.setItem(activeConversationKey, id);
  }

  window.XovaConversationStore = {
    create,
    getAll,
    get,
    save,
    remove,
    getActiveId,
    setActiveId,
  };
})();
