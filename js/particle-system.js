/**
 * Xova — GPU Particle System  (js/particle-system.js)
 *
 * Creates a cinematic, genuine 3D particle formation using:
 *  - THREE.Points + BufferGeometry
 *  - Custom GLSL vertex + fragment shaders (GPU-driven)
 *  - Spiral galaxy / cosmic vortex formation
 *  - Multiple depth layers
 *  - Per-particle brightness, size, orbital velocity
 *  - Mouse-reactive parallax (driven by scene manager)
 *
 * Designed to run entirely on the GPU — minimal JS per frame.
 * Exposed as: XovaParticleSystem
 */

import * as THREE from "three";

// ── GLSL Shaders ─────────────────────────────────────────────────

const VERTEX_SHADER = /* glsl */ `
  // Per-particle attributes
  attribute float aSize;       // base point size
  attribute float aPhase;      // animation phase offset (0–2π)
  attribute float aOrbitSpeed; // orbital drift speed multiplier
  attribute float aLayerDepth; // 0 (inner) → 1 (outer)
  attribute vec3  aColor;      // base RGB color

  // Uniforms
  uniform float uTime;
  uniform float uGlobalRotation;
  uniform float uMouseX;
  uniform float uMouseY;
  uniform float uOpacity;      // intro fade control
  uniform float uPixelRatio;
  uniform float uScale;        // intro → hero scale transition

  // Outputs to fragment shader
  varying vec3  vColor;
  varying float vBrightness;
  varying float vOpacity;

  // 2D rotation matrix
  mat2 rotate2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
  }

  void main() {
    vColor = aColor;
    vOpacity = uOpacity;

    // --- Orbital movement ---
    // Each particle drifts slowly along its orbit
    float orbitAngle = uTime * aOrbitSpeed * 0.15 + aPhase;
    float r = length(position.xz);

    // Differential rotation: inner particles orbit faster (galaxy-like)
    float diffRotation = uGlobalRotation * (1.0 + (1.0 - aLayerDepth) * 0.6);

    // Apply world-space rotation on XZ plane
    vec3 pos = position;
    pos.xz = rotate2D(diffRotation) * pos.xz;

    // Gentle radial breathing
    float breathe = sin(uTime * 0.22 + aPhase) * 0.04 * (1.0 - aLayerDepth * 0.5);
    pos *= 1.0 + breathe;

    // Subtle vertical oscillation
    pos.y += sin(uTime * 0.31 + aPhase * 2.1) * 0.06 * aLayerDepth;

    // Mouse parallax — outer particles react more
    float parallaxStrength = aLayerDepth * 0.18;
    pos.x += uMouseX * parallaxStrength;
    pos.y += uMouseY * parallaxStrength * 0.7;

    // Scale (used during intro → hero transition)
    pos *= uScale;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Depth-based size: particles closer to camera appear larger
    float depthFactor = 1.0 / (-mvPosition.z + 0.001);
    float pointSize = aSize * depthFactor * 280.0 * uPixelRatio;
    gl_PointSize = clamp(pointSize, 0.5, 18.0);
    gl_Position = projectionMatrix * mvPosition;

    // Brightness: inner core brighter, modulated by pulsing
    float pulse = 0.82 + 0.18 * sin(uTime * 1.3 + aPhase * 3.7);
    float depthBrightness = 1.0 - aLayerDepth * 0.55;
    vBrightness = pulse * depthBrightness;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3  vColor;
  varying float vBrightness;
  varying float vOpacity;

  void main() {
    // Soft circular particle with smooth falloff
    vec2  uv   = gl_PointCoord - vec2(0.5);
    float dist = length(uv);

    // Discard pixels outside circle
    if (dist > 0.5) discard;

    // Soft-edge falloff: bright center, fading to transparent edge
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    // Extra bright center core
    float core  = 1.0 - smoothstep(0.0, 0.18, dist);
    alpha = alpha + core * 0.6;
    alpha = clamp(alpha, 0.0, 1.0);

    // Final color
    vec3 finalColor = vColor * vBrightness;
    // Slight bloom-like over-brightness on the core
    finalColor += core * vColor * 0.4;

    gl_FragColor = vec4(finalColor, alpha * vOpacity);
  }
`;

// ── Color palette ─────────────────────────────────────────────────

const PALETTE = [
  // Icy white / near-white (dominant)
  new THREE.Color(0xf0f8ff),
  new THREE.Color(0xe8f4ff),
  new THREE.Color(0xddeeff),
  // Electric blue
  new THREE.Color(0x70b5ff),
  new THREE.Color(0x5aa8ff),
  new THREE.Color(0x4d9eff),
  // Soft cyan
  new THREE.Color(0x72deef),
  new THREE.Color(0x5ed5e8),
  new THREE.Color(0x8aeaf7),
  // Violet / lavender
  new THREE.Color(0x9a87ff),
  new THREE.Color(0xb5aaff),
  new THREE.Color(0xc5baff),
  // Warm golden (rare — < 5% of particles)
  new THREE.Color(0xffd580),
  new THREE.Color(0xffe0a0),
];

// Weighted selection: icy white & blue get more particles
const COLOR_WEIGHTS = [
  18, 15, 12,   // whites
  16, 14, 12,   // blues
  14, 11, 9,    // cyans
  8,  6,  4,    // violets
  1,  1,        // golds (rare)
];

function weightedColorIndex() {
  const totalWeight = COLOR_WEIGHTS.reduce((a, b) => a + b, 0);
  let rnd = Math.random() * totalWeight;
  for (let i = 0; i < COLOR_WEIGHTS.length; i++) {
    rnd -= COLOR_WEIGHTS[i];
    if (rnd <= 0) return i;
  }
  return 0;
}

// ── Particle distribution functions ──────────────────────────────

function spiralGalaxyPosition(index, count, params) {
  const { arms, radius, thickness, twist } = params;

  // Determine which spiral arm
  const arm = index % arms;
  const armAngle = (arm / arms) * Math.PI * 2;

  // Position along arm length (inner-concentrated)
  const t = Math.pow(Math.random(), 0.7);  // bias toward center
  const r = t * radius;

  // Spiral angle increases with radius
  const angle = armAngle + r * twist + (Math.random() - 0.5) * 0.6;

  // XZ position on the spiral plane
  const x = Math.cos(angle) * r;
  const z = Math.sin(angle) * r;

  // Vertical spread (thinner at edges, thicker at center)
  const ySpread = thickness * (1.0 - t * 0.6) * (0.5 - Math.random());

  // Scatter some particles off the arms for a realistic diffuse halo
  const scatter = Math.random() < 0.22;
  if (scatter) {
    const sr = Math.random() * radius * 0.85;
    const sa = Math.random() * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(sa) * sr,
      (Math.random() - 0.5) * thickness * 0.8,
      Math.sin(sa) * sr
    );
  }

  return new THREE.Vector3(x, ySpread, z);
}

function coreParticlePosition(radius) {
  // Dense central core: uniform sphere, small radius
  const phi = Math.acos(2 * Math.random() - 1);
  const theta = Math.random() * Math.PI * 2;
  const r = Math.pow(Math.random(), 0.5) * radius;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  );
}

// ── Factory ───────────────────────────────────────────────────────

function create(scene, options = {}) {
  const {
    count = 28000,
    radius = 2.8,
    spread = 1.0,
  } = options;

  const arms = 4;
  const coreCount = Math.floor(count * 0.12);  // 12% dense core
  const haloCount = count - coreCount;

  const spiralParams = {
    arms,
    radius: radius * spread,
    thickness: 0.38 * spread,
    twist: 2.6,
  };

  // Typed arrays for BufferGeometry attributes
  const positions  = new Float32Array(count * 3);
  const colors     = new Float32Array(count * 3);
  const sizes      = new Float32Array(count);
  const phases     = new Float32Array(count);
  const orbitSpeeds = new Float32Array(count);
  const layerDepths = new Float32Array(count);

  const tmpColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const isCore = i < coreCount;

    let pos;
    let layerDepth;
    let baseSize;

    if (isCore) {
      pos = coreParticlePosition(radius * 0.28);
      layerDepth = Math.random() * 0.3;
      baseSize = 0.006 + Math.random() * 0.018;
    } else {
      pos = spiralGalaxyPosition(i - coreCount, haloCount, spiralParams);
      const dist = pos.length();
      layerDepth = Math.min(dist / (radius * spread), 1.0);
      baseSize = 0.003 + Math.random() * 0.012 * (1.0 - layerDepth * 0.4);
    }

    positions[i * 3]     = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;

    // Color
    const ci = weightedColorIndex();
    const baseColor = PALETTE[ci];
    // Core particles skew whiter/brighter
    if (isCore) {
      tmpColor.copy(baseColor).lerp(new THREE.Color(0xffffff), 0.4);
    } else {
      tmpColor.copy(baseColor);
    }
    colors[i * 3]     = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;

    sizes[i]       = baseSize;
    phases[i]      = Math.random() * Math.PI * 2;
    orbitSpeeds[i] = 0.5 + Math.random() * 0.8;
    layerDepths[i] = layerDepth;
  }

  // Build geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position",   new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor",     new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize",      new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase",     new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aOrbitSpeed", new THREE.BufferAttribute(orbitSpeeds, 1));
  geometry.setAttribute("aLayerDepth", new THREE.BufferAttribute(layerDepths, 1));

  // Bounding sphere for frustum culling
  geometry.computeBoundingSphere();

  // Shader material
  const material = new THREE.ShaderMaterial({
    vertexShader:   VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime:           { value: 0 },
      uGlobalRotation: { value: 0 },
      uMouseX:         { value: 0 },
      uMouseY:         { value: 0 },
      uOpacity:        { value: 1 },
      uPixelRatio:     { value: Math.min(window.devicePixelRatio, 2) },
      uScale:          { value: 1 },
    },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
    vertexColors: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // ── Instance state ─────────────────────────────────────────────
  let globalRotation = 0;
  let currentOpacity = 1;
  let targetOpacity  = 1;

  // ── update() called every frame ────────────────────────────────
  function update(delta, time, { mouseX = 0, mouseY = 0 } = {}) {
    // Slow multi-axis global rotation
    globalRotation += delta * 0.08;

    material.uniforms.uTime.value           = time;
    material.uniforms.uGlobalRotation.value = globalRotation;
    material.uniforms.uMouseX.value         = mouseX;
    material.uniforms.uMouseY.value         = mouseY;

    // Smooth opacity transitions
    if (Math.abs(currentOpacity - targetOpacity) > 0.001) {
      currentOpacity += (targetOpacity - currentOpacity) * Math.min(delta * 3, 1);
      material.uniforms.uOpacity.value = currentOpacity;
    }
  }

  function setOpacity(opacity) {
    targetOpacity = Math.max(0, Math.min(1, opacity));
  }

  function setScale(scale) {
    material.uniforms.uScale.value = scale;
  }

  function dispose(scene) {
    scene.remove(points);
    geometry.dispose();
    material.dispose();
  }

  return { update, setOpacity, setScale, dispose };
}

// ── Export ─────────────────────────────────────────────────────────
const XovaParticleSystem = { create };
export { XovaParticleSystem };
window.XovaParticleSystem = XovaParticleSystem;

