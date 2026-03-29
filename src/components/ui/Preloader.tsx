'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Preloader — plays ab-animation-2.mp4 on homepage only, once per session.
 * Video deployed via SCP (not in git repo due to size).
 * Falls back gracefully if video is unavailable (404).
 */
export default function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldShow, setShouldShow] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (window.location.pathname !== '/' && window.location.pathname !== '') return;
    const lastPlayed = parseInt(localStorage.getItem('ab-preloader-time') || '0');
    if (lastPlayed && Date.now() - lastPlayed < 300000) return;
    setShouldShow(true);
  }, []);

  useEffect(() => {
    if (!shouldShow) return;
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const dismiss = () => {
      if (!container) return;
      container.style.transition = 'opacity 0.8s ease-out';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      sessionStorage.setItem('ab-preloader-played', 'true');
      localStorage.setItem('ab-preloader-played', 'true');
      localStorage.setItem('ab-preloader-time', String(Date.now()));
      setTimeout(() => setIsDismissed(true), 900);
    };

    video.play().catch(() => {
      // Video unavailable or autoplay blocked — dismiss immediately
      dismiss();
    });

    // Dismiss on video error (e.g., 404)
    const handleError = () => dismiss();

    // Dismiss when video finishes
    const handleEnded = () => dismiss();

    // Fallback: dismiss after 2 seconds if video hasn't started
    const fallbackTimer = setTimeout(() => {
      if (video.paused && video.currentTime === 0) dismiss();
    }, 2000);

    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    return () => {
      clearTimeout(fallbackTimer);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [shouldShow]);

  if (!shouldShow || isDismissed) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        src="/videos/ab-animation-2.mp4"
        muted
        playsInline
        preload="auto"
      />
    </div>
  );
}
