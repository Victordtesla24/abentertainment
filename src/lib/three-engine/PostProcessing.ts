import * as THREE from 'three';
// Note: Depending on the bundler configuration, these imports usually come from `three/examples/jsm/...` or `three/addons/...`
// We leave them structured for modern three.js usage. If missing, we will implement custom shaders.
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';

export class PostProcessingPipeline {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private bokehPass: BokehPass;
  private filmPass: FilmPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.composer = new EffectComposer(renderer);

    // 1. Base Render
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // 2. Cinematic Bloom (Optical Halation)
    // parameters: resolution, strength, radius, threshold
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.8,  // Strength - adjusted to prevent washing out UI text
      0.4,  // Radius
      0.85  // Threshold - only bloom very bright pixels
    );
    this.composer.addPass(this.bloomPass);

    // 3. Cinematic Depth of Field (Bokeh)
    this.bokehPass = new BokehPass(scene, camera, {
      focus: 10.0,
      aperture: 0.00005,
      maxblur: 0.01
    });
    this.composer.addPass(this.bokehPass);

    // 4. Analog Film Grain
    // parameters: intensity, grayscale
    this.filmPass = new FilmPass(0.15, false);
    this.composer.addPass(this.filmPass);
  }

  public resize(width: number, height: number) {
    this.composer.setSize(width, height);
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
  }

  public render(delta: number) {
    // We could dynamically animate focus distance for Bokeh here based on raycasting
    this.composer.render(delta);
  }

  /** Dispose all post-processing passes and render targets */
  public dispose() {
    this.composer.renderTarget1?.dispose();
    this.composer.renderTarget2?.dispose();
    for (const pass of this.composer.passes) {
      if ('dispose' in pass && typeof pass.dispose === 'function') {
        pass.dispose();
      }
    }
  }
}
