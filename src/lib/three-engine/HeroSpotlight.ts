import * as THREE from 'three';

/**
 * Volumetric spotlight layer for the home hero: three gold shader cones plus a
 * field of drifting dust motes, drawn into a transparent canvas above the hero
 * photography.
 *
 * Cost controls (the look is unchanged — the beams are wide, soft gradients):
 *  - the drawing buffer is sized to a pixel budget instead of devicePixelRatio,
 *    then stretched to the CSS size by the browser;
 *  - animation is time-based and capped at 30 fps (the original advanced a fixed
 *    step per frame, so it ran at the display's refresh rate);
 *  - rendering stops while the hero is off-screen or the tab is hidden;
 *  - the main-thread cost of every frame is measured: a device where the layer costs
 *    more than a few milliseconds a frame (software rendering, weak mobile GPUs) first
 *    gets a smaller drawing buffer, and if that is still too expensive the beams are
 *    frozen on their last frame instead of competing with the page for the main thread;
 *  - software renderers (SwiftShader, llvmpipe) start at the smallest buffer;
 *  - the GL context is released on dispose so route changes never leak contexts.
 */

export interface HeroSpotlightHandle {
  dispose(): void;
}

const FRAME_INTERVAL_MS = 1000 / 30;
const MIN_PIXEL_RATIO = 0.3;
/** Main-thread milliseconds one frame may cost (render + updates) before quality is reduced. */
const FRAME_BUDGET_MS = 5;
/** Frames between budget checks (~1 s at 30 fps). */
const BUDGET_WINDOW_FRAMES = 30;
const DOWNSCALE_STEP = 0.7;
const MAX_DOWNSCALES = 3;
/** Starting buffer scale on software renderers, where even a small layer is expensive. */
const SOFTWARE_START_SCALE = 0.5;
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;
/** Original authored speed: the sway clock advanced 0.01 per 60 Hz frame. */
const CLOCK_SPEED = 0.6;

interface Profile {
  dustCount: number;
  coneSegments: number;
  pixelBudget: number;
  maxPixelRatio: number;
}

function pickProfile(): Profile {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const constrained = window.innerWidth < 1024 || (nav.deviceMemory !== undefined && nav.deviceMemory <= 4);
  return constrained
    ? { dustCount: 48, coneSegments: 20, pixelBudget: 330_000, maxPixelRatio: 1 }
    : { dustCount: 120, coneSegments: 32, pixelBudget: 700_000, maxPixelRatio: 1.5 };
}

/** True when the browser reports a CPU-emulated GL implementation. */
function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  if (!info) return false;
  const renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '');
  return SOFTWARE_RENDERER.test(renderer);
}

function pixelRatioFor(profile: Profile, cssWidth: number, cssHeight: number, scale: number): number {
  const area = Math.max(1, cssWidth * cssHeight);
  const budgeted = Math.sqrt(profile.pixelBudget / area);
  return Math.max(MIN_PIXEL_RATIO, Math.min(window.devicePixelRatio || 1, profile.maxPixelRatio, budgeted) * scale);
}

const CONE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying float vY;
  void main() {
    vUv = uv;
    vY = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CONE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vY;

  void main() {
    // Gradient from tip (bright) to base (transparent)
    float gradient = smoothstep(-4.0, 4.0, vY);
    float alpha = gradient * uOpacity;

    // Edge falloff
    float dist = distance(vUv, vec2(0.5, vUv.y));
    alpha *= smoothstep(0.5, 0.2, dist);

    // Animated shimmer
    float shimmer = sin(vUv.y * 20.0 + uTime * 2.0) * 0.15 + 0.85;
    alpha *= shimmer;

    // Dust particles effect
    float dust = sin(vUv.x * 40.0 + uTime) * sin(vUv.y * 30.0 - uTime * 0.5);
    dust = smoothstep(0.7, 1.0, dust) * 0.3;
    alpha += dust * gradient;

    gl_FragColor = vec4(uColor, alpha);
  }
`;

/**
 * Mounts the spotlight on `canvas`. `host` is the hero section whose visibility
 * gates rendering. Returns null when WebGL is unavailable.
 */
export function mountHeroSpotlight(canvas: HTMLCanvasElement, host: HTMLElement): HeroSpotlightHandle | null {
  const profile = pickProfile();

  // Create the context ourselves: when WebGL is unavailable (blocked GPU, privacy
  // settings) three.js would log an error to the console before throwing.
  const attributes: WebGLContextAttributes = {
    antialias: false,
    alpha: true,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  };
  const gl = canvas.getContext('webgl2', attributes) ?? canvas.getContext('webgl', attributes);
  if (!gl) return null;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, ...attributes });
  } catch (error) {
    // The hero is complete without the beams; note why they are missing and carry on.
    console.warn('[hero] spotlight renderer could not start', error);
    return null;
  }

  const software = isSoftwareRenderer(renderer.getContext());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 50);
  camera.position.set(0, 0, 5);

  // ─── Volumetric cones (spotlight beams) ────────────────────────────────
  const coneGeo = new THREE.ConeGeometry(3, 8, profile.coneSegments, 1, true);
  const coneMaterial = (opacity: number) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#C9A84C') },
        uOpacity: { value: opacity },
      },
      vertexShader: CONE_VERTEX,
      fragmentShader: CONE_FRAGMENT,
    });

  const mat1 = coneMaterial(0.08);
  const cone1 = new THREE.Mesh(coneGeo, mat1);
  cone1.position.set(0, 2, -2);
  cone1.rotation.z = Math.PI;
  scene.add(cone1);

  // Secondary beam (dimmer, offset left)
  const mat2 = coneMaterial(0.04);
  const cone2 = new THREE.Mesh(coneGeo, mat2);
  cone2.position.set(-1.5, 2.5, -3);
  cone2.rotation.z = Math.PI;
  cone2.rotation.x = 0.15;
  cone2.scale.setScalar(0.7);
  scene.add(cone2);

  // Third beam (dimmer, offset right)
  const mat3 = coneMaterial(0.04);
  const cone3 = new THREE.Mesh(coneGeo, mat3);
  cone3.position.set(1.5, 2.5, -3);
  cone3.rotation.z = Math.PI;
  cone3.rotation.x = -0.15;
  cone3.scale.setScalar(0.7);
  scene.add(cone3);

  // ─── Floating gold dust ────────────────────────────────────────────────
  const dustCount = profile.dustCount;
  const dustGeo = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(dustCount * 3);
  const dustVelocities = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 8;
    dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 6;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1;
    dustVelocities[i * 3] = (Math.random() - 0.5) * 0.003;
    dustVelocities[i * 3 + 1] = Math.random() * 0.004 + 0.001;
    dustVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
  }
  const dustAttribute = new THREE.BufferAttribute(dustPositions, 3);
  dustGeo.setAttribute('position', dustAttribute);
  const dustMat = new THREE.PointsMaterial({
    color: 0xc9a84c,
    size: 0.025,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  scene.add(new THREE.Points(dustGeo, dustMat));

  // ─── Sizing ─────────────────────────────────────────────────────────────
  let scale = software ? SOFTWARE_START_SCALE : 1;
  let downscales = 0;
  /** Set when even the smallest buffer exceeds the frame budget: the last frame stays on screen. */
  let frozen = false;
  let cssWidth = 0;
  let cssHeight = 0;

  const applySize = (width: number, height: number) => {
    cssWidth = Math.max(1, Math.round(width));
    cssHeight = Math.max(1, Math.round(height));
    renderer.setPixelRatio(pixelRatioFor(profile, cssWidth, cssHeight, scale));
    // updateStyle=false: the canvas is sized by CSS (100% of the hero).
    renderer.setSize(cssWidth, cssHeight, false);
    camera.aspect = cssWidth / cssHeight;
    camera.updateProjectionMatrix();
    if (frozen) renderer.render(scene, camera); // setSize clears the canvas; repaint the frozen frame
  };

  const initialRect = host.getBoundingClientRect();
  applySize(initialRect.width || window.innerWidth, initialRect.height || window.innerHeight);

  // Mobile browsers resize the viewport while their toolbars collapse during a
  // scroll. Re-allocating the drawing buffer for those small height-only
  // changes would stall scrolling, so only react to real size changes.
  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (!entry) return;
    const { width, height } = entry.contentRect;
    const widthChanged = Math.abs(width - cssWidth) >= 2;
    const heightChanged = Math.abs(height - cssHeight) > Math.max(120, cssHeight * 0.2);
    if (widthChanged || heightChanged) applySize(width, height);
  });
  resizeObserver.observe(host);

  // ─── Loop ───────────────────────────────────────────────────────────────
  let clock = 0;
  let rafId = 0;
  let running = false;
  let inView = true;
  let lastFrame = 0;
  let windowFrames = 0;
  let windowCost = 0;
  let disposed = false;

  const frame = (now: number) => {
    rafId = requestAnimationFrame(frame);
    const elapsed = now - lastFrame;
    if (elapsed < FRAME_INTERVAL_MS - 1) return;
    lastFrame = now;
    const dt = Math.min(elapsed, 100) / 1000;

    const frameStart = performance.now();
    clock += dt * CLOCK_SPEED;
    mat1.uniforms.uTime.value = clock;
    mat2.uniforms.uTime.value = clock + 1.0;
    mat3.uniforms.uTime.value = clock + 2.0;

    // Slow spotlight sway
    cone1.rotation.x = Math.sin(clock * 0.3) * 0.08;
    cone1.position.x = Math.sin(clock * 0.2) * 0.3;
    cone2.rotation.x = Math.sin(clock * 0.25 + 1) * 0.1 + 0.15;
    cone3.rotation.x = Math.sin(clock * 0.25 + 2) * 0.1 - 0.15;

    // Drift the dust (velocities are authored per 60 Hz frame)
    const step = dt * 60;
    for (let i = 0; i < dustCount; i++) {
      let x = dustPositions[i * 3] + dustVelocities[i * 3] * step;
      let y = dustPositions[i * 3 + 1] + dustVelocities[i * 3 + 1] * step;
      const z = dustPositions[i * 3 + 2] + dustVelocities[i * 3 + 2] * step;
      if (y > 4) y = -3;
      if (x > 5) x = -5;
      if (x < -5) x = 5;
      dustPositions[i * 3] = x;
      dustPositions[i * 3 + 1] = y;
      dustPositions[i * 3 + 2] = z;
    }
    dustAttribute.needsUpdate = true;

    renderer.render(scene, camera);

    // Frame-cost governor: measure what this layer costs the main thread. If the average
    // exceeds the budget, shrink the buffer; once it cannot shrink further, stop animating
    // (the canvas keeps showing the last frame).
    windowCost += performance.now() - frameStart;
    if (++windowFrames >= BUDGET_WINDOW_FRAMES) {
      const average = windowCost / windowFrames;
      windowFrames = 0;
      windowCost = 0;
      if (average > FRAME_BUDGET_MS) {
        if (downscales < MAX_DOWNSCALES) {
          downscales++;
          scale *= DOWNSCALE_STEP;
          applySize(cssWidth, cssHeight);
        } else {
          frozen = true;
          sync();
        }
      }
    }
  };

  const sync = () => {
    const shouldRun = inView && !document.hidden && !disposed && !frozen;
    if (shouldRun && !running) {
      running = true;
      lastFrame = performance.now();
      rafId = requestAnimationFrame(frame);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(rafId);
    }
  };

  const intersectionObserver = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (!entry) return;
    inView = entry.isIntersecting;
    sync();
  });
  intersectionObserver.observe(host);
  document.addEventListener('visibilitychange', sync);
  sync();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      sync();
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', sync);
      coneGeo.dispose();
      mat1.dispose();
      mat2.dispose();
      mat3.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
