'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

/**
 * Preloader — WebGL Curtain Physics Preloader (Phase 4, Spec 4.1)
 *
 * Architecture:
 * 1. CSS body::before (globals.css) renders a black fullscreen overlay from first paint.
 * 2. This component creates a Three.js canvas with cloth-simulated theatre curtains.
 * 3. The curtains part dramatically to reveal the site underneath.
 * 4. On animation complete, fades everything out and marks done.
 *
 * Cooldown: 5-min localStorage check prevents replay on every navigation.
 * The inline script in layout.tsx adds 'preloader-skip' before React hydrates.
 */

// ─── Cloth Physics Constants ────────────────────────────────────────────────
const CLOTH_SEGMENTS_X = 24;
const CLOTH_SEGMENTS_Y = 32;
const DAMPING = 0.97;
const GRAVITY = new THREE.Vector3(0, -0.0008, 0);
const WIND_STRENGTH = 0.0003;
const STRUCTURAL_SPRING = 0.92;
const CURTAIN_OPEN_SPEED = 0.015;
const CURTAIN_DELAY_MS = 800; // Delay before curtains begin to part

// ─── Cloth Particle ─────────────────────────────────────────────────────────
class ClothParticle {
  position: THREE.Vector3;
  previous: THREE.Vector3;
  acceleration: THREE.Vector3;
  pinned: boolean;
  mass: number;
  invMass: number;

  constructor(x: number, y: number, z: number, mass = 1.0) {
    this.position = new THREE.Vector3(x, y, z);
    this.previous = new THREE.Vector3(x, y, z);
    this.acceleration = new THREE.Vector3();
    this.pinned = false;
    this.mass = mass;
    this.invMass = 1 / mass;
  }

  addForce(force: THREE.Vector3) {
    this.acceleration.addScaledVector(force, this.invMass);
  }

  integrate(dt: number) {
    if (this.pinned) return;

    const newPos = new THREE.Vector3();
    newPos.copy(this.position);
    newPos.addScaledVector(
      new THREE.Vector3().subVectors(this.position, this.previous),
      DAMPING
    );
    newPos.addScaledVector(this.acceleration, dt * dt);

    this.previous.copy(this.position);
    this.position.copy(newPos);
    this.acceleration.set(0, 0, 0);
  }
}

// ─── Spring Constraint ──────────────────────────────────────────────────────
class SpringConstraint {
  p1: ClothParticle;
  p2: ClothParticle;
  restLength: number;

  constructor(p1: ClothParticle, p2: ClothParticle) {
    this.p1 = p1;
    this.p2 = p2;
    this.restLength = p1.position.distanceTo(p2.position);
  }

  satisfy() {
    const diff = new THREE.Vector3().subVectors(this.p2.position, this.p1.position);
    const currentLength = diff.length();
    if (currentLength === 0) return;

    const correction = diff.multiplyScalar(
      (1 - this.restLength / currentLength) * STRUCTURAL_SPRING * 0.5
    );

    if (!this.p1.pinned) this.p1.position.add(correction);
    if (!this.p2.pinned) this.p2.position.sub(correction);
  }
}

// ─── Cloth Simulation ───────────────────────────────────────────────────────
class ClothSimulation {
  particles: ClothParticle[][];
  constraints: SpringConstraint[];
  width: number;
  height: number;
  segX: number;
  segY: number;

  constructor(width: number, height: number, segX: number, segY: number, offsetX: number) {
    this.width = width;
    this.height = height;
    this.segX = segX;
    this.segY = segY;
    this.particles = [];
    this.constraints = [];

    // Create particle grid
    for (let y = 0; y <= segY; y++) {
      const row: ClothParticle[] = [];
      for (let x = 0; x <= segX; x++) {
        const px = offsetX + (x / segX) * width;
        const py = 1.5 - (y / segY) * height;
        const pz = Math.sin((x / segX) * Math.PI) * 0.15; // Slight depth curve
        row.push(new ClothParticle(px, py, pz));
      }
      this.particles.push(row);
    }

    // Pin top row (curtain rod)
    for (let x = 0; x <= segX; x++) {
      this.particles[0][x].pinned = true;
    }

    // Build constraints (structural springs)
    for (let y = 0; y <= segY; y++) {
      for (let x = 0; x <= segX; x++) {
        if (x < segX) {
          this.constraints.push(new SpringConstraint(this.particles[y][x], this.particles[y][x + 1]));
        }
        if (y < segY) {
          this.constraints.push(new SpringConstraint(this.particles[y][x], this.particles[y + 1][x]));
        }
        // Shear springs for stability
        if (x < segX && y < segY) {
          this.constraints.push(new SpringConstraint(this.particles[y][x], this.particles[y + 1][x + 1]));
          this.constraints.push(new SpringConstraint(this.particles[y][x + 1], this.particles[y + 1][x]));
        }
      }
    }
  }

  simulate(windOffset: number) {
    // Apply forces
    for (let y = 0; y <= this.segY; y++) {
      for (let x = 0; x <= this.segX; x++) {
        const p = this.particles[y][x];
        if (p.pinned) continue;

        p.addForce(GRAVITY);

        // Wind with turbulence
        const windX = Math.sin(windOffset + y * 0.3 + x * 0.2) * WIND_STRENGTH;
        const windZ = Math.cos(windOffset * 0.7 + y * 0.2) * WIND_STRENGTH * 0.5;
        p.addForce(new THREE.Vector3(windX, 0, windZ));
      }
    }

    // Integrate
    for (let y = 0; y <= this.segY; y++) {
      for (let x = 0; x <= this.segX; x++) {
        this.particles[y][x].integrate(1.0);
      }
    }

    // Satisfy constraints (3 iterations for stability)
    for (let iter = 0; iter < 3; iter++) {
      for (const constraint of this.constraints) {
        constraint.satisfy();
      }
    }
  }

  openCurtain(direction: number, progress: number) {
    // Move pinned top-row particles outward
    for (let x = 0; x <= this.segX; x++) {
      const p = this.particles[0][x];
      const baseX = p.previous.x;
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      p.position.x = baseX + direction * eased * 2.5;
    }
  }

  updateGeometry(geometry: THREE.BufferGeometry) {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;

    for (let y = 0; y <= this.segY; y++) {
      for (let x = 0; x <= this.segX; x++) {
        const idx = y * (this.segX + 1) + x;
        const p = this.particles[y][x];
        positions.setXYZ(idx, p.position.x, p.position.y, p.position.z);
      }
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }
}

// ─── Create Curtain Mesh ────────────────────────────────────────────────────
function createCurtainMesh(
  scene: THREE.Scene,
  segX: number,
  segY: number,
  width: number,
  height: number,
  offsetX: number,
  _isLeft: boolean
): { cloth: ClothSimulation; mesh: THREE.Mesh } {
  const cloth = new ClothSimulation(width, height, segX, segY, offsetX);
  const geometry = new THREE.PlaneGeometry(width, height, segX, segY);

  // Update initial vertex positions from cloth
  cloth.updateGeometry(geometry);

  // Rich velvet material with gold trim
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1a0a0a'),
    roughness: 0.85,
    metalness: 0.05,
    clearcoat: 0.1,
    clearcoatRoughness: 0.4,
    side: THREE.DoubleSide,
    emissive: new THREE.Color('#C9A84C'),
    emissiveIntensity: 0.03,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  return { cloth, mesh };
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const dismissedRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;

    try {
      localStorage.setItem('ab-preloader-time', String(Date.now()));
      sessionStorage.setItem('ab-preloader-played', 'true');
    } catch {
      // Storage may be unavailable in private browsing
    }

    document.documentElement.classList.add('preloader-done');
    document.body.style.overflow = '';
    setDismissed(true);
  }, []);

  useEffect(() => {
    const html = document.documentElement;

    // Cooldown check
    if (html.classList.contains('preloader-skip')) return;
    const lastPlayed = parseInt(localStorage.getItem('ab-preloader-time') || '0');
    if (lastPlayed && Date.now() - lastPlayed < 300000) {
      html.classList.add('preloader-skip');
      return;
    }

    // Lock scroll
    document.body.style.overflow = 'hidden';

    const canvas = canvasRef.current;
    if (!canvas) {
      dismiss();
      return;
    }

    // ─── Three.js Setup ───────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050505');
    scene.fog = new THREE.FogExp2(0x050505, 0.3);

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.5, 3.5);
    camera.lookAt(0, 0.3, 0);

    // ─── Lighting ─────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.4);
    scene.add(ambientLight);

    // Gold spotlight from above (theatre lighting)
    const spotLight = new THREE.SpotLight(0xC9A84C, 3, 10, Math.PI / 4, 0.6, 1.5);
    spotLight.position.set(0, 3, 2);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.set(512, 512);
    scene.add(spotLight);

    // Rim lights
    const rimLeft = new THREE.PointLight(0xC9A84C, 0.8, 6);
    rimLeft.position.set(-2, 1, 1);
    scene.add(rimLeft);

    const rimRight = new THREE.PointLight(0xC9A84C, 0.8, 6);
    rimRight.position.set(2, 1, 1);
    scene.add(rimRight);

    // Stage floor
    const floorGeo = new THREE.PlaneGeometry(6, 4);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.6;
    floor.receiveShadow = true;
    scene.add(floor);

    // Curtain rod (gold bar)
    const rodGeo = new THREE.CylinderGeometry(0.015, 0.015, 3.6, 8);
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0xC9A84C,
      metalness: 0.9,
      roughness: 0.2,
    });
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, 1.52, 0);
    scene.add(rod);

    // ─── Cloth Curtains ───────────────────────────────────────────────
    const curtainWidth = 1.6;
    const curtainHeight = 3.2;

    const leftCurtain = createCurtainMesh(
      scene, CLOTH_SEGMENTS_X, CLOTH_SEGMENTS_Y,
      curtainWidth, curtainHeight, -curtainWidth * 0.5 - 0.2, true
    );

    const rightCurtain = createCurtainMesh(
      scene, CLOTH_SEGMENTS_X, CLOTH_SEGMENTS_Y,
      curtainWidth, curtainHeight, curtainWidth * 0.5 - curtainWidth + 0.2, false
    );

    // ─── AB Logo (Text placeholder — gold diamond) ────────────────────
    const logoGeo = new THREE.OctahedronGeometry(0.12, 0);
    const logoMat = new THREE.MeshStandardMaterial({
      color: 0xC9A84C,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0xC9A84C,
      emissiveIntensity: 0.3,
    });
    const logo = new THREE.Mesh(logoGeo, logoMat);
    logo.position.set(0, 0.3, -0.5);
    logo.visible = false;
    scene.add(logo);

    // ─── Floating gold particles ──────────────────────────────────────
    const particleCount = 80;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 4;
      particlePositions[i * 3 + 1] = Math.random() * 3 - 1;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 2;
      particleSizes[i] = Math.random() * 3 + 1;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

    const particleMat = new THREE.PointsMaterial({
      color: 0xC9A84C,
      size: 0.02,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // ─── Animation State ──────────────────────────────────────────────
    let windOffset = 0;
    let openProgress = 0;
    let animationPhase: 'idle' | 'opening' | 'revealing' | 'done' = 'idle';
    let phaseTimer = 0;
    let frameId = 0;

    const startTime = performance.now();

    function animate() {
      frameId = requestAnimationFrame(animate);
      if (dismissedRef.current) return;

      const elapsed = performance.now() - startTime;
      windOffset += 0.02;

      // Phase transitions
      if (animationPhase === 'idle' && elapsed > CURTAIN_DELAY_MS) {
        animationPhase = 'opening';
      }

      if (animationPhase === 'opening') {
        openProgress = Math.min(openProgress + CURTAIN_OPEN_SPEED, 1.0);

        leftCurtain.cloth.openCurtain(-1, openProgress);
        rightCurtain.cloth.openCurtain(1, openProgress);

        // Show logo as curtains part
        if (openProgress > 0.3) {
          logo.visible = true;
          const logoScale = Math.min((openProgress - 0.3) / 0.4, 1.0);
          const eased = 1 - Math.pow(1 - logoScale, 3);
          logo.scale.setScalar(eased);
        }

        // Fade in particles
        if (openProgress > 0.5) {
          particleMat.opacity = Math.min((openProgress - 0.5) * 2, 0.6);
        }

        if (openProgress >= 1.0) {
          animationPhase = 'revealing';
          phaseTimer = performance.now();
        }
      }

      if (animationPhase === 'revealing') {
        const revealElapsed = performance.now() - phaseTimer;
        if (revealElapsed > 1200) {
          animationPhase = 'done';
          dismiss();
        }
      }

      // Simulate cloth physics
      leftCurtain.cloth.simulate(windOffset);
      rightCurtain.cloth.simulate(windOffset + Math.PI);

      leftCurtain.cloth.updateGeometry(leftCurtain.mesh.geometry);
      rightCurtain.cloth.updateGeometry(rightCurtain.mesh.geometry);

      // Animate logo rotation
      if (logo.visible) {
        logo.rotation.y += 0.01;
        logo.rotation.z = Math.sin(elapsed * 0.001) * 0.1;
      }

      // Animate particles floating
      const pPositions = particleGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        const y = pPositions.getY(i);
        pPositions.setY(i, y + 0.002 + Math.sin(windOffset + i) * 0.001);
        if (y > 2.5) {
          pPositions.setY(i, -1.5);
        }
      }
      pPositions.needsUpdate = true;

      // Subtle camera sway
      camera.position.x = Math.sin(elapsed * 0.0003) * 0.05;
      camera.position.y = 0.5 + Math.sin(elapsed * 0.0004) * 0.03;

      // Spotlight pulse
      spotLight.intensity = 3 + Math.sin(elapsed * 0.002) * 0.5;

      renderer.render(scene, camera);
    }

    animate();

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Safety fallback: dismiss after 10s
    const maxTimer = setTimeout(() => {
      if (!dismissedRef.current) dismiss();
    }, 10000);

    // WebGL error fallback
    if (!renderer.getContext()) {
      dismiss();
    }

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(maxTimer);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };
  }, [dismiss]);

  if (dismissed) return null;

  return (
    <div
      ref={containerRef}
      id="ab-preloader-video"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: '#050505',
        transition: 'opacity 0.8s ease-out',
        opacity: dismissed ? 0 : 1,
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {/* Skip button */}
      <button
        onClick={dismiss}
        style={{
          position: 'absolute',
          bottom: '2rem',
          right: '2rem',
          padding: '0.5rem 1.5rem',
          background: 'transparent',
          border: '1px solid rgba(201, 168, 76, 0.3)',
          color: 'rgba(201, 168, 76, 0.6)',
          fontSize: '0.75rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          zIndex: 100001,
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(201, 168, 76, 0.7)';
          e.currentTarget.style.color = 'rgba(201, 168, 76, 1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(201, 168, 76, 0.3)';
          e.currentTarget.style.color = 'rgba(201, 168, 76, 0.6)';
        }}
      >
        Skip
      </button>
    </div>
  );
}
