import * as THREE from 'three';

let curvePath: THREE.CatmullRomCurve3;

export function setupCinematicCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  
  // Define a majestic, sweeping cinematic path
  curvePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 5, 20),
    new THREE.Vector3(10, 8, 10),
    new THREE.Vector3(5, 4, -10),
    new THREE.Vector3(-10, 2, -20),
    new THREE.Vector3(0, 10, -40)
  ]);
  
  // smooth the curve
  curvePath.tension = 0.5;

  camera.position.copy(curvePath.getPointAt(0));
  camera.lookAt(0, 0, 0);

  return camera;
}

/**
 * Called every frame by the GSAP ticker.
 * Progress is a normalized value between 0.0 and 1.0 driving the cinematic shot.
 */
export function updateCameraPath(camera: THREE.PerspectiveCamera, progress: number) {
  if (!curvePath) return;

  const boundedProgress = Math.max(0, Math.min(1, progress));
  
  // Get point on current position
  const currentPos = curvePath.getPointAt(boundedProgress);
  camera.position.lerp(currentPos, 0.1); // Smooth lerping

  // Look ahead on the path to simulate camera operator anticipating movement
  const lookAheadProgress = Math.min(1, boundedProgress + 0.05);
  const lookTarget = curvePath.getPointAt(lookAheadProgress);
  
  // We use a dummy object to softly interpolate rotation (quaternions) to avoid rigid snapping
  const dummy = new THREE.Object3D();
  dummy.position.copy(camera.position);
  dummy.lookAt(lookTarget);
  
  camera.quaternion.slerp(dummy.quaternion, 0.05);
}
