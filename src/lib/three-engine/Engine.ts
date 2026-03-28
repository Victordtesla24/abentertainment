import * as THREE from 'three';
// Note: In newer versions of three.js, WebGPURenderer handles WebGL fallback automatically
// import WebGPURenderer from 'three/addons/renderers/webgpu/WebGPURenderer.js';

import { PostProcessingPipeline } from './PostProcessing';
import { setupCinematicCamera, updateCameraPath } from './CinematicCamera';
import { FailsafeMonitor } from './FailsafeMonitor';

export class ThreeEngine {
  private static instance: ThreeEngine;
  
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer!: THREE.WebGLRenderer; // Fallback to WebGL for absolute stability if WebGPURenderer import fails in this env
  public clock: THREE.Clock;
  private canvas: HTMLCanvasElement;
  
  public postProcessing?: PostProcessingPipeline;
  private monitor: FailsafeMonitor;
  private isInitialized = false;

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

  public static async getInstance(canvas: HTMLCanvasElement): Promise<ThreeEngine> {
    if (!ThreeEngine.instance) {
      ThreeEngine.instance = new ThreeEngine(canvas);
      await ThreeEngine.instance.initRenderer();
      // Only setup lights and post-processing if renderer initialized successfully
      if (ThreeEngine.instance.isInitialized && ThreeEngine.instance.renderer) {
        ThreeEngine.instance.setupLights();
        ThreeEngine.instance.postProcessing = new PostProcessingPipeline(
          ThreeEngine.instance.renderer,
          ThreeEngine.instance.scene,
          ThreeEngine.instance.camera
        );
      }
    } else {
      ThreeEngine.instance.bindCanvas(canvas);
    }
    return ThreeEngine.instance;
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
    
    window.addEventListener('resize', this.onWindowResize.bind(this));
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

  // The main 60FPS render loop
  public render(scrollProgress: number) {
    if (!this.isInitialized) return;

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
