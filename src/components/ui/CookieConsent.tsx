'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
          className="fixed bottom-6 right-6 z-[900] max-w-sm"
          role="dialog"
          aria-label="Cookie consent"
        >
          <div className="bg-[#111111]/95 backdrop-blur-xl border border-[#C9A84C]/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-none overflow-hidden">
            <div className="p-4">
              <p className="text-white/60 text-sm font-body leading-relaxed">
                We use cookies for analytics.{' '}
                <a
                  href="/privacy"
                  className="text-[#C9A84C] hover:underline"
                >
                  Learn more
                </a>
              </p>

              {/* Settings panel */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 mt-3 border-t border-[#C9A84C]/10 space-y-2">
                      <label className="flex items-center gap-3 text-sm font-body text-white/50">
                        <input
                          type="checkbox"
                          checked
                          disabled
                          className="w-4 h-4 accent-[#C9A84C]"
                        />
                        <span>Essential (always on)</span>
                      </label>
                      <label className="flex items-center gap-3 text-sm font-body text-white/50">
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
                  className="px-3.5 py-2 border border-white/10 text-white/40 text-xs uppercase tracking-wider font-body hover:border-[#C9A84C]/30 hover:text-white/60 transition-all duration-300 rounded"
                >
                  Settings
                </button>
                <button
                  onClick={declineCookies}
                  className="px-3.5 py-2 border border-white/10 text-white/40 text-xs uppercase tracking-wider font-body hover:border-white/25 hover:text-white/60 transition-all duration-300 rounded"
                >
                  Decline
                </button>
                <button
                  onClick={acceptCookies}
                  className="px-4 py-2 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-xs uppercase tracking-wider font-body font-bold hover:shadow-[0_0_15px_rgba(201,168,76,0.3)] transition-all duration-300 rounded"
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
