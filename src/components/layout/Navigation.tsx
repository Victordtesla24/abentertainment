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

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { scrollY } = useScroll();
  const pathname = usePathname();

  const navBg = useTransform(
    scrollY,
    [0, 80, 200],
    [
      'rgba(6, 36, 52, 0.85)',
      'rgba(6, 36, 52, 0.92)',
      'rgba(6, 36, 52, 0.97)',
    ]
  );
  const navBlur = useTransform(
    scrollY,
    [0, 80, 200],
    ['blur(4px)', 'blur(12px)', 'blur(20px)']
  );

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Desktop Navigation */}
      <motion.nav
        style={{
          backgroundColor: navBg,
          backdropFilter: navBlur,
          WebkitBackdropFilter: navBlur,
        }}
        className="hidden md:flex fixed top-0 left-0 right-0 z-40 border-b border-[#CC8A1C]/20"
      >
        <div className="container-eu py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2">
            <span className="text-[#CC8A1C] font-display text-xl font-bold tracking-tight group-hover:text-[#e0a83a] transition-colors duration-300">
              AB Entertainment
            </span>
          </Link>

          {/* Center Links */}
          <div className="flex items-center gap-8">
            {NAVIGATION.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative py-1 text-sm font-medium font-body transition-colors duration-300 group ${
                  isActive(link.href)
                    ? 'text-[#CC8A1C]'
                    : 'text-[#7E7180] hover:text-[#CC8A1C]'
                }`}
              >
                {link.label}
                <span
                  className={`absolute bottom-0 left-0 h-px bg-[#CC8A1C] transition-all duration-300 ease-out ${
                    isActive(link.href)
                      ? 'w-full'
                      : 'w-0 group-hover:w-full'
                  }`}
                />
              </Link>
            ))}
          </div>

          {/* Right: Book Now CTA */}
          <Link
            href="/contact"
            className="btn-accent px-6 py-2 text-sm font-semibold"
          >
            Book Now
          </Link>
        </div>
      </motion.nav>

      {/* Mobile Navigation */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#062434]/95 backdrop-blur-md border-b border-[#CC8A1C]/20">
        <div className="px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[#CC8A1C] font-display text-lg font-bold">
              AB Entertainment
            </span>
          </Link>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-[#CC8A1C]"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  isOpen
                    ? 'M6 18L18 6M6 6l12 12'
                    : 'M4 6h16M4 12h16M4 18h16'
                }
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
              className="border-t border-[#CC8A1C]/20 overflow-hidden"
            >
              <div className="px-4 py-6 space-y-1">
                {NAVIGATION.map((link) => (
                  <motion.div key={link.href} variants={mobileItemVariants}>
                    <Link
                      href={link.href}
                      className={`block py-3 px-2 text-sm font-medium font-body transition-all duration-200 ${
                        isActive(link.href)
                          ? 'text-[#CC8A1C] bg-[#CC8A1C]/5'
                          : 'text-[#7E7180] hover:text-[#CC8A1C] hover:bg-[#CC8A1C]/5'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}

                <motion.div
                  variants={mobileItemVariants}
                  className="border-t border-[#CC8A1C]/20 pt-4 mt-4"
                >
                  <Link
                    href="/contact"
                    className="block w-full px-4 py-3 btn-accent text-sm text-center font-bold"
                  >
                    Book Now
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Spacer for fixed nav */}
      <div className="h-16 md:h-[72px]" />
    </>
  );
}
