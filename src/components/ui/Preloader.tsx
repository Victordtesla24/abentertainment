'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Preloader — plays ab-animation-2.mp4 on homepage only, once per session.
 * Renders nothing during SSR to prevent blocking static pages.
 */
export default function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldShow, setShouldShow] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Only show preloader on homepage
    if (window.location.pathname !== '/' && window.location.pathname !== '') return;
    // Skip if already played this session
    if (sessionStorage.getItem('ab-preloader-played') === 'true') return;
    if (localStorage.getItem('ab-preloader-played') === 'true') {
      const lastPlayed = parseInt(localStorage.getItem('ab-preloader-time') || '0');
      if (Date.now() - lastPlayed < 1800000) return;
    }
    setShouldShow(true);
  }, []);

  useEffect(() => {
    if (!shouldShow) return;
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    video.play().catch(() => {});

    const handleEnded = () => {
      if (!container) return;
      container.style.transition = 'opacity 0.8s ease-out';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      sessionStorage.setItem('ab-preloader-played', 'true');
      localStorage.setItem('ab-preloader-played', 'true');
      localStorage.setItem('ab-preloader-time', String(Date.now()));
      setTimeout(() => setIsDismissed(true), 900);
    };

    const fallbackTimer = setTimeout(() => {
      if (video.paused && video.currentTime === 0) handleEnded();
    }, 2000);

    video.addEventListener('ended', handleEnded);
    return () => {
      clearTimeout(fallbackTimer);
      video.removeEventListener('ended', handleEnded);
    };
  }, [shouldShow]);

  // Render NOTHING during SSR or when not on homepage
  if (!shouldShow || isDismissed) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        src="/video/ab-animation-2.mp4"
        muted
        playsInline
        preload="auto"
      />
    </div>
  );
}
