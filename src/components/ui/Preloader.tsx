'use client';

import { useEffect } from 'react';

/**
 * Preloader — manages the static #ab-preloader overlay from layout.tsx.
 * Injects curtain-opening video, plays it, then dismisses the overlay.
 * Re-triggers every 5 minutes (300 000 ms) using localStorage cooldown.
 *
 * The static overlay div is rendered server-side in layout.tsx so it's
 * visible from first paint. This component (loaded client-side) controls
 * video playback and overlay dismissal.
 */
export default function Preloader() {
  useEffect(() => {
    const overlay = document.getElementById('ab-preloader');
    if (!overlay) return;

    // Double-check cooldown (inline script in layout.tsx also checks,
    // but this catches edge cases like very slow script execution)
    const lastPlayed = parseInt(localStorage.getItem('ab-preloader-time') || '0');
    if (lastPlayed && Date.now() - lastPlayed < 300000) {
      overlay.style.display = 'none';
      return;
    }

    // Create video element
    const video = document.createElement('video');
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('playsinline', '');

    const sourceWebm = document.createElement('source');
    sourceWebm.src = '/video/ab-curtain-preloader.webm';
    sourceWebm.type = 'video/webm';

    const sourceMp4 = document.createElement('source');
    sourceMp4.src = '/video/ab-curtain-preloader.mp4';
    sourceMp4.type = 'video/mp4';

    video.appendChild(sourceWebm);
    video.appendChild(sourceMp4);
    overlay.appendChild(video);

    let dismissed = false;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      overlay.style.transition = 'opacity 0.8s ease-out';
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
      localStorage.setItem('ab-preloader-played', 'true');
      localStorage.setItem('ab-preloader-time', String(Date.now()));
      sessionStorage.setItem('ab-preloader-played', 'true');
      setTimeout(() => {
        overlay.remove();
      }, 900);
    };

    // Start playback
    video.play().catch(() => {
      // Autoplay blocked or video unavailable — dismiss immediately
      dismiss();
    });

    video.addEventListener('ended', dismiss);
    video.addEventListener('error', dismiss);

    // Fallback: dismiss after 5 seconds if video hasn't started
    const fallbackTimer = setTimeout(() => {
      if (video.paused && video.currentTime === 0) {
        dismiss();
      }
    }, 5000);

    return () => {
      clearTimeout(fallbackTimer);
      video.removeEventListener('ended', dismiss);
      video.removeEventListener('error', dismiss);
    };
  }, []);

  // No JSX — the overlay div is in layout.tsx (server-rendered HTML)
  return null;
}
