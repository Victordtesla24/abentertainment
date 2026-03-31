'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Preloader — plays curtain-opening animation on ALL pages.
 * Re-triggers every 5 minutes (300000ms) of active session.
 * Uses trimmed curtain-opening video (2s preloader clip).
 * Falls back gracefully if video is unavailable (404) or autoplay blocked.
 */
export default function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldShow, setShouldShow] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Show on ALL pages (not just homepage)
    const lastPlayed = parseInt(localStorage.getItem('ab-preloader-time') || '0');
    if (lastPlayed && Date.now() - lastPlayed < 300000) return; // 5-minute cooldown
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

    // Fallback: dismiss after 4 seconds if video hasn't started
    const fallbackTimer = setTimeout(() => {
      if (video.paused && video.currentTime === 0) dismiss();
    }, 4000);

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
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        playsInline
        preload="auto"
      >
        <source src="/video/ab-curtain-preloader.webm" type="video/webm" />
        <source src="/video/ab-curtain-preloader.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
