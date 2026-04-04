'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const PRELOADER_VIDEO_SRC = '/video/pre-loader-animation-1.mp4';

interface PreloaderProps {
  onComplete?: () => void;
}

export default function Preloader({ onComplete }: PreloaderProps = {}) {
  const [dismissed, setDismissed] = useState(false);
  const [exiting, setExiting] = useState(false);
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

    setExiting(true);
    window.setTimeout(() => {
      document.documentElement.classList.add('preloader-done');
      document.body.style.overflow = '';
      window.dispatchEvent(new CustomEvent('ab:preloader-complete'));
      onComplete?.();
      setDismissed(true);
    }, 600);
  }, [onComplete]);

  useEffect(() => {
    const html = document.documentElement;
    const automatedBrowser = typeof navigator !== 'undefined' && navigator.webdriver;
    // Keep automation deterministic and avoid test flakiness on full-screen overlays.
    if (automatedBrowser) {
      html.classList.add('preloader-skip');
    }

    // Respect prefers-reduced-motion: skip the video preloader entirely
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
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
      dismissedRef.current = true;
      html.classList.add('preloader-done');
      window.dispatchEvent(new CustomEvent('ab:preloader-complete'));
      setDismissed(true);
      return;
    }

    document.body.style.overflow = 'hidden';

    const maxTimer = setTimeout(() => {
      if (!dismissedRef.current) dismiss();
    }, 10000);

    return () => {
      clearTimeout(maxTimer);
      document.body.style.overflow = '';
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
        transition: 'opacity 0.6s ease-out',
        opacity: exiting ? 0 : 1,
      }}
      aria-hidden="true"
    >
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
        <source src={PRELOADER_VIDEO_SRC} type="video/mp4" />
      </video>

      <button
        type="button"
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
