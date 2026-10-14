/**
 * Light stage behind the sponsors and partners of an event page: a soft gold light pool falling from above, a field of
 * slowly drifting dust motes that catch it and, when the cards can be measured, faint light threads between the cards of a
 * group. Everything is drawn into one transparent canvas that sits behind the logo cards. Plain WebGL like HeroSpotlight:
 * three small programs and three buffers, so it needs no graphics library.
 *
 * Brand colours only. Every colour the shaders use is one of the design system's golds (GOLD, GOLD_LIGHT, GOLD_PALE,
 * GOLD_DARK below, each named after its token) and reaches them as a uniform; the light is composited over the page's
 * #0A0A0A, so the result never leaves the gold-to-black line.
 *
 * Cost controls (the same contract as HeroSpotlight, so the page's other layers never pay for this one):
 *  - the drawing buffer is sized to a pixel budget instead of devicePixelRatio, then stretched to the CSS size by the
 *    browser (the light is a soft gradient, so a small buffer shows no difference);
 *  - animation is time-based and capped at 30 fps; the motes are moved by the vertex shader from a few uniforms, so a
 *    frame uploads no vertex data and costs the main thread a handful of uniform writes and three draw calls;
 *  - rendering stops while the section is off-screen or the tab is hidden;
 *  - the main-thread cost of every frame is measured: a device where the stage costs more than a few milliseconds a
 *    frame (software rendering, weak mobile GPUs, a throttled CPU) first gets a smaller drawing buffer, and if that is
 *    still too expensive the stage freezes on its last frame instead of competing with the page for the main thread;
 *  - software renderers (SwiftShader, llvmpipe) start at the smallest buffer;
 *  - card positions are measured on mount, on resize and when asked (refresh), never per frame;
 *  - the GL context is released on dispose so route changes never leak contexts.
 */

export type SponsorStageState = 'live' | 'frozen' | 'lost';

export interface SponsorStageOptions {
  /**
   * The cards of each group of the section, in reading order. The stage draws a faint light thread between neighbouring
   * cards of a group (a minimum spanning tree of their centres, so no thread crosses a heading) and centres its light
   * pool on the cards. Read on mount, on resize and by refresh(), never per frame. Without it the stage has no threads.
   */
  cardGroups?: () => ReadonlyArray<ReadonlyArray<HTMLElement>>;
  /** Told when the stage starts drawing ('live'), when the frame-cost governor froze it ('frozen'), and when the browser took
   *  the GL context away ('lost'); after a successful restore it is told 'live' or 'frozen' again. */
  onStateChange?: (state: SponsorStageState) => void;
}

export interface SponsorStageHandle {
  /** Measure the cards again (the list of cards changed); a resize of the section is noticed without this. */
  refresh(): void;
  dispose(): void;
}

type GL = WebGLRenderingContext | WebGL2RenderingContext;

// ─── Brand colours (design system tokens, docs/design-system/colors_and_type.css) ──────────────────────────────

/** A design-system colour as the 0..1 channels a shader uniform takes. */
const brandColor = (red: number, green: number, blue: number): readonly [number, number, number] => [red / 255, green / 255, blue / 255];

/** --color-gold #C9A84C: the body of the light and of the threads. */
const GOLD = brandColor(0xc9, 0xa8, 0x4c);
/** --color-gold-light #D4B65C: the dust motes. */
const GOLD_LIGHT = brandColor(0xd4, 0xb6, 0x5c);
/** --color-gold-pale #E8D5A3: the hot core of the light, a mote's glint inside it and the pulse that runs along a thread. */
const GOLD_PALE = brandColor(0xe8, 0xd5, 0xa3);
/** --color-gold-dark #B0923F: the cool fringe of the light. */
const GOLD_DARK = brandColor(0xb0, 0x92, 0x3f);

// ─── Cost controls ────────────────────────────────────────────────────────────────────────────────────────────

const FRAME_INTERVAL_MS = 1000 / 30;
const MIN_PIXEL_RATIO = 0.25;
/** Main-thread milliseconds one frame may cost (render + updates) before quality is reduced. */
const FRAME_BUDGET_MS = 5;
/** Frames between budget checks (~1 s at 30 fps). */
const BUDGET_WINDOW_FRAMES = 30;
const DOWNSCALE_STEP = 0.7;
const MAX_DOWNSCALES = 3;
/** Starting buffer scale on software renderers, where even a small layer is expensive. */
const SOFTWARE_START_SCALE = 0.5;
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

interface Profile {
  dustCount: number;
  pixelBudget: number;
  maxPixelRatio: number;
}

function pickProfile(): Profile {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const constrained = window.innerWidth < 1024 || (nav.deviceMemory !== undefined && nav.deviceMemory <= 4);
  return constrained
    ? { dustCount: 36, pixelBudget: 90_000, maxPixelRatio: 1 }
    : { dustCount: 90, pixelBudget: 200_000, maxPixelRatio: 1 };
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

// ─── Look ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Size of a mote in CSS px at mid depth. */
const MOTE_SIZE = 2.8;
/** How quickly the light follows the pointer and the scroll, per second (it settles in about a third of a second). */
const PARALLAX_SMOOTHING = 3.2;
/** A pointer farther than this from the section lets the light settle back to the middle. */
const POINTER_MARGIN_PX = 160;

// ─── Shaders ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The light, shared by the fragment shader that paints it and the vertex shader that lights the motes. Positions are CSS
 * px from the section's top left. The opacities are tuned for white and gold text over #0A0A0A: the brightest pixel adds
 * about a quarter of the gold, which keeps gold text above 5:1 and white text above 11:1.
 */
const LIGHT_GLSL = /* glsl */ `
  uniform vec2 uSize;
  uniform float uTime;
  uniform vec2 uParallax;
  uniform float uScroll;
  uniform vec2 uPoolCenter;
  uniform vec2 uPoolRadius;

  const float BEAM_ALPHA = 0.22;
  const float POOL_ALPHA = 0.10;
  const float BEAM_LENGTH = 820.0;

  // Light falling from a source just above the section: 1 on the axis, fading with the angle and the distance.
  float beamAt(vec2 px) {
    vec2 source = vec2(uSize.x * (0.5 + uParallax.x * 0.04), -80.0);
    vec2 d = px - source;
    float dist = length(d);
    float ang = atan(d.x, d.y);
    float cone = 1.0 - smoothstep(0.05, 0.85, abs(ang));
    float haze = 0.8 + 0.2 * sin(ang * 21.0 + uTime * 0.2 + sin(ang * 6.0 - uTime * 0.12) * 1.6);
    return cone * exp(-dist / BEAM_LENGTH) * haze;
  }

  // Where the light lands: a soft ellipse over the cards that breathes very slowly.
  float poolAt(vec2 px) {
    vec2 q = (px - uPoolCenter - uParallax * vec2(14.0, 8.0)) / uPoolRadius;
    float breathe = 1.0 + 0.05 * sin(uTime * 0.35);
    return exp(-dot(q, q) / (breathe * breathe));
  }

  // Nothing is ever cut at an edge: the light fades out before the section's left, right, top and bottom.
  float edgeFade(vec2 px) {
    float margin = min(120.0, uSize.x * 0.14);
    float across = smoothstep(0.0, margin, px.x) * (1.0 - smoothstep(uSize.x - margin, uSize.x, px.x));
    float top = smoothstep(0.0, 36.0, px.y);
    float bottom = 1.0 - smoothstep(uSize.y - 160.0, uSize.y, px.y);
    return across * top * bottom;
  }
`;

const LIGHT_VERTEX = /* glsl */ `
  attribute vec2 aCorner;
  varying vec2 vUv;
  void main() {
    vUv = vec2(aCorner.x * 0.5 + 0.5, 0.5 - aCorner.y * 0.5);
    gl_Position = vec4(aCorner, 0.0, 1.0);
  }
`;

const LIGHT_FRAGMENT = /* glsl */ `
  ${LIGHT_GLSL}
  uniform vec3 uGold;
  uniform vec3 uGoldDark;
  uniform vec3 uGoldPale;
  varying vec2 vUv;

  void main() {
    vec2 px = vUv * uSize;
    float beam = beamAt(px);
    float light = beam * BEAM_ALPHA + poolAt(px) * POOL_ALPHA;

    vec3 colour = mix(uGoldDark, uGold, smoothstep(0.02, 0.22, light));
    colour = mix(colour, uGoldPale, smoothstep(0.55, 1.0, beam) * 0.5);

    // A little noise keeps the very soft gradient from banding in 8-bit.
    float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    float alpha = max(light * edgeFade(px) + noise / 255.0, 0.0);
    gl_FragColor = vec4(colour * alpha, alpha);
  }
`;

const DUST_VERTEX = /* glsl */ `
  ${LIGHT_GLSL}
  attribute vec4 aSeed;
  attribute float aDepth;
  uniform float uPointScale;
  uniform float uMoteSize;
  varying float vAlpha;
  varying float vGlint;

  const float DUST_ALPHA = 0.75;

  void main() {
    // motes rise 0.010..0.024 of the section's height a second: about ten to forty seconds to cross it
    float rise = uTime * (0.010 + 0.014 * aSeed.w);
    float y = fract(aSeed.y - rise);
    float x = aSeed.x
      + sin(uTime * (0.22 + 0.2 * aSeed.w) + aSeed.z * 6.2831853) * 0.016
      + sin(y * 9.0 + aSeed.z * 11.0) * 0.007;
    // nearer motes (depth 1) travel farther with the pointer and with the scroll
    x = fract(x + uParallax.x * 0.03 * aDepth + 1.0);
    y = y + uParallax.y * 0.015 * aDepth + uScroll * 0.04 * aDepth;

    vec2 px = vec2(x, y) * uSize;
    float lit = clamp(beamAt(px) * 2.2, 0.0, 1.0);
    float twinkle = 0.6 + 0.4 * sin(uTime * (0.8 + 1.2 * aSeed.w) + aSeed.z * 6.2831853);
    // a mote smaller than one buffer pixel is drawn one pixel wide and dimmed by the share of the pixel it covers
    float size = uMoteSize * uPointScale * (0.5 + aDepth);
    vAlpha = DUST_ALPHA * twinkle * (0.25 + 0.75 * lit) * (0.5 + 0.5 * aDepth) * edgeFade(px) * min(1.0, size);
    vGlint = lit;

    gl_Position = vec4(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
    gl_PointSize = max(1.0, size);
  }
`;

const DUST_FRAGMENT = /* glsl */ `
  uniform vec3 uGoldLight;
  uniform vec3 uGoldPale;
  varying float vAlpha;
  varying float vGlint;

  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float soft = 1.0 - smoothstep(0.0, 1.0, r);
    float alpha = vAlpha * soft * soft;
    gl_FragColor = vec4(mix(uGoldLight, uGoldPale, vGlint) * alpha, alpha);
  }
`;

const THREAD_VERTEX = /* glsl */ `
  attribute vec2 aPosition;
  attribute vec3 aAlongPhaseBirth;
  uniform vec2 uSize;
  uniform vec2 uParallax;
  varying vec3 vAlongPhaseBirth;

  void main() {
    // the threads sway a few pixels with the pointer, like the light above them
    vec2 p = aPosition + uParallax * vec2(6.0, 4.0);
    vAlongPhaseBirth = aAlongPhaseBirth;
    gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
  }
`;

const THREAD_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uGain;
  uniform vec3 uGold;
  uniform vec3 uGoldPale;
  varying vec3 vAlongPhaseBirth;

  const float THREAD_ALPHA = 0.12;

  void main() {
    float along = vAlongPhaseBirth.x;
    // a short glint travels along each thread, a different moment on each one
    float head = fract(uTime * 0.07 + vAlongPhaseBirth.y);
    float gap = abs(along - head);
    gap = min(gap, 1.0 - gap);
    float pulse = exp(-gap * gap * 90.0);
    float ends = smoothstep(0.0, 0.14, along) * (1.0 - smoothstep(0.86, 1.0, along));
    // a thread appears with its cards, over a second
    float arrival = smoothstep(0.0, 1.2, uTime - vAlongPhaseBirth.z);
    float alpha = (THREAD_ALPHA + 0.2 * pulse) * ends * arrival * uGain;
    gl_FragColor = vec4(mix(uGold, uGoldPale, pulse) * alpha, alpha);
  }
`;

// ─── Programs ─────────────────────────────────────────────────────────────────────────────────────────────────

interface Program {
  handle: WebGLProgram;
  attributes: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
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

function link(gl: GL, vertexSource: string, fragmentSource: string, attributes: readonly string[], uniforms: readonly string[]): Program {
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
  // Locations are looked up once; a frame only writes values.
  return {
    handle,
    attributes: Object.fromEntries(attributes.map((name) => [name, gl.getAttribLocation(handle, name)])),
    uniforms: Object.fromEntries(uniforms.map((name) => [name, gl.getUniformLocation(handle, name)])),
  };
}

interface Resources {
  light: Program;
  dust: Program;
  thread: Program;
  cornerBuffer: WebGLBuffer;
  dustBuffer: WebGLBuffer;
  threadBuffer: WebGLBuffer;
}

// ─── Geometry ─────────────────────────────────────────────────────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
}

/** One triangle that covers the whole canvas. */
const CORNERS = new Float32Array([-1, -1, 3, -1, -1, 3]);

/** x0, y0, phase, speed (all 0..1) and depth (0.25..1) for every mote, interleaved. */
function dustSeeds(count: number): Float32Array {
  const data = new Float32Array(count * 5);
  for (let i = 0; i < count; i++) {
    data[i * 5] = Math.random();
    data[i * 5 + 1] = Math.random();
    data[i * 5 + 2] = Math.random();
    data[i * 5 + 3] = Math.random();
    data[i * 5 + 4] = 0.25 + Math.random() * 0.75;
  }
  return data;
}

/** The position of an element inside `ancestor`'s padding box from layout alone: unaffected by transforms such as a tilt or a rise. */
function offsetWithin(element: HTMLElement, ancestor: HTMLElement): Point {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = element;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

/** Prim's algorithm: the shortest set of links that joins every point (n is at most the page's 100 sponsors). */
function spanningEdges(points: readonly Point[]): Array<[number, number]> {
  const count = points.length;
  const edges: Array<[number, number]> = [];
  if (count < 2) return edges;
  const inTree = new Array<boolean>(count).fill(false);
  const best = new Array<number>(count).fill(Infinity);
  const parent = new Array<number>(count).fill(-1);
  best[0] = 0;
  for (let step = 0; step < count; step++) {
    let next = -1;
    for (let i = 0; i < count; i++) if (!inTree[i] && (next === -1 || best[i] < best[next])) next = i;
    inTree[next] = true;
    if (parent[next] !== -1) edges.push([parent[next], next]);
    for (let i = 0; i < count; i++) {
      if (inTree[i]) continue;
      const distance = (points[next].x - points[i].x) ** 2 + (points[next].y - points[i].y) ** 2;
      if (distance < best[i]) {
        best[i] = distance;
        parent[i] = next;
      }
    }
  }
  return edges;
}

const THREAD_FLOATS = 5;

/**
 * Interleaved x, y (CSS px), position along the thread (0..1), a phase for its glint and the moment it first appeared,
 * two vertices per thread. A thread that was already there keeps its moment (`births`, keyed by where it runs).
 */
function threadVertices(groups: ReadonlyArray<readonly Point[]>, births: Map<string, number>, now: number): Float32Array {
  const links: Array<[Point, Point]> = [];
  for (const centres of groups) for (const [a, b] of spanningEdges(centres)) links.push([centres[a], centres[b]]);
  const known = new Set<string>();
  const data = new Float32Array(links.length * 2 * THREAD_FLOATS);
  links.forEach(([a, b], index) => {
    const key = `${Math.round(a.x)},${Math.round(a.y)}>${Math.round(b.x)},${Math.round(b.y)}`;
    known.add(key);
    const birth = births.get(key) ?? now;
    births.set(key, birth);
    const phase = (index * 0.381966) % 1;
    data.set([a.x, a.y, 0, phase, birth, b.x, b.y, 1, phase, birth], index * 2 * THREAD_FLOATS);
  });
  for (const key of births.keys()) if (!known.has(key)) births.delete(key);
  return data;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * Mounts the stage on `canvas`. `host` is the section whose box the canvas covers and whose visibility gates rendering.
 * Returns null when WebGL is unavailable or the programs cannot be built.
 */
export function mountSponsorStage(canvas: HTMLCanvasElement, host: HTMLElement, options: SponsorStageOptions = {}): SponsorStageHandle | null {
  const profile = pickProfile();

  const attributes: WebGLContextAttributes = {
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  };
  const gl = canvas.getContext('webgl2', attributes) ?? canvas.getContext('webgl', attributes);
  if (!gl) return null;

  const seeds = dustSeeds(profile.dustCount);
  let threads: Float32Array = new Float32Array(0);
  const threadBirths = new Map<string, number>();

  const createResources = (): Resources | null => {
    try {
      const cornerBuffer = gl.createBuffer();
      const dustBuffer = gl.createBuffer();
      const threadBuffer = gl.createBuffer();
      if (!cornerBuffer || !dustBuffer || !threadBuffer) throw new Error('could not create a buffer');
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, CORNERS, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, dustBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, threadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, threads, gl.DYNAMIC_DRAW);
      const lightUniforms = ['uSize', 'uTime', 'uParallax', 'uScroll', 'uPoolCenter', 'uPoolRadius'];
      return {
        light: link(gl, LIGHT_VERTEX, LIGHT_FRAGMENT, ['aCorner'], [...lightUniforms, 'uGold', 'uGoldDark', 'uGoldPale']),
        dust: link(gl, DUST_VERTEX, DUST_FRAGMENT, ['aSeed', 'aDepth'], [...lightUniforms, 'uPointScale', 'uMoteSize', 'uGoldLight', 'uGoldPale']),
        thread: link(gl, THREAD_VERTEX, THREAD_FRAGMENT, ['aPosition', 'aAlongPhaseBirth'], ['uSize', 'uParallax', 'uTime', 'uGain', 'uGold', 'uGoldPale']),
        cornerBuffer,
        dustBuffer,
        threadBuffer,
      };
    } catch (error) {
      // The section is complete without the light; note why it is missing and carry on.
      console.warn('[sponsors] stage renderer could not start', error);
      return null;
    }
  };

  let resources = createResources();
  if (!resources) return null;

  const software = isSoftwareRenderer(gl);

  // ─── Sizing and measuring ─────────────────────────────────────────────
  let scale = software ? SOFTWARE_START_SCALE : 1;
  let downscales = 0;
  /** Set when even the smallest buffer exceeds the frame budget: the last frame stays on screen. */
  let frozen = false;
  let cssWidth = 1;
  let cssHeight = 1;
  let pixelRatio = 1;
  let contextLost = false;
  /** Where the light pool is drawn, and where it is heading: it glides there, so a group arriving never makes it jump. */
  let poolCenter: Point = { x: 0, y: 0 };
  let poolRadius: Point = { x: 1, y: 1 };
  let poolCenterTarget: Point = poolCenter;
  let poolRadiusTarget: Point = poolRadius;
  let poolPlaced = false;

  let sizeChanged = false;

  const measure = () => {
    const groups = (options.cardGroups?.() ?? []).map((group) =>
      group.map((card): Point => {
        const origin = offsetWithin(card, host);
        return { x: origin.x + card.offsetWidth / 2, y: origin.y + card.offsetHeight / 2 };
      }),
    );
    threads = threadVertices(groups, threadBirths, clock);
    const centres = groups.flat();
    if (centres.length > 0) {
      const xs = centres.map((point) => point.x);
      const ys = centres.map((point) => point.y);
      const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      poolCenterTarget = { x: (left + right) / 2, y: (top + bottom) / 2 };
      poolRadiusTarget = { x: Math.max(160, ((right - left) / 2) * 1.2 + 140), y: Math.max(120, ((bottom - top) / 2) * 1.2 + 110) };
    } else {
      poolCenterTarget = { x: cssWidth / 2, y: cssHeight * 0.55 };
      poolRadiusTarget = { x: cssWidth * 0.34, y: cssHeight * 0.2 };
    }
    // the first placement, a resize and a stage that is not drawing take their place at once; a running stage glides
    if (!poolPlaced || !running || sizeChanged) {
      poolCenter = poolCenterTarget;
      poolRadius = poolRadiusTarget;
      poolPlaced = true;
    }
    sizeChanged = false;
    if (resources && !contextLost) {
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.threadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, threads, gl.DYNAMIC_DRAW);
    }
  };

  // ─── Drawing ──────────────────────────────────────────────────────────
  let clock = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let scroll = 0;

  const setLight = (program: Program) => {
    gl.uniform2f(program.uniforms.uSize, cssWidth, cssHeight);
    gl.uniform1f(program.uniforms.uTime, clock);
    gl.uniform2f(program.uniforms.uParallax, parallaxX, parallaxY);
    gl.uniform1f(program.uniforms.uScroll, scroll);
    gl.uniform2f(program.uniforms.uPoolCenter, poolCenter.x, poolCenter.y);
    gl.uniform2f(program.uniforms.uPoolRadius, poolRadius.x, poolRadius.y);
  };

  const drawLight = (r: Resources) => {
    const { light } = r;
    gl.useProgram(light.handle);
    gl.bindBuffer(gl.ARRAY_BUFFER, r.cornerBuffer);
    gl.enableVertexAttribArray(light.attributes.aCorner);
    gl.vertexAttribPointer(light.attributes.aCorner, 2, gl.FLOAT, false, 0, 0);
    setLight(light);
    gl.uniform3f(light.uniforms.uGold, GOLD[0], GOLD[1], GOLD[2]);
    gl.uniform3f(light.uniforms.uGoldDark, GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
    gl.uniform3f(light.uniforms.uGoldPale, GOLD_PALE[0], GOLD_PALE[1], GOLD_PALE[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(light.attributes.aCorner);
  };

  const drawThreads = (r: Resources) => {
    const vertexCount = threads.length / THREAD_FLOATS;
    if (vertexCount === 0) return;
    const { thread } = r;
    const stride = THREAD_FLOATS * 4;
    gl.useProgram(thread.handle);
    gl.bindBuffer(gl.ARRAY_BUFFER, r.threadBuffer);
    gl.enableVertexAttribArray(thread.attributes.aPosition);
    gl.vertexAttribPointer(thread.attributes.aPosition, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(thread.attributes.aAlongPhaseBirth);
    gl.vertexAttribPointer(thread.attributes.aAlongPhaseBirth, 3, gl.FLOAT, false, stride, 8);
    gl.uniform2f(thread.uniforms.uSize, cssWidth, cssHeight);
    gl.uniform2f(thread.uniforms.uParallax, parallaxX, parallaxY);
    gl.uniform1f(thread.uniforms.uTime, clock);
    // a line is one buffer pixel wide: on a small buffer it is thicker, so it is dimmed to keep its presence
    gl.uniform1f(thread.uniforms.uGain, Math.sqrt(Math.min(1, pixelRatio)));
    gl.uniform3f(thread.uniforms.uGold, GOLD[0], GOLD[1], GOLD[2]);
    gl.uniform3f(thread.uniforms.uGoldPale, GOLD_PALE[0], GOLD_PALE[1], GOLD_PALE[2]);
    gl.drawArrays(gl.LINES, 0, vertexCount);
    gl.disableVertexAttribArray(thread.attributes.aPosition);
    gl.disableVertexAttribArray(thread.attributes.aAlongPhaseBirth);
  };

  const drawDust = (r: Resources) => {
    const { dust } = r;
    gl.useProgram(dust.handle);
    gl.bindBuffer(gl.ARRAY_BUFFER, r.dustBuffer);
    gl.enableVertexAttribArray(dust.attributes.aSeed);
    gl.vertexAttribPointer(dust.attributes.aSeed, 4, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(dust.attributes.aDepth);
    gl.vertexAttribPointer(dust.attributes.aDepth, 1, gl.FLOAT, false, 20, 16);
    setLight(dust);
    gl.uniform1f(dust.uniforms.uPointScale, pixelRatio);
    gl.uniform1f(dust.uniforms.uMoteSize, MOTE_SIZE);
    gl.uniform3f(dust.uniforms.uGoldLight, GOLD_LIGHT[0], GOLD_LIGHT[1], GOLD_LIGHT[2]);
    gl.uniform3f(dust.uniforms.uGoldPale, GOLD_PALE[0], GOLD_PALE[1], GOLD_PALE[2]);
    gl.drawArrays(gl.POINTS, 0, profile.dustCount);
    gl.disableVertexAttribArray(dust.attributes.aSeed);
    gl.disableVertexAttribArray(dust.attributes.aDepth);
  };

  const render = () => {
    if (!resources || contextLost) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    // The shaders write premultiplied colour, so every layer is composited "over".
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    drawLight(resources);
    drawThreads(resources);
    drawDust(resources);
  };

  const applySize = (width: number, height: number) => {
    sizeChanged = Math.max(1, Math.round(width)) !== cssWidth || Math.max(1, Math.round(height)) !== cssHeight;
    cssWidth = Math.max(1, Math.round(width));
    cssHeight = Math.max(1, Math.round(height));
    pixelRatio = pixelRatioFor(profile, cssWidth, cssHeight, scale);
    // The canvas is sized by CSS (the section's padding box); only the drawing buffer is allocated here.
    canvas.width = Math.floor(cssWidth * pixelRatio);
    canvas.height = Math.floor(cssHeight * pixelRatio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    measure();
    if (frozen || !running) render(); // resizing clears the canvas; repaint when no frame is coming to do it
  };

  // ─── Pointer and scroll ───────────────────────────────────────────────
  let hostRect = host.getBoundingClientRect();
  let rectDirty = false;
  let pointerClientX = Number.NaN;
  let pointerClientY = Number.NaN;

  const onPointerMove = (event: PointerEvent) => {
    // A touch drag is a scroll: on touch screens the light follows the scroll instead (see the frame).
    if (event.pointerType === 'touch') return;
    pointerClientX = event.clientX;
    pointerClientY = event.clientY;
  };
  const onViewportChange = () => {
    rectDirty = true;
  };

  // ─── Loop ─────────────────────────────────────────────────────────────
  let rafId = 0;
  let running = false;
  let inView = true;
  let lastFrame = 0;
  let windowFrames = 0;
  let windowCost = 0;
  let disposed = false;
  let reportedLive = false;

  const initialWidth = host.clientWidth || window.innerWidth;
  const initialHeight = host.clientHeight || window.innerHeight;
  applySize(initialWidth, initialHeight);

  const frame = (now: number) => {
    rafId = requestAnimationFrame(frame);
    const elapsed = now - lastFrame;
    if (elapsed < FRAME_INTERVAL_MS - 1) return;
    lastFrame = now;
    const dt = Math.min(elapsed, 100) / 1000;

    const frameStart = performance.now();
    clock += dt;

    if (rectDirty) {
      hostRect = host.getBoundingClientRect();
      rectDirty = false;
    }
    // Where the light leans: the pointer over (or just beside) the section, else the middle.
    let targetX = 0;
    let targetY = 0;
    if (!Number.isNaN(pointerClientX)) {
      const near =
        pointerClientX > hostRect.left - POINTER_MARGIN_PX && pointerClientX < hostRect.right + POINTER_MARGIN_PX &&
        pointerClientY > hostRect.top - POINTER_MARGIN_PX && pointerClientY < hostRect.bottom + POINTER_MARGIN_PX;
      if (near) {
        targetX = clamp(((pointerClientX - hostRect.left) / Math.max(1, hostRect.width) - 0.5) * 2, -1, 1);
        targetY = clamp(((pointerClientY - hostRect.top) / Math.max(1, hostRect.height) - 0.5) * 2, -1, 1);
      }
    }
    const follow = 1 - Math.exp(-dt * PARALLAX_SMOOTHING);
    parallaxX += (targetX - parallaxX) * follow;
    parallaxY += (targetY - parallaxY) * follow;
    // How far the section has travelled through the screen, -1 (entering below) to 1 (leaving above).
    const through = (hostRect.top + hostRect.height / 2 - window.innerHeight / 2) / (window.innerHeight / 2 + hostRect.height / 2);
    scroll += (clamp(-through, -1, 1) - scroll) * follow;
    poolCenter = { x: poolCenter.x + (poolCenterTarget.x - poolCenter.x) * follow, y: poolCenter.y + (poolCenterTarget.y - poolCenter.y) * follow };
    poolRadius = { x: poolRadius.x + (poolRadiusTarget.x - poolRadius.x) * follow, y: poolRadius.y + (poolRadiusTarget.y - poolRadius.y) * follow };

    render();

    if (!reportedLive) {
      reportedLive = true;
      options.onStateChange?.('live');
    }

    // Frame-cost governor: measure what this layer costs the main thread. If the average exceeds the budget, shrink the
    // buffer; once it cannot shrink further, stop animating (the canvas keeps showing the last frame).
    windowCost += performance.now() - frameStart;
    if (++windowFrames >= BUDGET_WINDOW_FRAMES) {
      const average = windowCost / windowFrames;
      windowFrames = 0;
      windowCost = 0;
      if (average > FRAME_BUDGET_MS) {
        // A step that would not make the buffer any smaller (it is already at the minimum) is not worth a second of waiting.
        const shrinks = pixelRatioFor(profile, cssWidth, cssHeight, scale * DOWNSCALE_STEP) < pixelRatio - 0.005;
        if (downscales < MAX_DOWNSCALES && shrinks) {
          downscales++;
          scale *= DOWNSCALE_STEP;
          applySize(cssWidth, cssHeight);
        } else {
          frozen = true;
          sync();
          options.onStateChange?.('frozen');
        }
      }
    }
  };

  const sync = () => {
    const shouldRun = inView && !document.hidden && !disposed && !frozen;
    if (shouldRun && !running) {
      running = true;
      lastFrame = performance.now();
      rectDirty = true;
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('scroll', onViewportChange, { passive: true });
      rafId = requestAnimationFrame(frame);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onViewportChange);
    }
  };

  // The section can change size when its cards change, fonts arrive or the window is resized.
  const resizeObserver = new ResizeObserver(() => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    rectDirty = true;
    if (Math.abs(width - cssWidth) >= 2 || Math.abs(height - cssHeight) >= 2) applySize(width, height);
  });
  resizeObserver.observe(host);

  // The browser may take the GL context away (a backgrounded mobile tab, GPU reset).
  // Cancelling the event lets it hand the context back, and the programs are rebuilt then.
  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    options.onStateChange?.('lost');
  };
  const onContextRestored = () => {
    resources = createResources();
    // A context that comes back without usable resources stays 'lost', so the caller keeps its static glow.
    if (!resources) return;
    contextLost = false;
    applySize(cssWidth, cssHeight);
    render();
    options.onStateChange?.(frozen ? 'frozen' : 'live');
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
    refresh() {
      if (disposed) return;
      measure();
      if (!running) render();
    },
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
        gl.deleteBuffer(resources.cornerBuffer);
        gl.deleteBuffer(resources.dustBuffer);
        gl.deleteBuffer(resources.threadBuffer);
        gl.deleteProgram(resources.light.handle);
        gl.deleteProgram(resources.dust.handle);
        gl.deleteProgram(resources.thread.handle);
        resources = null;
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
