'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Preloader — plays ab-animation-2.mp4 with its matching audio,
 * then fades out to reveal the site.
 */
export default function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  // Only show preloader once per session
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('ab-preloader-played') === 'true';
    }
    return false;
  });

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    // Play video (and audio if available)
    const startPlayback = () => {
      video.play().catch(() => {});
      if (audio) audio.play().catch(() => {});
    };

    // When video ends, fade out the preloader
    const handleEnded = () => {
      if (!container) return;
      container.style.transition = 'opacity 0.8s ease-out';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      sessionStorage.setItem('ab-preloader-played', 'true');
      setTimeout(() => setIsDismissed(true), 900);
    };

    // Fallback: if video doesn't play within 2s, dismiss
    const fallbackTimer = setTimeout(() => {
      if (video.paused && video.currentTime === 0) {
        handleEnded();
      }
    }, 2000);

    video.addEventListener('ended', handleEnded);
    startPlayback();

    return () => {
      clearTimeout(fallbackTimer);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  if (isDismissed) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        src="/video/ab-animation-2.mp4"
        muted
        playsInline
        preload="auto"
      />
      {/* Audio track (separate so we can control independently) */}
      <audio
        ref={audioRef}
        src="/video/ab-animation-2.MP3"
        preload="auto"
      />
    </div>
  );
}
