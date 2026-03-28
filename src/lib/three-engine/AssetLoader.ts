import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import * as THREE from 'three';

export class AssetLoader {
  private gltfLoader: GLTFLoader;
  private basePath: string;

  constructor(renderer: THREE.WebGLRenderer, basePath = '/assets/models/') {
    this.basePath = basePath;
    this.gltfLoader = new GLTFLoader();

    // Setup DRACO for aggressive geometry compression
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.setDecoderConfig({ type: 'js' }); // Fallback to JS if WebAssembly fails
    this.gltfLoader.setDRACOLoader(dracoLoader);

    // Setup KTX2 for VRAM-optimized texture loading (Basis Universal)
    const ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/');
    ktx2Loader.detectSupport(renderer);
    this.gltfLoader.setKTX2Loader(ktx2Loader);
  }

  public async loadCinematicEnvironment(fileName: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        `${this.basePath}${fileName}`,
        (gltf) => {
          // Global mesh optimizations upon load
          gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              
              // Ensure material reacts predictably to our Game of Thrones lighting
              if (mesh.material instanceof THREE.MeshStandardMaterial) {
                mesh.material.envMapIntensity = 1.0; 
                mesh.material.needsUpdate = true;
              }
            }
          });
          resolve(gltf.scene);
        },
        (progressEvent) => {
          if (progressEvent.lengthComputable) {
            const percentComplete = (progressEvent.loaded / progressEvent.total) * 100;
            // In a full implementation, we dispatch this to the Preloader UI
            window.dispatchEvent(new CustomEvent('assetProgress', { detail: { percentComplete } }));
          }
        },
        (error) => {
          console.error(`[AssetLoader] Critical failure loading ${fileName}:`, error);
          reject(error);
        }
      );
    });
  }
}
