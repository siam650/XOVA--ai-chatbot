(() => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasSpeechSynthesis =
    typeof window.speechSynthesis?.speak === "function" &&
    typeof window.speechSynthesis.cancel === "function" &&
    typeof window.SpeechSynthesisUtterance === "function";

  let recognition = null;
  let isStarting = false;
  let isListening = false;
  let isMuted = false;
  let isSpeaking = false;

  function notify(handlers, name, value) {
    handlers[name]?.(value);
  }

  function createRecognition(handlers) {
    if (!Recognition) return null;

    const instance = new Recognition();
    let finalTranscript = "";
    let confidence = null;
    let hasStarted = false;
    let discardTranscript = false;
    const isCurrent = () => recognition === instance;
    instance.discardTranscript = () => {
      discardTranscript = true;
    };
    instance.lang = "en-US";
    instance.interimResults = true;
    instance.continuous = false;
    instance.maxAlternatives = 1;

    instance.onstart = () => {
      if (!isCurrent()) return;
      isStarting = false;
      hasStarted = true;
      isListening = true;
      notify(handlers, "onListening", true);
    };

    instance.onresult = (event) => {
      if (!isCurrent() || discardTranscript) return;
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result[0];
        if (result.isFinal && alternative.transcript.trim()) {
          finalTranscript = `${finalTranscript} ${alternative.transcript.trim()}`.trim();
          if (Number.isFinite(alternative.confidence)) {
            confidence = confidence === null
              ? alternative.confidence
              : Math.min(confidence, alternative.confidence);
          }
        } else {
          interim += alternative.transcript;
        }
      }
      notify(handlers, "onInterim", `${finalTranscript} ${interim.trim()}`.trim());
    };

    instance.onerror = (event) => {
      if (!isCurrent() || discardTranscript) return;
      isStarting = false;
      isListening = false;
      const error = event.error || "unknown";
      notify(handlers, "onError", { code: error, message: errorMessage(error) });
      notify(handlers, "onListening", false);
    };

    instance.onend = () => {
      if (!isCurrent()) return;
      isStarting = false;
      isListening = false;
      recognition = null;
      if (!discardTranscript) {
        notify(handlers, "onListening", false);
        if (hasStarted) {
          notify(handlers, "onInterim", "");
          if (finalTranscript) {
            notify(handlers, "onTranscript", { text: finalTranscript, confidence, source: "speech" });
          }
          notify(handlers, "onRecognitionEnd");
        }
      }
    };

    return instance;
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

    if (recognition || isListening || isStarting) return true;
    cancelSpeech();
    recognition = createRecognition(handlers);
    isStarting = true;

    try {
      recognition.start();
      return true;
    } catch (error) {
      isStarting = false;
      const code = error.name === "NotAllowedError" ? "not-allowed" : "unknown";
      recognition = null;
      notify(handlers, "onError", { code, message: errorMessage(code) });
      return false;
    }
  }

  function stopListening() {
    if (!recognition || !isListening) return;
    try {
      recognition.stop();
    } catch (error) {
      console.error("Could not stop speech recognition.", error);
      abortListening();
    }
  }

  function abortListening() {
    if (!recognition) return;
    recognition.discardTranscript?.();
    isStarting = false;
    isListening = false;
    try {
      recognition.abort();
    } catch (error) {
      console.error("Could not cancel speech recognition.", error);
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
    isStarting = false;
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
    get isListening() {
      return isListening;
    },
    get isStarting() {
      return isStarting;
    },
    get isSpeaking() {
      return isSpeaking;
    },
    get isMuted() {
      return isMuted;
    },
  };
})();
