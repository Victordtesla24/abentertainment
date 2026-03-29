'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { ThreeEngine } from '@/lib/three-engine/Engine';

/**
 * Three.js WebGL canvas — site-wide fixed background.
 * Uses requestAnimationFrame for render loop.
 * Handles cleanup to prevent RAF leaks on unmount (review fix #4).
 */
export default function ThreeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();

  // All hooks declared BEFORE any conditional return (React rules of hooks)
  useEffect(() => {
    // Skip initialization on admin routes
    if (pathname.startsWith('/admin')) return;
    if (!canvasRef.current) return;

    let engine: ThreeEngine | null = null;
    let animationId: number | null = null;
    let isCancelled = false; // Prevent RAF start after unmount (review fix #4)

    ThreeEngine.getInstance(canvasRef.current).then((initializedEngine) => {
      if (isCancelled) return; // Component unmounted before engine resolved
      engine = initializedEngine;
      tick();
    });

    const tick = () => {
      if (!engine || isCancelled) return;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = docHeight > 0 ? window.scrollY / docHeight : 0;
      const clampedProgress = Math.max(0, Math.min(1, scrollProgress));
      engine.render(clampedProgress);
      animationId = requestAnimationFrame(tick);
    };

    return () => {
      isCancelled = true;
      if (animationId !== null) cancelAnimationFrame(animationId);
      engine?.removeListeners(); // Prevent resize listener accumulation (review fix #3)
    };
  }, [pathname]);

  // Conditional render AFTER all hooks
  if (pathname.startsWith('/admin')) return null;

  return (
    <canvas
      ref={canvasRef}
      id="gl-canvas"
      className="fixed inset-0 w-full h-full pointer-events-none -z-10 bg-[#0A0A0A]"
      aria-hidden="true"
    />
  );
}
