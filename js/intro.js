/**
 * Xova — Cinematic Introduction Orchestrator  (js/intro.js)
 *
 * Sequence:
 *   Stage 0 — Check sessionStorage; skip if already seen this session
 *   Stage 1 — Show "XOVA" brand text with fade-in (1.2s)
 *   Stage 2 — Glow line expands (0.6s)
 *   Stage 3 — Particle system initializes and particles spiral out from center
 *   Stage 4 — Brand text dissolves (letters scale up + fade out), particles
 *              expand into full formation (1.8s)
 *   Stage 5 — Camera pulls back to reveal full galaxy (1.0s)
 *   Stage 6 — Transition: overlay fades, canvas moves to hero right panel,
 *              homepage content fades in on left (1.2s)
 *
 * Accessibility:
 *   - prefers-reduced-motion → skip immediately
 *   - Skip button → calls skipIntro()
 *   - sessionStorage flag → skip on repeat visit in same session
 *
 * Depends on: particle-scene.js, particle-system.js (via XovaParticleScene)
 */

import { XovaParticleScene } from "./particle-scene.js";

const SESSION_KEY = "xova.introSeen";

// ── Timing constants (ms) ──────────────────────────────────────────
const T = {
  LETTERS_FADE_IN:    900,   // each letter fades in, staggered
  GLOW_LINE_EXPAND:   500,
  PARTICLE_EMERGE:    1200,  // particles scale from 0 → 0.4
  TEXT_DISSOLVE:      900,   // XOVA text fades out
  FORMATION_EXPAND:   1600,  // particles expand to full radius
  CAMERA_PULLBACK:    1000,
  OVERLAY_FADE:       1200,  // intro overlay → transparent
  CONTENT_FADEIN:     800,   // homepage left content appears
  // Cumulative start times:
  STAGE1_START:       400,
  STAGE2_START:       1500,
  STAGE3_START:       2200,
  STAGE4_START:       3200,
  STAGE5_START:       5200,
  STAGE6_START:       6400,
};

// ── DOM references ─────────────────────────────────────────────────
let introEl       = null;
let canvasEl      = null;
let brandTextEl   = null;
let lettersEl     = null;
let glowLineEl    = null;
let skipBtnEl     = null;
let progressDotsEl = null;

let heroVisualEl  = null;   // .hero-visual in index.html
let heroContentEl = null;   // .hero-content in index.html
let heroEl        = null;   // .hero section

let isSkipped = false;
let introStartTime = 0;
let sequenceTimeouts = [];

// ── Utility ────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    sequenceTimeouts.push(id);
  });
}

function clearAllTimeouts() {
  sequenceTimeouts.forEach(clearTimeout);
  sequenceTimeouts = [];
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Animates a numeric property with a custom easing function
function animateValue(from, to, durationMs, onUpdate, easing = easeInOut) {
  return new Promise((resolve) => {
    const start = performance.now();
    function frame(now) {
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      const value = from + (to - from) * easing(t);
      onUpdate(value);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

// ── Skip intro ─────────────────────────────────────────────────────
function skipIntro() {
  if (isSkipped) return;
  isSkipped = true;
  clearAllTimeouts();
  sessionStorage.setItem(SESSION_KEY, "1");
  activateHomepage(true);
}

// ── Activate homepage after intro ─────────────────────────────────
function activateHomepage(instant = false) {
  // 1. Mount canvas into hero visual panel (if the hero split exists)
  if (heroVisualEl && canvasEl) {
    const heroCanvasWrap = heroVisualEl.querySelector("#xova-hero-canvas-wrap");
    if (heroCanvasWrap) {
      heroCanvasWrap.appendChild(canvasEl);
      if (!instant) {
        canvasEl.classList.add("hero-canvas-entering");
      }
      // Resize particle renderer to new container
      XovaParticleScene.handleResize();
    }
  }

  // 2. Enable mouse parallax for homepage experience
  XovaParticleScene.enableMouseParallax();

  // 3. Fade/hide the intro overlay
  if (introEl) {
    if (instant) {
      introEl.classList.add("is-hidden");
    } else {
      introEl.classList.add("is-fading-out");
      setTimeout(() => {
        introEl?.classList.add("is-hidden");
      }, 1300);
    }
  }

  // 4. Animate homepage content in
  if (heroContentEl) {
    heroContentEl.style.opacity = "0";
    if (instant) {
      heroContentEl.style.opacity = "";
    } else {
      heroContentEl.classList.add("hero-content-entering");
      // Remove animation class after it completes
      setTimeout(() => {
        heroContentEl?.classList.remove("hero-content-entering");
        if (heroContentEl) heroContentEl.style.opacity = "";
      }, 1200);
    }
  }

  // 5. Apply split layout class to hero
  if (heroEl) {
    heroEl.classList.add("hero-split");
  }

  // 6. Update camera position for hero (slightly further back for full view)
  XovaParticleScene.setCameraBase(0, 0, 5.0, !instant);
}

// ── Stage 1: XOVA brand text fade-in ─────────────────────────────
async function stageLettersFadeIn() {
  if (isSkipped || !lettersEl) return;

  const letters = Array.from(lettersEl.querySelectorAll(".xova-letter"));
  lettersEl.style.opacity = "1";

  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    letter.style.opacity = "0";
    letter.style.transform = "translateY(12px)";
    letter.style.transition = "opacity 500ms ease, transform 600ms cubic-bezier(0.2,0.7,0.2,1)";
    await delay(i * 100);
    if (isSkipped) return;
    letter.style.opacity = "1";
    letter.style.transform = "translateY(0)";
  }

  setProgressDot(0);
}

// ── Stage 2: Glow line expansion ──────────────────────────────────
async function stageGlowLine() {
  if (isSkipped || !glowLineEl) return;
  await delay(200);
  if (isSkipped) return;
  glowLineEl.classList.add("is-expanded");
}

// ── Stage 3: Particle system initialization ────────────────────────
async function stageParticleEmerge() {
  if (isSkipped || !canvasEl) return;

  // Start particle loop with scale=0 (invisible)
  XovaParticleScene.setCameraBase(0, 0, 7.0);
  XovaParticleScene.setSystemOpacity(0);

  // Fade particles in
  await animateValue(0, 0.45, 1200, (v) => {
    XovaParticleScene.setSystemOpacity(v);
  });

  setProgressDot(1);
}

// ── Stage 4: Text dissolves, particles expand ─────────────────────
async function stageTextDissolve() {
  if (isSkipped) return;

  const letters = lettersEl ? Array.from(lettersEl.querySelectorAll(".xova-letter")) : [];
  const glowLine = glowLineEl;

  // Dissolve text: letters scale up and fade
  for (const letter of letters) {
    letter.style.transition = "opacity 800ms ease, transform 900ms cubic-bezier(0.4,0,0.6,1)";
    letter.style.transform = "translateY(-8px) scale(1.08)";
    letter.style.opacity = "0";
  }
  if (glowLine) {
    glowLine.style.transition = "opacity 600ms ease";
    glowLine.style.opacity = "0";
  }

  // Simultaneously expand particle formation to full opacity
  await animateValue(0.45, 1.0, T.FORMATION_EXPAND, (v) => {
    XovaParticleScene.setSystemOpacity(v);
  });

  setProgressDot(2);
}

// ── Stage 5: Camera pull-back ──────────────────────────────────────
async function stageCameraPullback() {
  if (isSkipped) return;
  await animateValue(7.0, 5.5, T.CAMERA_PULLBACK, (v) => {
    XovaParticleScene.setCameraBase(0, 0, v);
  });
}

// ── Stage 6: Transition to homepage ───────────────────────────────
async function stageTransitionToHomepage() {
  if (isSkipped) return;
  sessionStorage.setItem(SESSION_KEY, "1");
  await delay(300); // brief pause for user to appreciate the full formation
  activateHomepage(false);
}

// ── Progress dots ─────────────────────────────────────────────────
function setProgressDot(index) {
  if (!progressDotsEl) return;
  const dots = progressDotsEl.querySelectorAll(".progress-dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("is-active", i === index);
  });
}

// ── Full sequence ─────────────────────────────────────────────────
async function runSequence() {
  try {
    // Stagger each stage
    await delay(T.STAGE1_START);
    if (isSkipped) return;
    await stageLettersFadeIn();

    await delay(T.STAGE2_START - T.STAGE1_START - T.LETTERS_FADE_IN);
    if (isSkipped) return;
    await stageGlowLine();

    await delay(T.STAGE3_START - T.STAGE2_START);
    if (isSkipped) return;
    await stageParticleEmerge();

    await delay(T.STAGE4_START - T.STAGE3_START);
    if (isSkipped) return;
    await stageTextDissolve();

    await delay(T.STAGE5_START - T.STAGE4_START - T.TEXT_DISSOLVE);
    if (isSkipped) return;
    await stageCameraPullback();

    await delay(T.STAGE6_START - T.STAGE5_START - T.CAMERA_PULLBACK);
    if (isSkipped) return;
    await stageTransitionToHomepage();
  } catch (err) {
    // If anything throws, fall back gracefully
    console.warn("[Xova intro] Sequence error — skipping to homepage.", err);
    skipIntro();
  }
}

// ── Main init ──────────────────────────────────────────────────────
function init() {
  introEl        = document.getElementById("xova-intro");
  canvasEl       = document.getElementById("xova-canvas");
  brandTextEl    = document.getElementById("xova-brand-text");
  lettersEl      = brandTextEl?.querySelector(".xova-letters");
  glowLineEl     = brandTextEl?.querySelector(".xova-glow-line");
  skipBtnEl      = document.getElementById("xova-skip-btn");
  progressDotsEl = document.getElementById("xova-progress");
  heroEl         = document.querySelector(".hero");
  heroVisualEl   = document.querySelector(".hero-visual");
  heroContentEl  = document.querySelector(".hero-content");

  // Check skip conditions
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const alreadySeen = sessionStorage.getItem(SESSION_KEY) === "1";

  if (prefersReducedMotion || alreadySeen || !introEl || !canvasEl) {
    // Skip intro entirely — initialize hero canvas directly
    if (introEl) introEl.classList.add("is-hidden");
    const supported = XovaParticleScene.init(
      canvasEl || createHeroCanvas(),
      { quality: "auto" }
    );
    if (supported) {
      activateHomepage(true);
      XovaParticleScene.startLoop();
    }
    return;
  }

  // Initialize WebGL on the intro canvas
  const supported = XovaParticleScene.init(canvasEl, {
    quality: window.innerWidth < 768 ? "low" : "auto",
  });

  if (!supported) {
    // WebGL unavailable — show fallback and skip
    if (introEl) introEl.classList.add("is-hidden");
    if (heroEl)  heroEl.classList.add("hero-split");
    document.body.classList.add("no-webgl");
    return;
  }

  // Wire up skip button
  if (skipBtnEl) {
    skipBtnEl.addEventListener("click", skipIntro);
    skipBtnEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        skipIntro();
      }
    });
  }

  // Start rendering (particles start invisible; stageParticleEmerge fades them in)
  XovaParticleScene.setSystemOpacity(0);
  XovaParticleScene.startLoop();

  // Kick off the cinematic sequence
  introStartTime = performance.now();
  runSequence();
}

// Creates a canvas for the hero if the intro canvas isn't present
// (e.g., when loading directly to homepage with skip)
function createHeroCanvas() {
  const heroVisual = document.querySelector("#xova-hero-canvas-wrap");
  if (!heroVisual) return null;
  const c = document.createElement("canvas");
  c.id = "xova-hero-canvas";
  heroVisual.appendChild(c);
  return c;
}

// ── Bootstrap on DOM ready ─────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { skipIntro };

