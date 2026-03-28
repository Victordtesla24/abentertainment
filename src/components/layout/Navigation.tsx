'use client';

import { useState, useEffect } from 'react';
import {
  useScroll,
  useTransform,
  motion,
  AnimatePresence,
} from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAVIGATION } from '@/lib/constants';

const mobileMenuVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: 'auto' as const,
    transition: {
      duration: 0.35,
      ease: [0.25, 1, 0.5, 1] as [number, number, number, number],
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      duration: 0.25,
      ease: [0.25, 1, 0.5, 1] as [number, number, number, number],
    },
  },
};

const mobileItemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.35,
      ease: [0.25, 1, 0.5, 1] as [number, number, number, number],
    },
  },
};

/**
 * Logo Monogram — matching eventsunleashed.com "EU" circular logo
 * We use "AB" for AB Entertainment
 */
function LogoMonogram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <circle cx="24" cy="24" r="22" stroke="white" strokeWidth="1.5" />
      <text
        x="24"
        y="28"
        textAnchor="middle"
        fill="white"
        fontSize="18"
        fontWeight="bold"
        fontFamily="serif"
      >
        AB
      </text>
    </svg>
  );
}

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { scrollY } = useScroll();
  const pathname = usePathname();

  // Hide navigation on admin routes
  if (pathname.startsWith('/admin')) return null;

  const navBg = useTransform(
    scrollY,
    [0, 80, 200],
    [
      'rgba(6, 36, 52, 0)',
      'rgba(6, 36, 52, 0.7)',
      'rgba(6, 36, 52, 0.95)',
    ]
  );
  const navBlur = useTransform(
    scrollY,
    [0, 80, 200],
    ['blur(0px)', 'blur(8px)', 'blur(16px)']
  );

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* ====== DESKTOP NAV — matching eventsunleashed.com ====== */}
      <motion.nav
        style={{
          backgroundColor: navBg,
          backdropFilter: navBlur,
          WebkitBackdropFilter: navBlur,
        }}
        className="hidden md:flex fixed top-0 left-0 right-0 z-40"
      >
        <div className="container-eu py-5 flex items-center justify-between">
          {/* Logo — monogram + text, matching EU style */}
          <Link href="/" className="group flex items-center gap-3">
            <LogoMonogram className="w-10 h-10 group-hover:opacity-80 transition-opacity" />
            <span className="text-white font-body text-xs uppercase tracking-[0.2em] font-semibold">
              AB Entertainment
            </span>
          </Link>

          {/* Center Links — WHITE UPPERCASE like eventsunleashed */}
          <div className="flex items-center gap-8">
            {NAVIGATION.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-xs uppercase tracking-[0.15em] font-body font-medium transition-colors duration-300 ${
                  isActive(link.href)
                    ? 'text-[#CC8A1C]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right: "Contact Us" white bordered button — matching EU exactly */}
          <div className="flex items-center gap-3">
            <Link
              href="/contact"
              className="px-6 py-2.5 border border-white/60 text-white text-xs uppercase tracking-[0.15em] font-body font-medium hover:bg-white hover:text-[#062434] transition-all duration-300"
            >
              Contact Us
            </Link>
            {/* Arrow icon next to Contact Us — matching EU */}
            <Link
              href="/contact"
              className="w-10 h-10 flex items-center justify-center border border-white/60 text-white hover:bg-white hover:text-[#062434] transition-all duration-300"
              aria-label="Contact"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ====== MOBILE NAV ====== */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#062434]/95 backdrop-blur-md">
        <div className="px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <LogoMonogram className="w-8 h-8" />
            <span className="text-white font-body text-xs uppercase tracking-[0.15em] font-semibold">
              AB Entertainment
            </span>
          </Link>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-white"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
              />
            </svg>
          </button>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              variants={mobileMenuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="border-t border-white/10 overflow-hidden"
            >
              <div className="px-4 py-6 space-y-1">
                {NAVIGATION.map((link) => (
                  <motion.div key={link.href} variants={mobileItemVariants}>
                    <Link
                      href={link.href}
                      className={`block py-3 px-2 text-sm uppercase tracking-wider font-body transition-all duration-200 ${
                        isActive(link.href)
                          ? 'text-[#CC8A1C]'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
                <motion.div variants={mobileItemVariants} className="pt-4 mt-4 border-t border-white/10">
                  <Link
                    href="/contact"
                    className="block w-full px-4 py-3 border border-white/60 text-white text-sm text-center uppercase tracking-wider font-body"
                  >
                    Contact Us
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* NO spacer — hero goes behind nav (transparent nav over hero, like EU) */}
    </>
  );
}
