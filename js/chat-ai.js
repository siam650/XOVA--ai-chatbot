(() => {
  const modes = {
    "casual-chat": "Casual Chat",
    "interview-practice": "Interview Practice",
    debate: "Debate",
    storytelling: "Storytelling",
  };

  const contextualReplies = [
    { pattern: /\bwill\s+went\b.*\bschool\b/i, reply: "What are you planning to study at school?" },
    { pattern: /\bprogramming\b/i, reply: "That's interesting! What kind of programming projects do you enjoy working on?" },
    { pattern: /\bwatched?\s+(?:a\s+)?movie\b/i, reply: "Nice! What movie did you watch?" },
    { pattern: /\bwhat do you think about learning english\b/i, reply: "I think learning English can open up new ways to connect with people and ideas. What do you enjoy most about learning it?" },
    { pattern: /\blearning english for (?:two|2) years\b/i, reply: "Two years is a lovely amount of time to build a habit. What first inspired you to learn English?" },
    { pattern: /\b(?:school|university)\b/i, reply: "What are you studying there, and what do you enjoy most about it?" },
    { pattern: /\b(?:work|job|office|class)\b/i, reply: "That sounds like a big part of your day. What has been the most interesting part lately?" },
    { pattern: /\b(?:love|enjoy|like)\b/i, reply: "That's lovely! What do you enjoy most about it?" },
    { pattern: /\?$/i, reply: "That’s a thoughtful question. What got you thinking about it?" },
  ];

  const fallbackReplies = [
    "I’m glad you shared that. What part of it would you like to tell me more about?",
    "That sounds interesting. What happened next?",
    "Thanks for telling me. How did that make you feel?",
    "I’d love to hear more. What do you think about it?",
  ];

  const grammarRules = [
    {
      pattern: /\bwill\s+(went)\b/gi,
      replacement: "go",
      category: "Verb forms after helping verbs",
      explanation: 'After “will,” use the base form of the verb.',
      tip: "After will, try the verb in its simple base form: will go, will study, will speak.",
      example: "I will go to school tomorrow.",
    },
    {
      pattern: /\bdidn't\s+(went)\b/gi,
      replacement: "go",
      category: "Verb forms after helping verbs",
      explanation: "Use the base form after “didn't”; the past tense is already carried by did.",
      tip: "After did or didn't, use the base form of the main verb.",
      example: "I didn't go to school yesterday.",
    },
    {
      pattern: /\b(?:have|has)\s+(went)\b/gi,
      replacement: "gone",
      category: "Present perfect verb forms",
      explanation: "The present perfect uses have/has + the past participle, “gone.”",
      tip: "Review irregular verb forms: go, went, gone.",
      example: "She has gone home.",
    },
    {
      pattern: /\byesterday\s+(?:i|we|you|they|he|she)\s+(go)\b/gi,
      replacement: "went",
      category: "Past-tense verb forms",
      explanation: 'Use the past tense when talking about “yesterday.”',
      tip: "When a sentence describes yesterday, check whether each completed action uses a past-tense verb.",
      example: "Yesterday I went to university.",
    },
    {
      pattern: /\b(?:he|she|it)\s+(don't)\b/gi,
      replacement: "doesn't",
      category: "Subject–verb agreement",
      explanation: "Use “doesn't” with he, she, and it.",
      tip: "For he, she, or it in the present negative, use doesn't + the base verb.",
      example: "He doesn't like coffee.",
    },
    {
      pattern: /\bi\s+am\s+(go)\b/gi,
      replacement: "going",
      category: "Present continuous",
      explanation: 'Use the -ing form after “am” in the present continuous tense.',
      tip: "For an action happening now, use am/is/are + a verb ending in -ing.",
      example: "I am going to university now.",
    },
    {
      pattern: /\byesterday\b[^.!?\n]{0,100}?\b(meet)(?=\s+my friend\b)/gi,
      replacement: "met",
      category: "Past-tense verb forms",
      explanation: "Use the past tense for an action that happened yesterday.",
      tip: "Review irregular past-tense verbs such as meet → met.",
      example: "Yesterday I met my friend.",
    },
    {
      pattern: /\bi\s+am\s+(agree)\b/gi,
      replacement: "agree",
      category: "Verb forms after helping verbs",
      explanation: "“Agree” is a verb, so it doesn’t need “am” before it.",
      tip: "Use “I agree” rather than “I am agree.”",
      example: "I agree with your idea.",
    },
    {
      pattern: /\b(?:he|she|it)\s+(go)\b/gi,
      replacement: "goes",
      category: "Subject–verb agreement",
      explanation: "In the present tense, use “goes” with he, she, or it.",
      tip: "In simple present statements, add -s or -es to the verb after he, she, or it.",
      example: "She goes to work by bus.",
    },
    {
      pattern: /\byou\s+(was)\b/gi,
      replacement: "were",
      category: "Past-tense verb forms",
      explanation: 'Use “were” with “you.”',
      tip: "Remember the past forms: I/he/she/it was; you/we/they were.",
      example: "You were right about that.",
    },
    {
      pattern: /\b(?:he|she|it)\s+(like)\b/gi,
      replacement: "likes",
      category: "Subject–verb agreement",
      explanation: "In a simple present statement, add -s to the verb with he, she, or it.",
      tip: "Check the subject: he/she/it usually takes a verb ending in -s in the simple present.",
      example: "She likes listening to music.",
    },
    {
      pattern: /\b(?:he|she|it)\s+(work)\b/gi,
      replacement: "works",
      category: "Subject–verb agreement",
      explanation: "In a simple present statement, add -s to the verb with he, she, or it.",
      tip: "Check the subject: he/she/it usually takes a verb ending in -s in the simple present.",
      example: "He works near the university.",
    },
    {
      pattern: /\b(?:he|she|it)\s+(study)\b/gi,
      replacement: "studies",
      category: "Subject–verb agreement",
      explanation: "For many verbs ending in consonant + y, change y to -ies with he, she, or it.",
      tip: "With consonant + y, change y to -ies for he/she/it: study → studies.",
      example: "She studies English every evening.",
    },
    {
      pattern: /\b(?:he|she|it)\s+(have)\b/gi,
      replacement: "has",
      category: "Subject–verb agreement",
      explanation: "Use “has” with he, she, or it in the present tense.",
      tip: "Remember the irregular present form: I/you/we/they have; he/she/it has.",
      example: "He has a question.",
    },
    {
      pattern: /\b(?:i|you|we|they)\s+(has)\b/gi,
      replacement: "have",
      category: "Subject–verb agreement",
      explanation: "Use “have” with I, you, we, and they.",
      tip: "Remember: I/you/we/they have; he/she/it has.",
      example: "They have a new project.",
    },
  ];

  const expressionRules = [
    { pattern: /\bi\s+very\s+like\b/i, suggestion: "I really like", note: "“Really like” is the more natural collocation." },
    { pattern: /\bi\s+am\s+agree\b/i, suggestion: "I agree", note: "Use the verb “agree” directly." },
    { pattern: /\bdiscuss\s+about\b/i, suggestion: "discuss", note: "“Discuss” takes its topic directly, without “about.”" },
    { pattern: /\bmore\s+better\b/i, suggestion: "better", note: "“Better” already expresses comparison." },
    { pattern: /\bi\s+want\s+that\b/i, suggestion: "I’d like to", note: "“I’d like to” can sound more natural and polite when describing an intention." },
  ];

  const vocabulary = [
    { word: "programming", meaning: "The process of writing instructions for a computer.", example: "I enjoy programming small games." },
    { word: "confident", meaning: "Feeling sure about your ability to do something.", example: "I feel more confident when I practice." },
    { word: "conversation", meaning: "An informal talk between people.", example: "We had a friendly conversation." },
    { word: "university", meaning: "An institution where people study for advanced degrees.", example: "She studies biology at university." },
    { word: "practice", meaning: "Repeated activity that helps you improve a skill.", example: "A little practice each day helps." },
    { word: "improve", meaning: "To become better at something.", example: "I want to improve my speaking." },
    { word: "express", meaning: "To share a thought, idea, or feeling.", example: "He can express his ideas clearly." },
    { word: "opinion", meaning: "A thought or belief about something.", example: "In my opinion, reading is relaxing." },
    { word: "experience", meaning: "Something that happens to you or knowledge gained from doing something.", example: "It was a useful learning experience." },
    { word: "interview", meaning: "A formal conversation used to learn about a person's skills or experience.", example: "I have an interview next week." },
    { word: "story", meaning: "A description of events, real or imagined.", example: "She told us a funny story." },
  ];

  function capitalizeLike(original, replacement) {
    if (original === original.toUpperCase()) return replacement.toUpperCase();
    if (original[0] === original[0].toUpperCase()) {
      return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
  }

  function getMockReply(message, mode, replyIndex) {
    if (/\b(hello|hi|hey|good morning|good evening)\b/i.test(message)) {
      const name = message.match(/\b(?:my name is|i'm|i am)\s+([a-z'-]+)/i)?.[1];
      return name
        ? `Hi, ${name}! It’s lovely to meet you. What would you like to chat about today?`
        : "Hi! It’s lovely to chat with you. How has your day been so far?";
    }

    const contextual = contextualReplies.find((item) => item.pattern.test(message));
    if (contextual) return contextual.reply;

    if (mode === "Interview Practice") {
      if (/\b(weakness|challenge|difficult)\b/i.test(message)) {
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
    return fallbackReplies[replyIndex % fallbackReplies.length];
  }

  function findGrammarMistakes(messages) {
    const mistakes = [];
    const uncertainTranscripts = [];
    messages.forEach((message, messageIndex) => {
      if (message.role !== "user") return;
      if (message.source === "speech" && typeof message.confidence === "number" && message.confidence < 0.55) {
        uncertainTranscripts.push({
          messageIndex,
          text: message.text,
          confidence: message.confidence,
          reason: "Speech recognition reported low confidence. This transcript was excluded from grammar pattern matching.",
        });
        return;
      }
      if (message.source === "speech") {
        uncertainTranscripts.push({
          messageIndex,
          text: message.text,
          confidence: message.confidence ?? null,
          reason: "Voice recognition can substitute words. Verify the transcript before treating a pattern match as a learner error.",
        });
      }
      const sentenceMatches = [];
      grammarRules.forEach((rule) => {
        rule.pattern.lastIndex = 0;
        let match = rule.pattern.exec(message.text);
        while (match) {
          const incorrect = match[1];
          const start = match.index + match[0].lastIndexOf(incorrect);
          sentenceMatches.push({
            start,
            end: start + incorrect.length,
            originalWord: incorrect,
            replacement: capitalizeLike(incorrect, rule.replacement),
            category: rule.category,
            explanation: rule.explanation,
            tip: rule.tip,
            rule: rule.category,
            example: rule.example,
          });
          match = rule.pattern.exec(message.text);
        }
      });

      sentenceMatches.sort((first, second) => first.start - second.start);
      const uniqueMatches = sentenceMatches.filter((match, index) =>
        index === 0 || match.start >= sentenceMatches[index - 1].end,
      );
      let corrected = message.text;
      uniqueMatches.slice().reverse().forEach((match) => {
        corrected = `${corrected.slice(0, match.start)}${match.replacement}${corrected.slice(match.end)}`;
      });
      uniqueMatches.forEach((match) => {
        mistakes.push({
          messageIndex,
          original: message.text,
          corrected,
          originalWord: match.originalWord,
          category: match.category,
          explanation: match.explanation,
          tip: match.tip,
          rule: match.rule,
          example: match.example,
          source: messages[messageIndex].source ?? "text",
          confidence: messages[messageIndex].confidence ?? null,
        });
      });
    });
    return { mistakes, uncertainTranscripts };
  }

  function makeLearningReport(conversation) {
    const messages = conversation.messages.map((message) => ({ ...message }));
    const userMessages = messages.filter((message) => message.role === "user");
    const transcriptText = userMessages.map((message) => message.text).join(" ");
    const { mistakes: grammarMistakes, uncertainTranscripts } = findGrammarMistakes(messages);
    const topics = [
      ["programming", /\b(programming|code|coding|software)\b/i],
      ["movies and entertainment", /\b(movie|film|music|song|book)\b/i],
      ["study and education", /\b(university|school|study|class|english)\b/i],
      ["work and careers", /\b(work|job|office|interview|career)\b/i],
      ["everyday life", /\b(day|family|friend|food|hobby|travel)\b/i],
    ].filter(([, pattern]) => pattern.test(transcriptText)).map(([topic]) => topic);
    const topicSummary = topics.length ? topics.slice(0, 3).join(", ") : "everyday ideas and personal experiences";
    const summary = `You practiced ${conversation.mode.toLowerCase()} in ${userMessages.length} user ${userMessages.length === 1 ? "message" : "messages"}. The conversation touched on ${topicSummary}.`;

    const counts = new Map();
    grammarMistakes.forEach((mistake) => counts.set(mistake.category, (counts.get(mistake.category) ?? 0) + 1));
    const priorityAreas = [...counts.entries()]
      .sort((first, second) => second[1] - first[1])
      .slice(0, 3)
      .map(([area]) => ({
        title: area,
        detail: grammarMistakes.find((mistake) => mistake.category === area)?.tip ?? "Practice this pattern in a few new sentences.",
      }));
    const fallbackAreas = [
      { title: "Add details to your ideas", detail: "Try adding a reason, example, or detail to help your conversation partner follow your thought." },
      { title: "Build a varied vocabulary", detail: "Notice useful words from the conversation and try using them in a new sentence." },
      { title: "Keep expressing your ideas", detail: "Regular, relaxed practice helps you share ideas more naturally over time." },
    ];
    fallbackAreas.forEach((area) => {
      if (priorityAreas.length < 3) priorityAreas.push(area);
    });

    const naturalSuggestions = [];
    userMessages.forEach((message) => {
      expressionRules.forEach((rule) => {
        const match = message.text.match(rule.pattern);
        if (match) {
          naturalSuggestions.push({
            original: match[0],
            suggestion: message.text.replace(rule.pattern, rule.suggestion),
            note: rule.note,
          });
        }
      });
    });
    if (naturalSuggestions.length === 0 && userMessages.length) {
      naturalSuggestions.push({
        original: "I like it.",
        suggestion: "I really enjoy it because it helps me relax.",
        note: "Adding a reason makes a short idea feel more natural and complete.",
      });
    }

    const usefulVocabulary = vocabulary
      .filter((entry) => new RegExp(`\\b${entry.word}\\b`, "i").test(transcriptText))
      .slice(0, 5);
    vocabulary
      .filter((entry) => ["conversation", "express", "confident"].includes(entry.word))
      .forEach((entry) => {
        if (usefulVocabulary.length < 3 && !usefulVocabulary.some((item) => item.word === entry.word)) {
          usefulVocabulary.push(entry);
        }
      });

    const exercises = grammarMistakes.slice(0, 3).map((mistake) => ({
      prompt: `Try writing a new sentence using this pattern: ${mistake.tip}`,
    }));
    const modeExercise = {
      "Interview Practice": "Answer this practice question in 2–3 sentences: What is one skill you are proud of, and when have you used it?",
      Debate: "Share one opinion, give one reason, and add an example to support it.",
      Storytelling: "Describe a small event from your week using a beginning, a middle, and an ending.",
      "Casual Chat": "Write three sentences about something you enjoy and explain why you enjoy it.",
    }[conversation.mode];
    if (exercises.length < 3) exercises.push({ prompt: modeExercise });
    while (exercises.length < 3) {
      exercises.push({ prompt: "Choose one useful new word from this report and write a sentence about your own life with it." });
    }

    const finalSummary = grammarMistakes.length
      ? `You shared ${userMessages.length} messages and practiced keeping the conversation going. Focus next on ${priorityAreas[0].title.toLowerCase()}, and remember that mistakes are a normal part of learning.`
      : `You shared ${userMessages.length} messages and kept practicing your English. Keep building on your ideas with details, new vocabulary, and regular conversation.`;
    const strengths = [
      `You kept the conversation going across ${userMessages.length} message${userMessages.length === 1 ? "" : "s"}.`,
      "You communicated your ideas without needing every sentence to be perfect.",
      "You practiced in the selected mode and created useful material to learn from.",
    ];
    const practiceNext = [
      priorityAreas[0]?.detail ?? "Continue practicing short, clear sentences.",
      "Say a sentence aloud, then listen back and check that the transcript reflects what you meant.",
      "Reuse one vocabulary word from this report in a new sentence.",
    ];

    return {
      generatedAt: new Date().toISOString(),
      summary,
      priorityAreas,
      grammarMistakes,
      uncertainTranscripts,
      naturalSuggestions: naturalSuggestions.slice(0, 5),
      usefulVocabulary,
      exercises,
      strengths,
      practiceNext,
      finalSummary,
      transcript: messages,
      note: "Prototype report: example-based pattern matching, not an AI assessment. It may miss mistakes or flag acceptable wording. Voice transcripts are especially uncertain; review them before treating a match as an error.",
    };
  }

  async function getReply(message, mode, context, replyIndex) {
    const client = window.XovaAIClient;
    if (typeof client?.reply === "function") {
      const reply = await client.reply({ message, mode, context });
      if (typeof reply !== "string" || !reply.trim()) {
        throw new TypeError("The conversation service must return a non-empty reply string.");
      }
      return reply.trim();
    }
    return getMockReply(message, mode, replyIndex);
  }

  async function createLearningReport(conversation) {
    const client = window.XovaAIClient;
    if (typeof client?.createLearningReport === "function") {
      const report = await client.createLearningReport(conversation);
      if (!report || typeof report.summary !== "string" || !Array.isArray(report.grammarMistakes)) {
        throw new TypeError("The learning report service returned an invalid report.");
      }
      return report;
    }
    return makeLearningReport(conversation);
  }

  window.XovaMockAI = {
    modes,
    getMockReply,
    makeLearningReport,
  };
  window.XovaConversationAI = {
    getReply,
    createLearningReport,
  };
})();
