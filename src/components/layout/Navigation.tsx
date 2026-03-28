'use client';

import { useState, useEffect } from 'react';
import { useScroll, useTransform, motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { NAVIGATION } from '@/lib/constants';

const mobileMenuVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1, height: 'auto' as const,
    transition: { duration: 0.4, ease: [0.25, 1, 0.5, 1] as [number, number, number, number], staggerChildren: 0.07, delayChildren: 0.1 },
  },
  exit: { opacity: 0, height: 0, transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as [number, number, number, number] } },
};
const mobileItemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.25, 1, 0.5, 1] as [number, number, number, number] } },
};

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { scrollY } = useScroll();
  const pathname = usePathname();

  if (pathname.startsWith('/admin')) return null;

  const navBg = useTransform(scrollY, [0, 40, 120], ['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.92)']);
  const navBlur = useTransform(scrollY, [0, 40, 120], ['blur(0px)', 'blur(10px)', 'blur(24px)']);
  const navBorder = useTransform(scrollY, [0, 120], ['rgba(201,168,76,0)', 'rgba(201,168,76,0.1)']);

  useEffect(() => { setIsOpen(false); }, [pathname]);
  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* DESKTOP NAV */}
      <motion.nav
        style={{ backgroundColor: navBg, backdropFilter: navBlur, WebkitBackdropFilter: navBlur, borderBottomColor: navBorder }}
        className="hidden md:flex fixed top-0 left-0 right-0 z-40 border-b transition-[border-color] duration-500"
      >
        <div className="container-eu py-4 flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-3">
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
                className={`relative text-xs uppercase tracking-[0.18em] font-body font-medium transition-all duration-400 py-1 ${
                  isActive(link.href) ? 'text-[#C9A84C]' : 'text-white/60 hover:text-white'
                }`}
              >
                {link.label}
                {isActive(link.href) && (
                  <motion.div layoutId="nav-underline" className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-[#C9A84C]/50 via-[#C9A84C] to-[#C9A84C]/50"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                )}
              </Link>
            ))}
          </div>

          {/* Right CTA */}
          <div className="flex items-center gap-3">
            <Link href="/contact"
              className="group relative px-7 py-2.5 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-xs uppercase tracking-[0.12em] font-body font-bold overflow-hidden transition-all duration-400 hover:shadow-[0_0_25px_rgba(201,168,76,0.35)]">
              <span className="relative z-10">Contact Us</span>
              <div className="absolute inset-0 bg-gradient-to-r from-[#D4B65C] to-[#E8D5A3] opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
            </Link>
            <Link href="/admin/login"
              className="px-5 py-2.5 border border-white/15 text-white/50 text-xs uppercase tracking-[0.12em] font-body font-medium hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-all duration-400">
              Login
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* MOBILE NAV */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-2xl border-b border-[#C9A84C]/8">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative w-10 h-10 overflow-hidden">
              <Image src="/images/AB_Logo_transparent.png" alt="AB Entertainment" fill className="object-contain" priority />
            </div>
            <span className="text-white font-body text-[10px] uppercase tracking-[0.2em] font-semibold">AB Entertainment</span>
          </Link>
          <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-[#C9A84C]" aria-label="Toggle menu" aria-expanded={isOpen}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d={isOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
        <AnimatePresence>
          {isOpen && (
            <motion.div variants={mobileMenuVariants} initial="hidden" animate="visible" exit="exit" className="border-t border-[#C9A84C]/8 overflow-hidden">
              <div className="px-4 py-6 space-y-1">
                {NAVIGATION.map((link) => (
                  <motion.div key={link.href} variants={mobileItemVariants}>
                    <Link href={link.href}
                      className={`block py-3 px-3 text-sm uppercase tracking-wider font-body transition-all duration-200 ${
                        isActive(link.href) ? 'text-[#C9A84C] bg-[#C9A84C]/5' : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}>
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
                <motion.div variants={mobileItemVariants} className="pt-4 mt-4 border-t border-[#C9A84C]/8 space-y-3">
                  <Link href="/contact" className="block w-full px-4 py-3 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-sm text-center uppercase tracking-wider font-body font-bold">
                    Contact Us
                  </Link>
                  <Link href="/admin/login" className="block w-full px-4 py-3 border border-white/15 text-white/50 text-sm text-center uppercase tracking-wider font-body font-medium">
                    Login
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
