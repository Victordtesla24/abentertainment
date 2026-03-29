'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ThreeEngine } from '@/lib/three-engine/Engine';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function ThreeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();

  // All hooks declared BEFORE any conditional return (React rules of hooks)
  useEffect(() => {
    // Skip initialization on admin routes
    if (pathname.startsWith('/admin')) return;
    if (!canvasRef.current) return;

    let engine: ThreeEngine | null = null;

    ThreeEngine.getInstance(canvasRef.current).then((initializedEngine) => {
      engine = initializedEngine;
      gsap.ticker.add(renderLoop);
      gsap.ticker.fps(0);
    });

    const renderLoop = () => {
      if (!engine) return;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = docHeight > 0 ? window.scrollY / docHeight : 0;
      const clampedProgress = Math.max(0, Math.min(1, scrollProgress));
      engine.render(clampedProgress);
    };

    return () => {
      gsap.ticker.remove(renderLoop);
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
