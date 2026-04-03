'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

function CurtainScene({ open }: { open: boolean }) {
  const positionsRef = useRef<Float32Array>(new Float32Array(0));
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const worldRef = useRef<CANNON.World | null>(null);
  const pointsRef = useRef<CANNON.Body[]>([]);
  const curtainSizeRef = useRef({ cols: 14, rows: 22, pointsPerCurtain: 14 * 22 });

  useEffect(() => {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -8.5, 0) });
    world.broadphase = new CANNON.NaiveBroadphase();
    (world.solver as CANNON.GSSolver).iterations = 5;
    worldRef.current = world;

    const { cols, rows, pointsPerCurtain } = curtainSizeRef.current;
    const spacingX = 0.12;
    const spacingY = 0.09;
    const leftStartX = -1.4;
    const rightStartX = 0.05;
    const startY = 1.2;

    const allPoints: CANNON.Body[] = [];

    const createCurtain = (baseX: number) => {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const mass = y === 0 ? 0 : 0.045;
          const body = new CANNON.Body({
            mass,
            linearDamping: 0.45,
            angularDamping: 0.65,
            shape: new CANNON.Particle(),
            position: new CANNON.Vec3(baseX + x * spacingX, startY - y * spacingY, 0),
          });
          world.addBody(body);
          allPoints.push(body);
        }
      }
    };

    createCurtain(leftStartX);
    createCurtain(rightStartX);

    const connectCurtainConstraints = (offset: number) => {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = offset + y * cols + x;
          if (x < cols - 1) {
            world.addConstraint(
              new CANNON.DistanceConstraint(
                allPoints[idx],
                allPoints[offset + y * cols + (x + 1)],
                spacingX
              )
            );
          }
          if (y < rows - 1) {
            world.addConstraint(
              new CANNON.DistanceConstraint(
                allPoints[idx],
                allPoints[offset + (y + 1) * cols + x],
                spacingY
              )
            );
          }
        }
      }
    };

    connectCurtainConstraints(0);
    connectCurtainConstraints(pointsPerCurtain);

    pointsRef.current = allPoints;
    positionsRef.current = new Float32Array(allPoints.length * 3);

    return () => {
      world.constraints.forEach((constraint) => world.removeConstraint(constraint));
      allPoints.forEach((body) => world.removeBody(body));
      pointsRef.current = [];
      worldRef.current = null;
    };
  }, []);

  useFrame((_state, delta) => {
    const world = worldRef.current;
    if (!world || pointsRef.current.length === 0) return;

    const dt = Math.min(1 / 30, Math.max(1 / 120, delta));
    world.step(1 / 60, dt, 2);

    const { pointsPerCurtain } = curtainSizeRef.current;
    if (open) {
      for (let i = 0; i < pointsRef.current.length; i++) {
        const body = pointsRef.current[i];
        if (body.mass === 0) continue;
        const isLeft = i < pointsPerCurtain;
        body.velocity.x += (isLeft ? -0.4 : 0.4) * dt;
      }
    }

    const positions = positionsRef.current;
    for (let i = 0; i < pointsRef.current.length; i++) {
      const p = pointsRef.current[i].position;
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }

    if (geometryRef.current) {
      geometryRef.current.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
      );
      geometryRef.current.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points>
      <bufferGeometry ref={geometryRef} />
      <pointsMaterial
        color="#7a1f1f"
        size={0.018}
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </points>
  );
}

export default function Preloader() {
  const [dismissed, setDismissed] = useState(false);
  const [curtainsOpen, setCurtainsOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
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

    setCurtainsOpen(true);
    window.setTimeout(() => {
      document.documentElement.classList.add('preloader-done');
      document.body.style.overflow = '';
      window.dispatchEvent(new CustomEvent('ab:preloader-complete'));
      setDismissed(true);
    }, 900);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const automatedBrowser = typeof navigator !== 'undefined' && navigator.webdriver;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const onMotionChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mediaQuery.addEventListener('change', onMotionChange);

    // Keep automation deterministic and avoid test flakiness on full-screen overlays.
    if (automatedBrowser) {
      html.classList.add('preloader-skip');
    }

    if (html.classList.contains('preloader-skip')) {
      dismissedRef.current = true;
      html.classList.add('preloader-done');
      window.dispatchEvent(new CustomEvent('ab:preloader-complete'));
      setDismissed(true);
      return;
    }
    const lastPlayed = parseInt(localStorage.getItem('ab-preloader-time') || '0');
    if (lastPlayed && Date.now() - lastPlayed < 300000) {
      html.classList.add('preloader-skip');
      return;
    }

    document.body.style.overflow = 'hidden';

    const maxTimer = setTimeout(() => {
      if (!dismissedRef.current) dismiss();
    }, 10000);

    return () => {
      clearTimeout(maxTimer);
      document.body.style.overflow = '';
      mediaQuery.removeEventListener('change', onMotionChange);
    };
  }, [dismiss]);

  if (dismissed) return null;

  return (
    <div
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
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 100002,
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '50%',
            height: '100%',
            background:
              'linear-gradient(90deg, rgba(25,0,0,0.95), rgba(48,0,0,0.85) 40%, rgba(90,10,10,0.65))',
            boxShadow: 'inset -20px 0 40px rgba(0,0,0,0.4)',
            transform: curtainsOpen ? 'translateX(-102%)' : 'translateX(0)',
            transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '50%',
            height: '100%',
            background:
              'linear-gradient(270deg, rgba(25,0,0,0.95), rgba(48,0,0,0.85) 40%, rgba(90,10,10,0.65))',
            boxShadow: 'inset 20px 0 40px rgba(0,0,0,0.4)',
            transform: curtainsOpen ? 'translateX(102%)' : 'translateX(0)',
            transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
      {!reducedMotion && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100001,
            pointerEvents: 'none',
          }}
        >
          <Canvas camera={{ position: [0, 0, 3.2], fov: 45 }}>
            <CurtainScene open={curtainsOpen} />
          </Canvas>
        </div>
      )}

      <video
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={dismiss}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      >
        <source src="/video/pre-loader-animation-1.mp4" type="video/mp4" />
      </video>

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
