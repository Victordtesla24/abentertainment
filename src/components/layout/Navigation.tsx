'use client';

import { useState, useEffect, useCallback } from 'react';
import { useScroll, useTransform, motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { NAVIGATION } from '@/lib/constants';
import SearchModal from '@/components/SearchModal';

const mobileMenuVariants = {
  hidden: { x: '100%' },
  visible: {
    x: 0,
    transition: { duration: 0.4, ease: [0.25, 1, 0.5, 1] as [number, number, number, number], staggerChildren: 0.05, delayChildren: 0.1 },
  },
  exit: { x: '100%', transition: { duration: 0.3, ease: [0.25, 1, 0.5, 1] as [number, number, number, number] } },
};
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.25 } },
};
const mobileItemVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.25, 1, 0.5, 1] as [number, number, number, number] } },
};

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { scrollY } = useScroll();
  const pathname = usePathname();

  const navBg = useTransform(scrollY, [0, 40, 120], ['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.92)']);
  const navBlur = useTransform(scrollY, [0, 40, 120], ['blur(0px)', 'blur(10px)', 'blur(24px)']);
  const navBorder = useTransform(scrollY, [0, 120], ['rgba(201,168,76,0)', 'rgba(201,168,76,0.1)']);

  useEffect(() => { setIsOpen(false); }, [pathname]);

  // Global Cmd/Ctrl+K shortcut to toggle search modal
  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleSearch();
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [toggleSearch]);

  // Admin routes hide the public navigation. Guard AFTER all hooks to preserve
  // hook order across renders (Rules of Hooks: same hooks, same order, every render).
  if (pathname.startsWith('/admin')) return null;

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* DESKTOP NAV */}
      <motion.nav
        aria-label="Main navigation"
        style={{ backgroundColor: navBg, backdropFilter: navBlur, WebkitBackdropFilter: navBlur, borderBottomColor: navBorder }}
        className="hidden md:flex fixed top-0 left-0 right-0 z-40 border-b transition-[border-color] duration-500"
      >
        <div className="container-eu py-4 flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-[#C9A84C] focus-visible:outline-offset-2">
            <div className="relative w-12 h-12 overflow-hidden">
              <Image src="/images/AB_Logo_transparent.png" alt="AB Entertainment" fill
                className="object-contain drop-shadow-[0_0_10px_rgba(201,168,76,0.3)] group-hover:drop-shadow-[0_0_16px_rgba(201,168,76,0.6)] transition-all duration-500" priority />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-body text-[11px] uppercase tracking-[0.25em] font-semibold leading-tight">AB Entertainment</span>
              <span className="text-[#C9A84C]/50 font-body text-[9px] uppercase tracking-[0.2em] font-normal">Experience events like no other</span>
            </div>
          </Link>

          {/* Center Links */}
          <div className="flex items-center gap-9">
            {NAVIGATION.map((link) => (
              <Link key={link.href} href={link.href}
                className={`group relative text-xs uppercase tracking-wider font-body font-medium transition-all duration-400 py-1 focus-visible:outline-2 focus-visible:outline-[#C9A84C] focus-visible:outline-offset-4 ${
                  isActive(link.href) ? 'text-[#C9A84C]' : 'text-white/60 hover:text-white'
                }`}
              >
                {link.label}
                {isActive(link.href) ? (
                  <motion.div layoutId="nav-underline" className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-[#C9A84C]/50 via-[#C9A84C] to-[#C9A84C]/50"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                ) : (
                  <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[#C9A84C] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out" />
                )}
              </Link>
            ))}
          </div>

          {/* Right CTA */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2.5 text-white/50 hover:text-[#C9A84C] transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-[#C9A84C] focus-visible:outline-offset-2"
              aria-label="Search events"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
            <Link href="/contact"
              className="group relative px-7 py-2.5 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-xs uppercase tracking-[0.12em] font-body font-bold overflow-hidden transition-all duration-400 hover:shadow-[0_0_25px_rgba(201,168,76,0.35)] focus-visible:outline-2 focus-visible:outline-[#C9A84C] focus-visible:outline-offset-4">
              <span className="relative z-10">Contact Us</span>
              <div className="absolute inset-0 bg-gradient-to-r from-[#D4B65C] to-[#E8D5A3] opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* MOBILE NAV */}
      <nav aria-label="Mobile navigation" className="md:hidden fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-2xl border-b border-[#C9A84C]/8">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-[#C9A84C] focus-visible:outline-offset-2">
            <div className="relative w-10 h-10 overflow-hidden">
              <Image src="/images/AB_Logo_transparent.png" alt="AB Entertainment" fill className="object-contain" priority />
            </div>
            <span className="text-white font-body text-[10px] uppercase tracking-[0.2em] font-semibold">AB Entertainment</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-white/50 hover:text-[#C9A84C] transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-[#C9A84C] focus-visible:outline-offset-2"
              aria-label="Search events"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-[#C9A84C] focus-visible:outline-2 focus-visible:outline-[#C9A84C] focus-visible:outline-offset-2" aria-label="Toggle menu" aria-expanded={isOpen}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d={isOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* MOBILE DRAWER + BACKDROP */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Semi-transparent backdrop */}
            <motion.div
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="md:hidden fixed inset-0 z-[55] bg-black/50"
              onClick={() => setIsOpen(false)}
            />
            {/* Sliding drawer from right */}
            <motion.div
              variants={mobileMenuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="md:hidden fixed top-0 right-0 bottom-0 z-[60] w-72 bg-black/95 backdrop-blur-2xl border-l border-[#C9A84C]/8 overflow-y-auto"
            >
              <div className="px-4 py-6 space-y-1 mt-16">
                {NAVIGATION.map((link) => (
                  <motion.div key={link.href} variants={mobileItemVariants}>
                    <Link href={link.href}
                      className={`block py-3 px-3 text-sm uppercase tracking-wider font-body transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[#C9A84C] focus-visible:outline-offset-2 ${
                        isActive(link.href) ? 'text-[#C9A84C] bg-[#C9A84C]/5' : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}>
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
                <motion.div variants={mobileItemVariants} className="pt-4 mt-4 border-t border-[#C9A84C]/8 space-y-3">
                  <Link href="/contact" className="block w-full px-4 py-3 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-sm text-center uppercase tracking-wider font-body font-bold focus-visible:outline-2 focus-visible:outline-[#C9A84C] focus-visible:outline-offset-4">
                    Contact Us
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
