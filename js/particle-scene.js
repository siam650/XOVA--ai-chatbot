/**
 * Xova — Particle Scene Manager  (js/particle-scene.js)
 *
 * Responsibilities:
 *  - Initialize the Three.js WebGL renderer
 *  - Manage the scene, perspective camera, and resize handling
 *  - Control the animation loop (start / stop / pause)
 *  - Expose a clean API consumed by intro.js and the homepage
 *
 * Depends on: Three.js (loaded via importmap as 'three')
 * Exposes:    window.XovaParticleScene
 */

import * as THREE from "three";
import { XovaParticleSystem } from "./particle-system.js";

const XovaParticleScene = (() => {
  // ── Internal state ────────────────────────────────────────────
  let renderer = null;
  let scene = null;
  let camera = null;
  let particleSystem = null;
  let resizeObserver = null;
  let animationId = null;
  let canvas = null;
  let lastTime = 0;
  let isRunning = false;
  let isDisposed = false;
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let isReducedMotion = reducedMotionQuery.matches;

  // Mouse tracking for parallax
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  // Camera drift state
  const cameraDrift = {
    time: 0,
    baseX: 0,
    baseY: 0,
    baseZ: 5.5,
  };

  // ── WebGL capability check ─────────────────────────────────────
  function isWebGLSupported() {
    try {
      const testCanvas = document.createElement("canvas");
      return Boolean(
        testCanvas.getContext("webgl2") ||
          testCanvas.getContext("webgl") ||
          testCanvas.getContext("experimental-webgl")
      );
    } catch {
      return false;
    }
  }

  // ── Initialization ─────────────────────────────────────────────
  function init(targetCanvas, options = {}) {
    if (renderer) dispose();
    if (!isWebGLSupported()) {
      console.warn("[Xova] WebGL not supported — particle system disabled.");
      return false;
    }

    canvas = targetCanvas;
    isDisposed = false;
    isReducedMotion = reducedMotionQuery.matches;

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060b18, 0.028);

    // Camera — field of view 60°, aspect set on resize
    const { width, height } = canvas.getBoundingClientRect();
    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 200);
    camera.position.set(0, 0, cameraDrift.baseZ);

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,    // disabled for perf; particles look fine without it
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x060b18, 0);

    // Particle system
    const particleCount = resolveParticleCount(options.quality);
    particleSystem = XovaParticleSystem.create(scene, {
      count: particleCount,
      radius: options.radius ?? 2.8,
      spread: options.spread ?? 1.0,
    });

    // Events
    window.addEventListener("resize", handleResize, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    if ("ResizeObserver" in window && canvas.parentElement) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(canvas.parentElement);
    }
    if (reducedMotionQuery.addEventListener) {
      reducedMotionQuery.addEventListener("change", handleMotionPreference);
    } else {
      reducedMotionQuery.addListener(handleMotionPreference);
    }

    return true;
  }

  function handleMotionPreference(event) {
    isReducedMotion = event.matches;
    if (isReducedMotion) {
      stopLoop();
      if (isRunning) tick(performance.now());
    } else if (isRunning && !document.hidden) {
      startLoop();
    }
  }

  // Choose particle count based on device capability
  function resolveParticleCount(quality) {
    if (quality === "low") return 8000;
    if (quality === "medium") return 18000;
    if (quality === "high") return 35000;

    // Auto-detect
    const isMobile = window.innerWidth < 768 || window.devicePixelRatio > 2.5;
    const isLowPower = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 2;
    if (isMobile || isLowPower) return 10000;
    return 28000;
  }

  // ── Resize ─────────────────────────────────────────────────────
  function handleResize() {
    if (!renderer || !camera || !canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (isReducedMotion) renderer.render(scene, camera);
  }

  // ── Visibility ─────────────────────────────────────────────────
  function handleVisibility() {
    if (document.hidden) {
      stopLoop();
    } else if (isRunning) {
      // Restart was flagged but loop was paused
      startLoop();
    }
  }

  // ── Mouse parallax ─────────────────────────────────────────────
  function onMouseMove(event) {
    const { innerWidth, innerHeight } = window;
    // Normalize to -1 → +1
    mouse.targetX = (event.clientX / innerWidth - 0.5) * 2;
    mouse.targetY = -(event.clientY / innerHeight - 0.5) * 2;
  }

  function enableMouseParallax() {
    window.addEventListener("mousemove", onMouseMove, { passive: true });
  }

  function disableMouseParallax() {
    window.removeEventListener("mousemove", onMouseMove);
    mouse.targetX = 0;
    mouse.targetY = 0;
  }

  // ── Animation loop ─────────────────────────────────────────────
  function tick(now) {
    if (isDisposed || !renderer) return;
    animationId = null;
    if (!isReducedMotion) animationId = requestAnimationFrame(tick);

    // Delta time in seconds (capped to avoid spiral of death on tab wake)
    const delta = isReducedMotion ? 0 : Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // Smooth mouse lerp
    mouse.x += (mouse.targetX - mouse.x) * 0.06;
    mouse.y += (mouse.targetY - mouse.y) * 0.06;

    // Subtle camera drift
    cameraDrift.time += delta;
    const driftAmplitude = 0.12;
    const driftFreqX = 0.18;
    const driftFreqY = 0.11;
    camera.position.x =
      cameraDrift.baseX +
      Math.sin(cameraDrift.time * driftFreqX) * driftAmplitude +
      mouse.x * 0.18;
    camera.position.y =
      cameraDrift.baseY +
      Math.cos(cameraDrift.time * driftFreqY) * driftAmplitude * 0.7 +
      mouse.y * 0.12;
    camera.position.z =
      cameraDrift.baseZ +
      Math.sin(cameraDrift.time * 0.07) * 0.18;
    camera.lookAt(0, 0, 0);

    // Update particle system
    particleSystem?.update(delta, isReducedMotion ? 0 : now / 1000, {
      mouseX: mouse.x,
      mouseY: mouse.y,
    });

    renderer.render(scene, camera);
  }

  function startLoop() {
    if (animationId !== null || isDisposed) return;
    lastTime = performance.now();
    animationId = requestAnimationFrame(tick);
    isRunning = true;
  }

  function stopLoop() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  // ── Camera position control (used during intro → hero transition) ──
  function setCameraBase(x, y, z, animate = false) {
    if (!camera) return;
    if (!animate) {
      cameraDrift.baseX = x;
      cameraDrift.baseY = y;
      cameraDrift.baseZ = z;
    } else {
      // Lerp over ~1s using a simple interval
      const steps = 60;
      const startX = cameraDrift.baseX;
      const startY = cameraDrift.baseY;
      const startZ = cameraDrift.baseZ;
      let step = 0;
      const interval = setInterval(() => {
        step++;
        const t = step / steps;
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        cameraDrift.baseX = startX + (x - startX) * ease;
        cameraDrift.baseY = startY + (y - startY) * ease;
        cameraDrift.baseZ = startZ + (z - startZ) * ease;
        if (step >= steps) clearInterval(interval);
      }, 16);
    }
  }

  // ── Opacity control for intro transition ──────────────────────
  // We expose this so intro.js can fade the entire particle group
  function setSystemOpacity(opacity) {
    particleSystem?.setOpacity(opacity);
  }

  // ── Dispose ────────────────────────────────────────────────────
  function dispose() {
    isDisposed = true;
    isRunning = false;
    stopLoop();
    disableMouseParallax();
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibility);
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (reducedMotionQuery.removeEventListener) {
      reducedMotionQuery.removeEventListener("change", handleMotionPreference);
    } else {
      reducedMotionQuery.removeListener(handleMotionPreference);
    }
    particleSystem?.dispose(scene);
    renderer?.dispose();
    renderer = null;
    scene = null;
    camera = null;
    particleSystem = null;
    canvas = null;
  }

  // ── Public API ─────────────────────────────────────────────────
  return {
    isWebGLSupported,
    init,
    startLoop,
    stopLoop,
    enableMouseParallax,
    disableMouseParallax,
    setCameraBase,
    setSystemOpacity,
    handleResize,
    dispose,
    get isRunning() {
      return isRunning;
    },
    get renderer() {
      return renderer;
    },
  };
})();

export { XovaParticleScene };
window.XovaParticleScene = XovaParticleScene;
