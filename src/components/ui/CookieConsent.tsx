'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

/** Gap kept between the banner and the floating buttons / page content it makes room for. */
const BANNER_GAP_PX = 12;

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const consent = localStorage.getItem('cookie_consent');
        if (!consent) setIsVisible(true);
      } catch {
        // localStorage unavailable (e.g. private browsing) — show consent
        setIsVisible(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // While the banner is up it must not sit on top of anything permanently: publish its
  // height so the chat launcher, chat window and back-to-top button lift above it
  // (--ab-cookie-h), and pad the end of the page so the footer can be scrolled clear of it.
  useEffect(() => {
    const banner = bannerRef.current;
    if (!isVisible || !banner) return;
    const root = document.documentElement;
    const publish = () => {
      // Layout size + the CSS offset from the viewport bottom (not getBoundingClientRect: the
      // entrance animation scales and shifts the banner, which would skew the measurement).
      const reserved = banner.offsetHeight + (parseFloat(getComputedStyle(banner).bottom) || 0) + BANNER_GAP_PX;
      root.style.setProperty('--ab-cookie-h', `${reserved}px`);
      root.dataset.cookieBanner = 'open';
      document.body.style.paddingBottom = `${reserved}px`;
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--ab-cookie-h');
      delete root.dataset.cookieBanner;
      document.body.style.paddingBottom = '';
    };
  }, [isVisible, showSettings]);

  const persistChoice = (choice: 'accepted' | 'declined') => {
    try {
      localStorage.setItem('cookie_consent', choice);
    } catch {
      // Silently fail if localStorage is unavailable
    }
    setIsVisible(false);
  };

  const acceptCookies = () => persistChoice('accepted');
  const declineCookies = () => persistChoice('declined');

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={bannerRef}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
          className="fixed left-3 right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[1000] sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-sm [@media(max-height:480px)]:right-24"
          role="dialog"
          aria-label="Cookie consent"
        >
          <div className="bg-[#111111]/95 backdrop-blur-md border border-[#C9A84C]/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-none overflow-hidden">
            <div className="p-3.5 sm:p-4">
              <p className="text-white/60 text-sm font-body leading-relaxed">
                We use cookies for analytics.{' '}
                <Link
                  href="/privacy"
                  className="text-[#C9A84C] underline underline-offset-2 hover:no-underline"
                >
                  Learn more<span className="sr-only">&nbsp;about how we use cookies</span>
                </Link>
              </p>

              {/* Settings panel */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="pt-3 mt-3 border-t border-[#C9A84C]/10 space-y-2">
                      <label className="flex items-center gap-3 text-sm font-body text-white/50 pointer-coarse:min-h-11">
                        <input
                          type="checkbox"
                          checked
                          disabled
                          className="w-4 h-4 accent-[#C9A84C]"
                        />
                        <span>Essential (always on)</span>
                      </label>
                      <label className="flex items-center gap-3 text-sm font-body text-white/50 pointer-coarse:min-h-11">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 accent-[#C9A84C]"
                        />
                        <span>Analytics</span>
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="px-3.5 py-2 pointer-coarse:min-h-11 border border-white/10 text-white/50 text-xs uppercase tracking-wider font-body hover:border-[#C9A84C]/30 hover:text-white/60 transition-all duration-300 rounded"
                >
                  Settings
                </button>
                <button
                  onClick={declineCookies}
                  className="px-3.5 py-2 pointer-coarse:min-h-11 border border-white/10 text-white/50 text-xs uppercase tracking-wider font-body hover:border-white/25 hover:text-white/60 transition-all duration-300 rounded"
                >
                  Decline
                </button>
                <button
                  onClick={acceptCookies}
                  className="px-4 py-2 pointer-coarse:min-h-11 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-xs uppercase tracking-wider font-body font-bold hover:shadow-[0_0_15px_rgba(201,168,76,0.3)] transition-all duration-300 rounded"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
