(() => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasSpeechSynthesis =
    typeof window.speechSynthesis?.speak === "function" &&
    typeof window.speechSynthesis.cancel === "function" &&
    typeof window.SpeechSynthesisUtterance === "function";

  const DEFAULT_END_OF_SPEECH_SILENCE_MS = 2500;
  const RECOGNITION_RESTART_DELAY_MS = 180;
  let recognition = null;
  let recognitionStarting = false;
  let recognitionActive = false;
  let voiceSession = null;
  let endOfSpeechSilenceMs = DEFAULT_END_OF_SPEECH_SILENCE_MS;
  let isMuted = false;
  let isSpeaking = false;

  function notify(handlers, name, value) {
    handlers[name]?.(value);
  }

  function getFinalTranscript(session) {
    return session.finalResults.map((result) => result.text).filter(Boolean).join(" ").trim();
  }

  function getFinalConfidence(session) {
    const scores = session.finalResults
      .map((result) => result.confidence)
      .filter(Number.isFinite);
    return scores.length ? Math.min(...scores) : null;
  }

  function getVisibleTranscript(session, recognitionState = session.currentState) {
    const finalized = session.segments.map((segment) => segment.text);
    const currentFinal = recognitionState ? getFinalTranscript(recognitionState) : "";
    const interim = recognitionState?.interimTranscript ?? "";
    const parts = [...finalized, currentFinal, interim].filter(Boolean);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  function clearSilenceTimer(session) {
    window.clearTimeout(session.silenceTimer);
    session.silenceTimer = null;
  }

  function scheduleSilenceCompletion(session) {
    const currentFinal = session.currentState
      ? getFinalTranscript(session.currentState)
      : "";
    if (
      voiceSession !== session ||
      session.finishRequested ||
      (!session.segments.length && !currentFinal)
    ) {
      return;
    }

    clearSilenceTimer(session);
    session.silenceTimer = window.setTimeout(() => {
      session.finishRequested = true;
      window.clearTimeout(session.restartTimer);
      if (session.current && (recognitionActive || recognitionStarting)) {
        stopRecognition(session, "Could not finish speech recognition after a pause.");
      } else {
        completeVoiceSession(session);
      }
    }, endOfSpeechSilenceMs);
  }

  function commitRecognitionResults(session, recognitionState) {
    if (recognitionState.committed) return;
    recognitionState.committed = true;
    const text = getFinalTranscript(recognitionState);
    if (!text) return;
    session.segments.push({ text, confidence: getFinalConfidence(recognitionState) });
  }

  function stopRecognition(session, reason) {
    const instance = session.current;
    if (!instance) {
      completeVoiceSession(session);
      return;
    }

    try {
      instance.stop();
      return;
    } catch (error) {
      console.error(reason, error);
    }

    try {
      instance.abort();
      return;
    } catch (error) {
      console.error("Could not abort speech recognition.", error);
    }

    if (session.current === instance) {
      if (session.currentState) {
        commitRecognitionResults(session, session.currentState);
      }
      session.current = null;
      session.currentState = null;
      recognition = null;
      recognitionStarting = false;
      recognitionActive = false;
      completeVoiceSession(session);
    }
  }

  function completeVoiceSession(session) {
    if (voiceSession !== session || session.completed) return;
    session.completed = true;
    clearSilenceTimer(session);
    window.clearTimeout(session.restartTimer);
    const text = session.segments.map((segment) => segment.text).join(" ").replace(/\s+/g, " ").trim();
    const scores = session.segments
      .map((segment) => segment.confidence)
      .filter(Number.isFinite);
    const confidence = scores.length ? Math.min(...scores) : null;
    voiceSession = null;
    recognition = null;
    recognitionStarting = false;
    recognitionActive = false;
    session.current = null;
    session.currentState = null;
    notify(session.handlers, "onListening", false);
    notify(session.handlers, "onInterim", "");
    if (text) notify(session.handlers, "onTranscript", { text, confidence, source: "speech" });
    notify(session.handlers, "onRecognitionEnd");
  }

  function startRecognition(session) {
    if (
      voiceSession !== session ||
      session.completed ||
      session.finishRequested ||
      session.current ||
      recognitionStarting ||
      recognitionActive
    ) {
      return;
    }

    let instance;
    let recognitionState;
    try {
      instance = new Recognition();
      recognitionState = {
        finalResults: [],
        interimTranscript: "",
        committed: false,
      };
    } catch (error) {
      session.finishRequested = true;
      notify(session.handlers, "onError", {
        code: "unknown",
        message: errorMessage("unknown"),
      });
      completeVoiceSession(session);
      console.error("Could not create speech recognition.", error);
      return;
    }

    session.current = instance;
    session.currentState = recognitionState;
    recognition = instance;
    recognitionStarting = true;
    instance.lang = "en-US";
    instance.interimResults = true;
    instance.continuous = false;
    instance.maxAlternatives = 1;

    const isCurrent = () =>
      voiceSession === session && session.current === instance && !session.completed;

    instance.onstart = () => {
      if (!isCurrent()) return;
      recognitionStarting = false;
      recognitionActive = true;
      notify(session.handlers, "onListening", true);
    };

    instance.onspeechstart = () => {
      if (!isCurrent()) return;
      clearSilenceTimer(session);
    };

    instance.onspeechend = () => {
      if (!isCurrent()) return;
      scheduleSilenceCompletion(session);
    };

    instance.onresult = (event) => {
      if (!isCurrent()) return;
      recognitionState.finalResults = [];
      recognitionState.interimTranscript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result[0];
        const text = alternative.transcript.trim();
        if (!text) continue;
        if (result.isFinal) {
          recognitionState.finalResults.push({
            text,
            confidence: Number.isFinite(alternative.confidence) ? alternative.confidence : null,
          });
        } else {
          recognitionState.interimTranscript += `${recognitionState.interimTranscript ? " " : ""}${text}`;
        }
      }

      if (recognitionState.interimTranscript) clearSilenceTimer(session);
      else if (getFinalTranscript(recognitionState)) scheduleSilenceCompletion(session);
      notify(session.handlers, "onInterim", getVisibleTranscript(session));
    };

    instance.onerror = (event) => {
      if (!isCurrent()) return;
      const code = event.error || "unknown";
      if (code === "aborted" && session.finishRequested) return;
      notify(session.handlers, "onError", { code, message: errorMessage(code) });
      if (code !== "no-speech") session.finishRequested = true;
    };

    instance.onend = () => {
      if (!isCurrent()) return;
      commitRecognitionResults(session, recognitionState);
      session.current = null;
      session.currentState = null;
      recognition = null;
      recognitionStarting = false;
      recognitionActive = false;
      notify(session.handlers, "onListening", false);
      notify(session.handlers, "onInterim", getVisibleTranscript(session));

      if (session.finishRequested) {
        completeVoiceSession(session);
        return;
      }
      if (session.segments.length && !session.silenceTimer) scheduleSilenceCompletion(session);
      session.restartTimer = window.setTimeout(
        () => startRecognition(session),
        RECOGNITION_RESTART_DELAY_MS,
      );
    };

    try {
      instance.start();
    } catch (error) {
      session.current = null;
      session.currentState = null;
      recognition = null;
      recognitionStarting = false;
      recognitionActive = false;
      session.finishRequested = true;
      const code = error.name === "NotAllowedError" ? "not-allowed" : "unknown";
      notify(session.handlers, "onError", { code, message: errorMessage(code) });
      completeVoiceSession(session);
    }
  }

  function errorMessage(code) {
    const messages = {
      "not-allowed": "Microphone permission was denied. Allow microphone access in browser settings and try again.",
      "service-not-allowed": "This browser does not allow speech recognition for this page.",
      "audio-capture": "No microphone was found. Connect a microphone or type your message instead.",
      "no-speech": "No speech was detected. Tap Speak to try again, or type your message.",
      network: "Speech recognition could not connect. Check your connection or type your message.",
      "language-not-supported": "Speech recognition does not support the selected browser language.",
      aborted: "Listening stopped.",
    };
    return messages[code] || "Speech recognition is unavailable right now. You can continue by typing.";
  }

  function startListening(handlers = {}) {
    if (!Recognition) {
      handlers.onError?.({
        code: "unsupported",
        message: "Speech recognition is not supported in this browser. You can still type messages.",
      });
      return false;
    }

    if (voiceSession) return true;
    cancelSpeech();
    voiceSession = {
      handlers,
      segments: [],
      current: null,
      currentState: null,
      silenceTimer: null,
      restartTimer: null,
      finishRequested: false,
      completed: false,
    };
    startRecognition(voiceSession);
    return Boolean(voiceSession);
  }

  function stopListening() {
    if (!voiceSession) return;
    voiceSession.finishRequested = true;
    clearSilenceTimer(voiceSession);
    window.clearTimeout(voiceSession.restartTimer);
    if (!voiceSession.current) {
      completeVoiceSession(voiceSession);
      return;
    }
    stopRecognition(voiceSession, "Could not stop speech recognition.");
  }

  function abortListening() {
    if (!voiceSession) return;
    const session = voiceSession;
    session.completed = true;
    clearSilenceTimer(session);
    window.clearTimeout(session.restartTimer);
    voiceSession = null;
    recognitionStarting = false;
    recognitionActive = false;
    const instance = session.current;
    session.current = null;
    session.currentState = null;
    recognition = null;
    try {
      instance?.abort();
    } catch (error) {
      console.error("Could not cancel speech recognition.", error);
    }
    notify(session.handlers, "onInterim", "");
    notify(session.handlers, "onListening", false);
  }

  function setEndOfSpeechSilenceThreshold(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 500 || milliseconds > 10000) {
      throw new RangeError("Speech silence threshold must be between 500 and 10000 milliseconds.");
    }
    endOfSpeechSilenceMs = milliseconds;
    if (
      voiceSession &&
      (voiceSession.segments.length || getFinalTranscript(voiceSession.currentState ?? { finalResults: [] }))
    ) {
      scheduleSilenceCompletion(voiceSession);
    }
  }

  function speak(text, handlers = {}) {
    if (!hasSpeechSynthesis || isMuted || !text.trim()) {
      handlers.onUnavailable?.();
      return false;
    }

    cancelSpeech();
    let utterance;
    try {
      utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.96;
      utterance.pitch = 1;

      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find((voice) => /^en(?:-|_)/i.test(voice.lang));
      if (englishVoice) utterance.voice = englishVoice;

      utterance.onstart = () => {
        isSpeaking = true;
        handlers.onStart?.();
      };
      utterance.onend = () => {
        isSpeaking = false;
        handlers.onEnd?.();
      };
      utterance.onerror = (event) => {
        isSpeaking = false;
        if (event.error !== "canceled" && event.error !== "interrupted") {
          handlers.onError?.(event.error);
        }
        handlers.onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (error) {
      isSpeaking = false;
      console.error("Could not start speech synthesis.", error);
      handlers.onError?.("unavailable");
      return false;
    }
  }

  function cancelSpeech() {
    if (hasSpeechSynthesis) window.speechSynthesis.cancel();
    isSpeaking = false;
  }

  function setMuted(muted) {
    isMuted = muted;
    if (isMuted) cancelSpeech();
  }

  function stopAll() {
    abortListening();
    cancelSpeech();
  }

  window.XovaVoice = {
    isRecognitionSupported: Boolean(Recognition),
    isSpeechSynthesisSupported: hasSpeechSynthesis,
    startListening,
    stopListening,
    abortListening,
    speak,
    cancelSpeech,
    setMuted,
    stopAll,
    setEndOfSpeechSilenceThreshold,
    get endOfSpeechSilenceThreshold() {
      return endOfSpeechSilenceMs;
    },
    get isListening() {
      return Boolean(voiceSession);
    },
    get isStarting() {
      return recognitionStarting;
    },
    get isSpeaking() {
      return isSpeaking;
    },
    get isMuted() {
      return isMuted;
    },
  };
})();
