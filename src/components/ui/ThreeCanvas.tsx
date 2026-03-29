'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ThreeEngine } from '@/lib/three-engine/Engine';

// Ensure GSAP plugins are registered in the client environment
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function ThreeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();

  // Hide Three.js canvas on admin routes
  if (pathname.startsWith('/admin')) return null;

  useEffect(() => {
    if (!canvasRef.current) return;

    let engine: ThreeEngine | null = null;
    
    // Initialize engine asynchronously
    ThreeEngine.getInstance(canvasRef.current).then((initializedEngine) => {
      engine = initializedEngine;
      
      // GSAP Ticker for 60FPS render loop isolated from React
      gsap.ticker.add(renderLoop);
      // Ensure GSAP ticker uses standard requestAnimationFrame timing (or leaves it uncapped but synced to screen refresh)
      // Setting fps(0) defaults to requestAnimationFrame, which is best for WebGL
      gsap.ticker.fps(0); 
    });

    const renderLoop = () => {
      if (!engine) return;
      
      // Calculate normalized scroll progress (0.0 to 1.0)
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = docHeight > 0 ? window.scrollY / docHeight : 0;
      
      // Clamp between 0 and 1
      const clampedProgress = Math.max(0, Math.min(1, scrollProgress));
      
      engine.render(clampedProgress);
    };

    return () => {
      gsap.ticker.remove(renderLoop);
      // Since ThreeEngine is a singleton, we leave the WebGL context intact during React unmounts
      // to avoid expensive re-initialization on route changes.
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="gl-canvas"
      className="fixed inset-0 w-full h-full pointer-events-none -z-10 bg-[#0A0A0A]"
      aria-hidden="true"
    />
  );
}
