'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { COLOR, DURATION, EASE } from './brand';
import { Icon } from './icons';
import { useDashMotion } from './motion';

/** The brand's gold toast that says something was copied: it rises into the corner and goes after two seconds (it is simply there with reduced motion). */
export function CopyToast({ visible }: { visible: boolean }) {
  const { enabled } = useDashMotion();
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="status"
          data-testid="dashboard-toast"
          initial={enabled ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={enabled ? { opacity: 0, y: 20 } : { opacity: 0 }}
          transition={{ duration: enabled ? DURATION.base : 0, ease: EASE }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2 font-body text-xs font-bold text-black shadow-lg"
          style={{ background: COLOR.gold }}
        >
          <Icon name="check" className="h-4 w-4" />
          Copied to clipboard
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
