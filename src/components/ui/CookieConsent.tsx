'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const consent = document.cookie.includes('cookie_consent=accepted');
      if (!consent) setIsVisible(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const acceptCookies = () => {
    document.cookie = 'cookie_consent=accepted; max-age=31536000; path=/; SameSite=Lax';
    setIsVisible(false);
  };

  const declineCookies = () => {
    document.cookie = 'cookie_consent=declined; max-age=31536000; path=/; SameSite=Lax';
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
          className="fixed bottom-0 left-0 right-0 z-[950] bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-[#C9A84C]/10"
        >
          <div className="container-eu py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/50 text-sm font-body text-center sm:text-left">
              We use essential cookies to ensure the best experience on our site.{' '}
              <a href="/privacy" className="text-[#C9A84C] hover:underline">Learn more</a>
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={declineCookies}
                className="px-5 py-2 border border-white/10 text-white/40 text-xs uppercase tracking-wider font-body hover:border-white/25 hover:text-white/60 transition-all duration-300"
              >
                Decline
              </button>
              <button
                onClick={acceptCookies}
                className="px-5 py-2 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-xs uppercase tracking-wider font-body font-bold hover:shadow-[0_0_15px_rgba(201,168,76,0.3)] transition-all duration-300"
              >
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
