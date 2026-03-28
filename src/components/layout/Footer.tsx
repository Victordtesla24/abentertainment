'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { SITE_CONFIG, NAVIGATION } from '@/lib/constants';

export default function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null;
  const [email, setEmail] = useState('');
  const [subscribeStatus, setSubscribeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribeStatus('loading');
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSubscribeStatus('success');
      setEmail('');
      setTimeout(() => setSubscribeStatus('idle'), 3000);
    } catch {
      setSubscribeStatus('error');
      setTimeout(() => setSubscribeStatus('idle'), 3000);
    }
  };

  const currentYear = new Date().getFullYear();

  const footerColumns = {
    'Quick Links': NAVIGATION.map((nav) => ({ label: nav.label, href: nav.href })),
    Events: [
      { label: 'Upcoming Events', href: '/events' },
      { label: 'Past Events', href: '/events' },
      { label: 'Gallery', href: '/gallery' },
      { label: 'Sponsors', href: '/sponsors' },
    ],
    Contact: [
      { label: SITE_CONFIG.contact.phone, href: `tel:${SITE_CONFIG.contact.phone}` },
      { label: SITE_CONFIG.contact.email, href: `mailto:${SITE_CONFIG.contact.email}` },
      { label: `${SITE_CONFIG.contact.address.city}, ${SITE_CONFIG.contact.address.state}`, href: '#' },
    ],
  };

  return (
    <footer className="bg-[#070707] border-t border-[#C9A84C]/8 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.03),transparent_70%)] pointer-events-none" />

      {/* Newsletter */}
      <div className="border-b border-[#C9A84C]/8">
        <div className="container-eu py-16">
          <div className="flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="text-center md:text-left">
              <h3 className="text-2xl md:text-3xl font-display text-white mb-2">
                Stay <span className="gold-shimmer">Updated</span>
              </h3>
              <p className="text-white/30 font-body text-sm">Subscribe for exclusive event updates and cultural insights.</p>
            </div>
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email"
                disabled={subscribeStatus === 'loading'}
                className="flex-1 md:w-80 px-5 py-3.5 bg-white/[0.03] border border-[#C9A84C]/12 text-white font-body text-sm placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/40 focus:bg-white/[0.05] transition-all duration-400 disabled:opacity-50"
                required />
              <button type="submit" disabled={subscribeStatus === 'loading'}
                className="group relative px-8 py-3.5 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-sm font-bold font-body uppercase tracking-wider overflow-hidden transition-all duration-400 disabled:opacity-50 hover:shadow-[0_0_25px_rgba(201,168,76,0.3)]">
                <span className="relative z-10">
                  {subscribeStatus === 'loading' ? 'Subscribing...' : subscribeStatus === 'success' ? 'Subscribed!' : 'Subscribe'}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-[#D4B65C] to-[#E8D5A3] opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
              </button>
            </form>
          </div>
          {subscribeStatus === 'success' && (
            <p className="text-center md:text-right text-[#C9A84C] text-sm mt-3 font-body">Thank you for subscribing!</p>
          )}
        </div>
      </div>

      {/* Main footer grid */}
      <div className="container-eu py-18">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Company info */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 bg-[#C9A84C]/5 blur-xl rounded-full" />
                <Image src="/images/AB_Logo_transparent.png" alt="AB Entertainment" fill className="object-contain" />
              </div>
              <div>
                <h2 className="text-lg font-display text-white font-semibold leading-tight">{SITE_CONFIG.name}</h2>
                <p className="text-[#C9A84C]/40 text-[10px] uppercase tracking-[0.15em] font-body">Experience events like no other</p>
              </div>
            </div>
            <p className="text-white/25 font-body text-sm mb-7 leading-[1.8]">
              AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life.
            </p>
            {/* Social icons */}
            <div className="flex gap-3">
              <a href={SITE_CONFIG.social.instagram} target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 flex items-center justify-center border border-[#C9A84C]/12 text-[#C9A84C]/40 hover:bg-gradient-to-br hover:from-[#C9A84C] hover:to-[#D4B65C] hover:text-black hover:border-[#C9A84C] transition-all duration-400 hover:shadow-[0_0_15px_rgba(201,168,76,0.2)]"
                aria-label="Follow us on Instagram">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
              </a>
              <a href={SITE_CONFIG.social.facebook} target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 flex items-center justify-center border border-[#C9A84C]/12 text-[#C9A84C]/40 hover:bg-gradient-to-br hover:from-[#C9A84C] hover:to-[#D4B65C] hover:text-black hover:border-[#C9A84C] transition-all duration-400 hover:shadow-[0_0_15px_rgba(201,168,76,0.2)]"
                aria-label="Follow us on Facebook">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerColumns).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="text-xs font-semibold text-[#C9A84C]/80 uppercase tracking-[0.25em] font-body mb-6 pb-3 border-b border-[#C9A84C]/8">{heading}</h3>
              <ul className="space-y-3.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-white/25 hover:text-[#C9A84C] transition-colors duration-400 text-sm font-body">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-[#C9A84C]/6">
        <div className="container-eu py-7 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-white/20 text-xs font-body">&copy; {currentYear} {SITE_CONFIG.name}. All rights reserved.</p>
          <p className="text-white/12 text-xs font-body">Crafted with passion in Melbourne, Australia</p>
        </div>
      </div>
    </footer>
  );
}
