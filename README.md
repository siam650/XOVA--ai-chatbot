# Xova — Speak Freely. Grow Naturally.

Xova is an English-speaking practice prototype that I'm building to help people improve their English through natural conversations.

I'm building this project for two reasons: to improve my own English communication skills and to learn web development by creating something useful.

### Current Prototype
- Four mode-specific conversations with local browser history.
- Continuous listen/respond/listen voice practice after the user starts listening, where the browser supports speech recognition.
- Browser text-to-speech for Xova's written replies, with mute and stop controls.
- Typed chat remains available as a fallback.
- A post-conversation example-based learning report; there are no live grammar interruptions and the report is not an AI assessment.

Voice recognition and playback depend on browser support and microphone permission. Use a secure context such as `localhost` or HTTPS for microphone access; opening the page directly from disk may not work consistently.

### Tech Stack
- HTML
- CSS
- JavaScript

### Integration Limits
Conversation replies currently use clearly labeled mock behavior. Reports use a small set of local grammar patterns and cannot reliably assess every error, identify acceptable informal English, or distinguish a learner's words from speech-recognition mistakes. Review voice transcripts before relying on report suggestions.

Real contextual AI replies and reliable, comprehensive grammar/speech analysis require a backend and an AI service. The frontend exposes the `window.XovaAIClient.reply({ message, mode, context })` and `window.XovaAIClient.createLearningReport(conversation)` integration points; credentials should remain on the server, not in browser code.

**This is a work in progress.**
