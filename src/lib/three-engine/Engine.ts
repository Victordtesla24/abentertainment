import * as THREE from 'three';
// Note: In newer versions of three.js, WebGPURenderer handles WebGL fallback automatically
// import WebGPURenderer from 'three/addons/renderers/webgpu/WebGPURenderer.js';

import { PostProcessingPipeline } from './PostProcessing';
import { setupCinematicCamera, updateCameraPath } from './CinematicCamera';
import { FailsafeMonitor } from './FailsafeMonitor';

/** Options for context loss/restore callbacks */
export interface ThreeEngineCallbacks {
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onFallback?: () => void;
}

export class ThreeEngine {
  private static instance: ThreeEngine;
  private static isDisposing = false;

  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer!: THREE.WebGLRenderer; // Fallback to WebGL for absolute stability if WebGPURenderer import fails in this env
  public clock: THREE.Clock;
  private canvas: HTMLCanvasElement;

  public postProcessing?: PostProcessingPipeline;
  private monitor: FailsafeMonitor;
  private isInitialized = false;
  private boundResizeHandler: (() => void) | null = null;

  // Context loss/restore state
  private isContextLost = false;
  private contextLossCount = 0;
  private static readonly MAX_CONTEXT_RECOVERIES = 3;
  private callbacks: ThreeEngineCallbacks = {};

  // Bound event handlers for cleanup
  private boundContextLostHandler: ((e: Event) => void) | null = null;
  private boundContextRestoredHandler: ((e: Event) => void) | null = null;
  private boundVisibilityChangeHandler: (() => void) | null = null;

  // Visibility state
  private wasRenderingBeforeHidden = false;

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();

    // Core Game of Thrones aesthetic colors (slate/obsidian dark base)
    this.scene.background = new THREE.Color(0x0a0a0c);
    this.scene.fog = new THREE.FogExp2(0x0a0a0c, 0.015);

    this.camera = setupCinematicCamera();
    this.clock = new THREE.Clock();
    this.monitor = new FailsafeMonitor();
  }

  public static async getInstance(
    canvas: HTMLCanvasElement,
    callbacks?: ThreeEngineCallbacks
  ): Promise<ThreeEngine> {
    if (ThreeEngine.isDisposing) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!ThreeEngine.instance) {
      ThreeEngine.instance = new ThreeEngine(canvas);
      if (callbacks) {
        ThreeEngine.instance.callbacks = callbacks;
      }
      await ThreeEngine.instance.initRenderer();
      // Only setup lights and post-processing if renderer initialized successfully
      if (ThreeEngine.instance.isInitialized && ThreeEngine.instance.renderer) {
        // Break up heavy initialization using requestIdleCallback to avoid >50ms long tasks
        await ThreeEngine.instance.scheduleIdleWork(() => {
          ThreeEngine.instance.setupLights();
        });
        await ThreeEngine.instance.scheduleIdleWork(() => {
          ThreeEngine.instance.postProcessing = new PostProcessingPipeline(
            ThreeEngine.instance.renderer,
            ThreeEngine.instance.scene,
            ThreeEngine.instance.camera
          );
        });
        // Attach context loss/restore and visibility listeners
        ThreeEngine.instance.attachContextHandlers();
        ThreeEngine.instance.attachVisibilityHandler();
      }
    } else {
      ThreeEngine.instance.bindCanvas(canvas);
      if (callbacks) {
        ThreeEngine.instance.callbacks = callbacks;
      }
    }
    return ThreeEngine.instance;
  }

  /** Schedule a unit of work via requestIdleCallback (with setTimeout fallback) */
  private scheduleIdleWork(work: () => void): Promise<void> {
    return new Promise((resolve) => {
      const callback = () => {
        work();
        resolve();
      };
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(callback, { timeout: 3000 });
      } else {
        setTimeout(callback, 0);
      }
    });
  }

  /** Attach WebGL context lost/restored handlers to the canvas */
  private attachContextHandlers() {
    this.boundContextLostHandler = (event: Event) => {
      event.preventDefault(); // REQUIRED — tells the browser we intend to restore
      this.isContextLost = true;
      this.clock.stop();
      console.warn('[ThreeEngine] WebGL context lost.');
      this.callbacks.onContextLost?.();
    };

    this.boundContextRestoredHandler = (_event: Event) => {
      this.contextLossCount++;
      console.warn(
        `[ThreeEngine] WebGL context restored (recovery #${this.contextLossCount}).`
      );

      if (this.contextLossCount >= ThreeEngine.MAX_CONTEXT_RECOVERIES) {
        // Too many recoveries — switch to CSS/video fallback permanently
        console.warn(
          '[ThreeEngine] Max context recoveries exceeded, switching to fallback.'
        );
        this.isContextLost = true;
        this.isInitialized = false;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('webgl-context-failed', {
            detail: new Error('WebGL context lost too many times'),
          }));
        }
        this.callbacks.onFallback?.();
        return;
      }

      // Rebuild the renderer on the same canvas
      this.rebuildRenderer();
      this.isContextLost = false;
      this.clock.start();
      this.callbacks.onContextRestored?.();
    };

    this.canvas.addEventListener('webglcontextlost', this.boundContextLostHandler);
    this.canvas.addEventListener('webglcontextrestored', this.boundContextRestoredHandler);
  }

  /** Rebuild the WebGL renderer after context restore */
  private rebuildRenderer() {
    // Dispose old renderer (context is already gone, but clean up internal state)
    this.renderer?.dispose();

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      powerPreference: 'high-performance',
      antialias: false,
      stencil: false,
      depth: true,
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // Mark all materials and textures as needing re-upload to GPU
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const mat of materials) {
          mat.needsUpdate = true;
          if (mat.map) mat.map.needsUpdate = true;
          if (mat.normalMap) mat.normalMap.needsUpdate = true;
          if (mat.roughnessMap) mat.roughnessMap.needsUpdate = true;
          if (mat.metalnessMap) mat.metalnessMap.needsUpdate = true;
          if (mat.aoMap) mat.aoMap.needsUpdate = true;
          if (mat.emissiveMap) mat.emissiveMap.needsUpdate = true;
        }
      }
    });

    // Rebuild post-processing pipeline with the new renderer
    if (this.postProcessing) {
      this.postProcessing.dispose?.();
      this.postProcessing = new PostProcessingPipeline(
        this.renderer,
        this.scene,
        this.camera
      );
    }
  }

  /** Pause rendering when the tab is hidden, resume when visible */
  private attachVisibilityHandler() {
    this.boundVisibilityChangeHandler = () => {
      if (document.hidden) {
        // Tab hidden — pause to save GPU/battery
        this.wasRenderingBeforeHidden = this.isInitialized && !this.isContextLost;
        this.clock.stop();
      } else {
        // Tab visible — resume if we were rendering before and context is OK
        if (this.wasRenderingBeforeHidden && !this.isContextLost) {
          this.clock.start();
        }
      }
    };

    document.addEventListener('visibilitychange', this.boundVisibilityChangeHandler);
  }

  private bindCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // Handle re-binding if React completely destroys the DOM node
    // although our layout architecture tries to prevent this
  }

  private async initRenderer() {
    try {
      // Standard WebGL2 fallback architecture (as requested by robustness)
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        powerPreference: 'high-performance',
        antialias: false, // Turned off because PostProcessing handles AA
        stencil: false,
        depth: true
      });

      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance

      // Crucial for cinematic linear workflow and Physically Based Rendering
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;

      // Soft shadow setup
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;

      this.isInitialized = true;
    } catch (err) {
      // WebGL context creation failed (headless browser, weak GPU, etc.)
      // Dispatch event for failsafe monitor to show video fallback
      this.isInitialized = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('webgl-context-failed', { detail: err }));
      }
      return;
    }
    
    this.boundResizeHandler = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.boundResizeHandler);
  }

  private setupLights() {
    // Cinematic Motivated Lighting (Game of Thrones style)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffcaa6, 2.5); // Warm directional sun/fire
    directionalLight.position.set(50, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.bias = -0.0001;
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x4a6070, 0.8); // Cool blue shadow fill
    fillLight.position.set(-20, 10, -20);
    this.scene.add(fillLight);
  }

  private onWindowResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.postProcessing) {
      this.postProcessing.resize(window.innerWidth, window.innerHeight);
    }
  }

  /** Remove all event listeners — call from component cleanup to prevent memory leaks */
  public removeListeners() {
    if (this.boundResizeHandler) {
      window.removeEventListener('resize', this.boundResizeHandler);
      this.boundResizeHandler = null;
    }
    if (this.boundContextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this.boundContextLostHandler);
      this.boundContextLostHandler = null;
    }
    if (this.boundContextRestoredHandler) {
      this.canvas.removeEventListener('webglcontextrestored', this.boundContextRestoredHandler);
      this.boundContextRestoredHandler = null;
    }
    if (this.boundVisibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.boundVisibilityChangeHandler);
      this.boundVisibilityChangeHandler = null;
    }
  }

  /** Full cleanup — call from component unmount to free GPU memory */
  public dispose() {
    if (ThreeEngine.isDisposing) return;
    ThreeEngine.isDisposing = true;

    this.removeListeners();

    // 1. Dispose post-processing FIRST (before renderer — needs GL context)
    if (this.postProcessing) {
      this.postProcessing.dispose?.();
      this.postProcessing = undefined;
    }

    // 2. Traverse scene and dispose all geometries, materials, and textures
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const mat of materials) {
          mat.map?.dispose();
          mat.normalMap?.dispose();
          mat.roughnessMap?.dispose();
          mat.metalnessMap?.dispose();
          mat.aoMap?.dispose();
          mat.emissiveMap?.dispose();
          mat.dispose();
        }
      }
    });

    // 3. Clear scene children
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }

    // 4. Dispose renderer LAST (releases WebGL context)
    this.renderer?.dispose();
    // Eagerly release the WebGL context so the GPU slot is freed immediately
    this.renderer?.forceContextLoss();

    // 5. Clear singleton so next mount creates fresh instance
    ThreeEngine.instance = null as unknown as ThreeEngine;
    ThreeEngine.isDisposing = false;
  }

  /** Whether the WebGL context is currently lost */
  public get contextLost(): boolean {
    return this.isContextLost;
  }

  /** Whether the tab is currently hidden */
  public get tabHidden(): boolean {
    return typeof document !== 'undefined' && document.hidden;
  }

  // The main 60FPS render loop
  public render(scrollProgress: number) {
    if (!this.isInitialized || this.isContextLost) return;

    const delta = this.clock.getDelta();
    
    // 1. Failsafe 60fps telemetry
    const isHealthy = this.monitor.checkHealth(delta);
    
    // 2. Update cinematic camera position based on GSAP scroll progress
    updateCameraPath(this.camera, scrollProgress);

    // 3. Render
    if (this.postProcessing && isHealthy) {
      this.postProcessing.render(delta);
    } else {
      // Degraded absolute fallback
      this.renderer.render(this.scene, this.camera);
    }
  }
}
