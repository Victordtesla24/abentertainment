'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export default function Preloader() {
  const [dismissed, setDismissed] = useState(false);
  const [curtainsOpen, setCurtainsOpen] = useState(false);
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
