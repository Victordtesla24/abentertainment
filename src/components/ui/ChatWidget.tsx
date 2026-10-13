'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ChatWidget.module.css';

// The conversation window (with react-markdown + remark-gfm, ~100 KB) is fetched the
// first time the launcher is approached or pressed, not with every page view.
const loadChatPanel = () => import('@/components/ui/ChatPanel');
const ChatPanel = dynamic(loadChatPanel, { ssr: false });

/**
 * Floating "AB Concierge" launcher. Cheap by design: a button, a label and a CSS halo.
 */
export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  function openChat() {
    setIsOpen(true);
    setHasOpened(true);
  }

  return (
    <>
      {/* ── FAB ─────────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-4 sm:right-6 z-[901] flex flex-col items-end gap-2 transition-transform duration-300 max-sm:-translate-y-[var(--ab-cookie-h,0px)]">

        {/* "Chat with us" label — shown before first open */}
        <AnimatePresence>
          {!hasOpened && !isOpen && (
            <motion.div
              initial={{ opacity: 0, x: 12, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 12, scale: 0.9 }}
              transition={{ delay: 1.5, duration: 0.4, ease: 'easeOut' }}
              className="bg-[#0A0A0A] border border-[#C9A84C]/30 px-4 py-2 shadow-lg shadow-black/40 pointer-events-none [html[data-cookie-banner]_&]:max-sm:hidden"
            >
              <p className="text-[#C9A84C] text-xs font-body font-semibold tracking-wide whitespace-nowrap">
                Ask our Concierge ✨
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB button */}
        <div className="relative">
          {/* Pulse ring when closed */}
          {!isOpen && <span className={`absolute inset-0 rounded-full ${styles.halo}`} aria-hidden="true" />}

          <motion.button
            onClick={() => (isOpen ? setIsOpen(false) : openChat())}
            onPointerEnter={() => void loadChatPanel()}
            onFocus={() => void loadChatPanel()}
            onTouchStart={() => void loadChatPanel()}
            className="relative w-14 h-14 md:w-[60px] md:h-[60px] flex items-center justify-center text-black shadow-[0_6px_30px_rgba(201,168,76,0.45)] hover:shadow-[0_8px_40px_rgba(201,168,76,0.65)] transition-shadow duration-300 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #D4B65C 0%, #C9A84C 50%, #B8942E 100%)' }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            aria-label={isOpen ? 'Close concierge chat' : 'Open concierge chat'}
          >
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.svg key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }} className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </motion.svg>
              ) : (
                <motion.div key="icon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col items-center gap-0.5">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* ── Chat Panel — mounted on first open, kept mounted so the conversation survives closing ── */}
      {hasOpened && <ChatPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  );
}
