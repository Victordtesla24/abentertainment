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
  public timer: THREE.Timer;
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
  private interactiveSpotLight: THREE.SpotLight | null = null;
  private spotLightTargetObject: THREE.Object3D | null = null;
  private pointerTarget = new THREE.Vector2(0, 0);
  private pointerCurrent = new THREE.Vector2(0, 0);
  private pointerDelta = new THREE.Vector2(0, 0);
  private pointerPrev = new THREE.Vector2(0, 0);
  private reducedMotion = false;
  private boundPointerMoveHandler: ((e: PointerEvent) => void) | null = null;

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined') {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // Core Game of Thrones aesthetic colors (slate/obsidian dark base)
    this.scene.background = new THREE.Color(0x0a0a0c);
    this.scene.fog = new THREE.FogExp2(0x0a0a0c, 0.015);

    this.camera = setupCinematicCamera();
    // Timer replaces the deprecated Clock (THREE r183+). Semantic parity is
    // preserved via timer.reset() on resume (context-restored / tab-visible).
    this.timer = new THREE.Timer();
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
        ThreeEngine.instance.attachPointerMoveHandler();
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
      // No need to pause the timer — render() is gated by isContextLost and
      // won't call timer.update() while paused.
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
      // Reset the timer so the first delta after resume is small rather than
      // reflecting the entire context-lost duration.
      this.timer.reset();
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
        // Tab hidden — pause to save GPU/battery.
        // rAF is paused automatically by the browser, so timer.update() stops.
        this.wasRenderingBeforeHidden = this.isInitialized && !this.isContextLost;
      } else {
        // Tab visible — reset the timer so the first delta after resume is small
        // rather than reflecting the entire hidden duration.
        if (this.wasRenderingBeforeHidden && !this.isContextLost) {
          this.timer.reset();
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

    this.interactiveSpotLight = new THREE.SpotLight(0xc9a84c, 1.8, 42, Math.PI / 7, 0.42, 1);
    this.interactiveSpotLight.position.set(0, 12, 14);
    this.interactiveSpotLight.castShadow = false;
    this.scene.add(this.interactiveSpotLight);

    this.spotLightTargetObject = new THREE.Object3D();
    this.spotLightTargetObject.position.set(0, 0, 0);
    this.scene.add(this.spotLightTargetObject);
    this.interactiveSpotLight.target = this.spotLightTargetObject;
  }

  public setPointerNormalized(x: number, y: number) {
    this.pointerTarget.set(x, y);
  }

  /**
   * Create an InstancedMesh particle system for performant rendering of many identical objects.
   * Particles are NOT created as individual Mesh objects; they share a single geometry/material.
   * Existing particle content uses THREE.Points with BufferGeometry (already optimal for point clouds).
   * This method is available for future use when mesh-based particles are needed.
   */
  public createInstancedParticles(
    count: number,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    positionFn: (index: number) => THREE.Vector3
  ): THREE.InstancedMesh {
    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const pos = positionFn(i);
      dummy.position.copy(pos);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(instancedMesh);
    return instancedMesh;
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

  /** Attach pointermove listener on canvas for interactive particle forces */
  private attachPointerMoveHandler() {
    if (this.reducedMotion) return;
    this.boundPointerMoveHandler = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      this.pointerDelta.set(nx - this.pointerPrev.x, ny - this.pointerPrev.y);
      this.pointerPrev.set(nx, ny);
      this.pointerTarget.set(nx, ny);
    };
    this.canvas.addEventListener('pointermove', this.boundPointerMoveHandler, { passive: true });
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
    if (this.boundPointerMoveHandler) {
      this.canvas.removeEventListener('pointermove', this.boundPointerMoveHandler);
      this.boundPointerMoveHandler = null;
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

    this.timer.update(performance.now());
    const delta = this.timer.getDelta();
    this.pointerCurrent.lerp(this.pointerTarget, 1 - Math.exp(-delta * 6));
    if (this.interactiveSpotLight && this.spotLightTargetObject) {
      this.interactiveSpotLight.position.x = this.pointerCurrent.x * 8;
      this.interactiveSpotLight.position.y = 10 + this.pointerCurrent.y * 2;
      this.spotLightTargetObject.position.x = this.pointerCurrent.x * 5;
      this.spotLightTargetObject.position.y = this.pointerCurrent.y * 3;
      this.spotLightTargetObject.updateMatrixWorld();
    }
    
    // 1. Failsafe 60fps telemetry
    const isHealthy = this.monitor.checkHealth(delta);
    
    // 2. Update cinematic camera position based on GSAP scroll progress
    updateCameraPath(this.camera, scrollProgress);

    // 2b. Apply subtle mouse-driven force to particles (gated behind reduced-motion)
    if (!this.reducedMotion && (Math.abs(this.pointerDelta.x) > 0.001 || Math.abs(this.pointerDelta.y) > 0.001)) {
      const DAMPING = 0.95;
      const forceMagnitude = 0.04;
      this.scene.traverse((object) => {
        if (object instanceof THREE.Points) {
          const pos = object.geometry.getAttribute('position') as THREE.BufferAttribute;
          if (pos) {
            for (let i = 0; i < pos.count; i++) {
              pos.setX(i, pos.getX(i) + this.pointerDelta.x * forceMagnitude);
              pos.setY(i, pos.getY(i) + this.pointerDelta.y * forceMagnitude);
            }
            pos.needsUpdate = true;
          }
        }
      });
      // Damp the delta so the force fades
      this.pointerDelta.multiplyScalar(DAMPING);
    }

    // 3. Render
    if (this.postProcessing && isHealthy) {
      this.postProcessing.render(delta);
    } else {
      // Degraded absolute fallback
      this.renderer.render(this.scene, this.camera);
    }
  }
}
