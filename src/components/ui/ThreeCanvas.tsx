'use client';

import { useEffect, useRef, useState, useCallback, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { usePathname } from 'next/navigation';
import { ThreeEngine } from '@/lib/three-engine/Engine';

// ---------------------------------------------------------------------------
// WebGL feature detection
// ---------------------------------------------------------------------------

type WebGLSupport = 'webgl2' | 'webgl1' | 'none';

function detectWebGLSupport(): WebGLSupport {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 'none';
  }
  const testCanvas = document.createElement('canvas');
  try {
    if (testCanvas.getContext('webgl2')) return 'webgl2';
    if (
      testCanvas.getContext('webgl') ||
      testCanvas.getContext('experimental-webgl')
    ) {
      return 'webgl1';
    }
  } catch {
    // getContext can throw on some environments
  }
  return 'none';
}

// ---------------------------------------------------------------------------
// CSS gradient fallback (no WebGL available)
// ---------------------------------------------------------------------------

function CSSFallback() {
  return (
    <div
      className="fixed inset-0 w-full h-full pointer-events-none -z-10"
      style={{
        background:
          'radial-gradient(ellipse at 50% 20%, #1a1a2e 0%, #0a0a0c 60%, #000000 100%)',
      }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Error boundary — catches render-time and lifecycle errors
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ThreeCanvasErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ThreeCanvas] Render error caught by boundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Inner canvas component (runs inside the error boundary)
// ---------------------------------------------------------------------------

function ThreeCanvasInner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  const [showFallback, setShowFallback] = useState(false);
  const [webglSupport] = useState<WebGLSupport>(() =>
    typeof window !== 'undefined' ? detectWebGLSupport() : 'none'
  );

  // Stable callback refs to avoid re-creating the effect
  const onContextLost = useCallback(() => {
    // Optionally show a subtle overlay; the engine handles pausing
  }, []);

  const onFallback = useCallback(() => {
    setShowFallback(true);
  }, []);

  // Respect prefers-reduced-motion: skip WebGL entirely to save GPU resources
  const [prefersReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  // All hooks declared BEFORE any conditional return (React rules of hooks)
  useEffect(() => {
    // Skip initialization on admin routes
    if (pathname.startsWith('/admin')) return;
    if (webglSupport === 'none') return;
    if (prefersReducedMotion) return;
    if (!canvasRef.current) return;

    let engine: ThreeEngine | null = null;
    let animationId: number | null = null;
    let isCancelled = false; // Prevent RAF start after unmount (review fix #4)
    let idleHandle: number | ReturnType<typeof setTimeout> | null = null;
    const onPointerMove = (event: PointerEvent) => {
      if (!engine) return;
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = -(event.clientY / window.innerHeight) * 2 + 1;
      engine.setPointerNormalized(nx, ny);
    };

    // Defer engine initialization to requestIdleCallback with 3s timeout fallback
    const initEngine = () => {
      if (isCancelled || !canvasRef.current) return;

      ThreeEngine.getInstance(canvasRef.current, {
        onContextLost,
        onContextRestored: () => {
          // Restart the render loop on context restore
          if (!isCancelled && engine) tick();
        },
        onFallback,
      }).then((initializedEngine) => {
        if (isCancelled) return; // Component unmounted before engine resolved
        engine = initializedEngine;
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        tick();
      }).catch((err) => {
        console.error('[ThreeCanvas] Engine initialization failed:', err);
        setShowFallback(true);
      });
    };

    if (typeof requestIdleCallback === 'function') {
      idleHandle = requestIdleCallback(initEngine, { timeout: 3000 });
    } else {
      idleHandle = setTimeout(initEngine, 0);
    }

    const tick = () => {
      if (!engine || isCancelled) return;
      // Skip rendering while tab is hidden (engine pauses its clock, but stop RAF too)
      if (document.hidden) {
        animationId = requestAnimationFrame(tick);
        return;
      }
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = docHeight > 0 ? window.scrollY / docHeight : 0;
      const clampedProgress = Math.max(0, Math.min(1, scrollProgress));
      engine.render(clampedProgress);
      animationId = requestAnimationFrame(tick);
    };

    return () => {
      isCancelled = true;
      // Cancel deferred init if it hasn't fired yet
      if (idleHandle !== null) {
        if (typeof cancelIdleCallback === 'function' && typeof idleHandle === 'number') {
          cancelIdleCallback(idleHandle);
        } else {
          clearTimeout(idleHandle as ReturnType<typeof setTimeout>);
        }
      }
      if (animationId !== null) cancelAnimationFrame(animationId);
      window.removeEventListener('pointermove', onPointerMove);
      engine?.dispose(); // Full GPU memory cleanup on unmount
    };
  }, [pathname, webglSupport, onContextLost, onFallback, prefersReducedMotion]);

  // Conditional render AFTER all hooks
  if (pathname.startsWith('/admin')) return null;

  // No WebGL support, reduced motion preference, or fallback triggered — pure CSS fallback
  if (webglSupport === 'none' || showFallback || prefersReducedMotion) {
    return <CSSFallback />;
  }

  return (
    <canvas
      ref={canvasRef}
      id="gl-canvas"
      className="fixed inset-0 w-full h-full pointer-events-none -z-10 bg-[#0A0A0A]"
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Exported component — wrapped in error boundary
// ---------------------------------------------------------------------------

export default function ThreeCanvas() {
  return (
    <ThreeCanvasErrorBoundary fallback={<CSSFallback />}>
      <ThreeCanvasInner />
    </ThreeCanvasErrorBoundary>
  );
}
