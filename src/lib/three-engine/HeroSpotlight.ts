/**
 * Volumetric spotlight layer for the home hero: three gold shader cones plus a
 * field of drifting dust motes, drawn into a transparent canvas above the hero
 * photography. Plain WebGL: the layer is two small programs and two buffers, so
 * it needs no graphics library.
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

type GL = WebGLRenderingContext | WebGL2RenderingContext;

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

/** Camera: 60 degree vertical field of view, 0.1..50 clip range, 5 units in front of the origin. */
const FOV_DEGREES = 60;
const NEAR = 0.1;
const FAR = 50;
const CAMERA_Z = 5;

/** Cone: apex up, 3 units wide at the base, 8 tall, centred on its origin (open at the base). */
const CONE_RADIUS = 3;
const CONE_HEIGHT = 8;
const CONE_COLOR: readonly [number, number, number] = srgbToLinear(0xc9, 0xa8, 0x4c);
/** Dust motes keep the sRGB gold the screen shows. */
const DUST_COLOR: readonly [number, number, number] = [0xc9 / 255, 0xa8 / 255, 0x4c / 255];
const DUST_SIZE = 0.025;
const DUST_OPACITY = 0.5;

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
function isSoftwareRenderer(gl: GL): boolean {
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

/** The cone shader writes its colour straight to the canvas, so the gold is given in linear light. */
function srgbToLinear(red: number, green: number, blue: number): [number, number, number] {
  const channel = (value: number) => {
    const c = value / 255;
    return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
  };
  return [channel(red), channel(green), channel(blue)];
}

// ─── Matrices (column-major, as WebGL expects) ───────────────────────────────

type Mat4 = number[];

function perspective(aspect: number): Mat4 {
  const f = 1 / Math.tan((FOV_DEGREES * Math.PI) / 360);
  const m = new Array<number>(16).fill(0);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = -(FAR + NEAR) / (FAR - NEAR);
  m[11] = -1;
  m[14] = (-2 * FAR * NEAR) / (FAR - NEAR);
  return m;
}

/** Translate, then rotate about X (`rotationX`) and Z (`rotationZ`), then uniformly scale, seen from the camera. */
function modelView(x: number, y: number, z: number, rotationX: number, rotationZ: number, scale: number): Mat4 {
  const a = Math.cos(rotationX);
  const b = Math.sin(rotationX);
  const e = Math.cos(rotationZ);
  const f = Math.sin(rotationZ);
  return [
    e * scale, a * f * scale, b * f * scale, 0,
    -f * scale, a * e * scale, b * e * scale, 0,
    0, -b * scale, a * scale, 0,
    x, y, z - CAMERA_Z, 1,
  ];
}

// ─── Shaders ─────────────────────────────────────────────────────────────────

const CONE_VERTEX = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
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

const DUST_VERTEX = /* glsl */ `
  attribute vec3 position;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uSize;
  uniform float uScale;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Motes shrink with distance: pixels per world unit at that depth.
    gl_PointSize = uSize * (uScale / -mvPosition.z);
  }
`;

const DUST_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
  }
`;

interface Program {
  handle: WebGLProgram;
  attribute: (name: string) => number;
  uniform: (name: string) => WebGLUniformLocation | null;
}

function compile(gl: GL, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('could not create a shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader failed to compile: ${log}`);
  }
  return shader;
}

function link(gl: GL, vertexSource: string, fragmentSource: string): Program {
  const highp = (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision ?? 0) > 0;
  const vertex = compile(gl, gl.VERTEX_SHADER, `precision highp float;\n${vertexSource}`);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, `precision ${highp ? 'highp' : 'mediump'} float;\n${fragmentSource}`);
  const handle = gl.createProgram();
  if (!handle) throw new Error('could not create a program');
  gl.attachShader(handle, vertex);
  gl.attachShader(handle, fragment);
  gl.linkProgram(handle);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(handle);
    gl.deleteProgram(handle);
    throw new Error(`program failed to link: ${log}`);
  }
  return {
    handle,
    attribute: (name) => gl.getAttribLocation(handle, name),
    uniform: (name) => gl.getUniformLocation(handle, name),
  };
}

/** Interleaved x, y, z, u, v for the open cone: one triangle per segment, from the base ring to the apex. */
function coneVertices(segments: number): Float32Array {
  const data = new Float32Array(segments * 3 * 5);
  let offset = 0;
  const push = (x: number, y: number, z: number, u: number, v: number) => {
    data[offset++] = x;
    data[offset++] = y;
    data[offset++] = z;
    data[offset++] = u;
    data[offset++] = v;
  };
  const base = (i: number) => {
    const u = i / segments;
    const theta = u * Math.PI * 2;
    push(CONE_RADIUS * Math.sin(theta), -CONE_HEIGHT / 2, CONE_RADIUS * Math.cos(theta), u, 0);
  };
  const apex = (i: number) => push(0, CONE_HEIGHT / 2, 0, i / segments, 1);
  for (let i = 0; i < segments; i++) {
    base(i);
    base(i + 1);
    apex(i + 1);
  }
  return data;
}

interface Resources {
  cone: Program;
  dust: Program;
  coneBuffer: WebGLBuffer;
  dustBuffer: WebGLBuffer;
}

/**
 * Mounts the spotlight on `canvas`. `host` is the hero section whose visibility
 * gates rendering. Returns null when WebGL is unavailable.
 */
export function mountHeroSpotlight(canvas: HTMLCanvasElement, host: HTMLElement): HeroSpotlightHandle | null {
  const profile = pickProfile();

  const attributes: WebGLContextAttributes = {
    antialias: false,
    alpha: true,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  };
  const gl = canvas.getContext('webgl2', attributes) ?? canvas.getContext('webgl', attributes);
  if (!gl) return null;

  const dustCount = profile.dustCount;
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
  const coneData = coneVertices(profile.coneSegments);
  const coneVertexCount = profile.coneSegments * 3;

  const createResources = (): Resources | null => {
    try {
      const coneBuffer = gl.createBuffer();
      const dustBuffer = gl.createBuffer();
      if (!coneBuffer || !dustBuffer) throw new Error('could not create a buffer');
      gl.bindBuffer(gl.ARRAY_BUFFER, coneBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, coneData, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, dustBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, dustPositions, gl.DYNAMIC_DRAW);
      return {
        cone: link(gl, CONE_VERTEX, CONE_FRAGMENT),
        dust: link(gl, DUST_VERTEX, DUST_FRAGMENT),
        coneBuffer,
        dustBuffer,
      };
    } catch (error) {
      // The hero is complete without the beams; note why they are missing and carry on.
      console.warn('[hero] spotlight renderer could not start', error);
      return null;
    }
  };

  let resources = createResources();
  if (!resources) return null;

  const software = isSoftwareRenderer(gl);

  // ─── Beams: pose, per-beam opacity and time offset ──────────────────────
  interface Beam {
    x: number;
    y: number;
    z: number;
    rotationX: number;
    scale: number;
    opacity: number;
    timeOffset: number;
  }
  const primary: Beam = { x: 0, y: 2, z: -2, rotationX: 0, scale: 1, opacity: 0.08, timeOffset: 0 };
  // Secondary beams: dimmer, offset left and right.
  const left: Beam = { x: -1.5, y: 2.5, z: -3, rotationX: 0.15, scale: 0.7, opacity: 0.04, timeOffset: 1 };
  const right: Beam = { x: 1.5, y: 2.5, z: -3, rotationX: -0.15, scale: 0.7, opacity: 0.04, timeOffset: 2 };
  // Farthest first (the two side beams are level, the left one was added first), then the primary beam.
  const beamsBackToFront = [left, right, primary];

  // ─── Sizing ─────────────────────────────────────────────────────────────
  let scale = software ? SOFTWARE_START_SCALE : 1;
  let downscales = 0;
  /** Set when even the smallest buffer exceeds the frame budget: the last frame stays on screen. */
  let frozen = false;
  let cssWidth = 0;
  let cssHeight = 0;
  let pixelRatio = 1;
  let projection = perspective(1);
  let contextLost = false;

  const drawCones = (r: Resources, time: number) => {
    gl.useProgram(r.cone.handle);
    gl.bindBuffer(gl.ARRAY_BUFFER, r.coneBuffer);
    const position = r.cone.attribute('position');
    const uv = r.cone.attribute('uv');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 20, 12);
    gl.uniformMatrix4fv(r.cone.uniform('projectionMatrix'), false, projection);
    gl.uniform3f(r.cone.uniform('uColor'), CONE_COLOR[0], CONE_COLOR[1], CONE_COLOR[2]);

    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const beam of beamsBackToFront) {
      gl.uniformMatrix4fv(
        r.cone.uniform('modelViewMatrix'),
        false,
        modelView(beam.x, beam.y, beam.z, beam.rotationX, Math.PI, beam.scale),
      );
      gl.uniform1f(r.cone.uniform('uTime'), time + beam.timeOffset);
      gl.uniform1f(r.cone.uniform('uOpacity'), beam.opacity);
      // A cone is seen from inside and outside: the far wall is blended first, then the near wall.
      gl.frontFace(gl.CW);
      gl.drawArrays(gl.TRIANGLES, 0, coneVertexCount);
      gl.frontFace(gl.CCW);
      gl.drawArrays(gl.TRIANGLES, 0, coneVertexCount);
    }
    gl.disableVertexAttribArray(position);
    gl.disableVertexAttribArray(uv);
  };

  const drawDust = (r: Resources) => {
    gl.useProgram(r.dust.handle);
    gl.bindBuffer(gl.ARRAY_BUFFER, r.dustBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, dustPositions);
    const position = r.dust.attribute('position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(r.dust.uniform('projectionMatrix'), false, projection);
    gl.uniformMatrix4fv(r.dust.uniform('modelViewMatrix'), false, modelView(0, 0, 0, 0, 0, 1));
    gl.uniform1f(r.dust.uniform('uSize'), DUST_SIZE * pixelRatio);
    gl.uniform1f(r.dust.uniform('uScale'), cssHeight * 0.5);
    gl.uniform3f(r.dust.uniform('uColor'), DUST_COLOR[0], DUST_COLOR[1], DUST_COLOR[2]);
    gl.uniform1f(r.dust.uniform('uOpacity'), DUST_OPACITY);

    gl.disable(gl.CULL_FACE);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, dustCount);
    gl.disableVertexAttribArray(position);
  };

  let clock = 0;

  const render = () => {
    if (!resources || contextLost) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    drawCones(resources, clock);
    drawDust(resources);
  };

  const applySize = (width: number, height: number) => {
    cssWidth = Math.max(1, Math.round(width));
    cssHeight = Math.max(1, Math.round(height));
    pixelRatio = pixelRatioFor(profile, cssWidth, cssHeight, scale);
    // The canvas is sized by CSS (100% of the hero); only the drawing buffer is allocated here.
    canvas.width = Math.floor(cssWidth * pixelRatio);
    canvas.height = Math.floor(cssHeight * pixelRatio);
    gl.viewport(0, 0, Math.round(cssWidth * pixelRatio), Math.round(cssHeight * pixelRatio));
    projection = perspective(cssWidth / cssHeight);
    if (frozen) render(); // resizing clears the canvas; repaint the frozen frame
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

    // Slow spotlight sway
    primary.rotationX = Math.sin(clock * 0.3) * 0.08;
    primary.x = Math.sin(clock * 0.2) * 0.3;
    left.rotationX = Math.sin(clock * 0.25 + 1) * 0.1 + 0.15;
    right.rotationX = Math.sin(clock * 0.25 + 2) * 0.1 - 0.15;

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

    render();

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

  // The browser may take the GL context away (a backgrounded mobile tab, GPU reset).
  // Cancelling the event lets it hand the context back, and the programs are rebuilt then.
  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
  };
  const onContextRestored = () => {
    resources = createResources();
    contextLost = false;
    applySize(cssWidth, cssHeight);
    render();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

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
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (resources) {
        gl.deleteBuffer(resources.coneBuffer);
        gl.deleteBuffer(resources.dustBuffer);
        gl.deleteProgram(resources.cone.handle);
        gl.deleteProgram(resources.dust.handle);
        resources = null;
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
