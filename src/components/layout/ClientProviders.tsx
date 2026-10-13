'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { LazyMotion, domAnimation } from 'framer-motion';

// Dynamic imports for heavy client components — saves ~680KB from initial bundle
const ThreeCanvas = dynamic(() => import('@/components/ui/ThreeCanvas'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 -z-10 pointer-events-none bg-[#0A0A0A]" aria-hidden="true" />
  ),
});
const ChatWidget = dynamic(() => import('@/components/ui/ChatWidget'), { ssr: false });
const BackToTop = dynamic(() => import('@/components/ui/BackToTop'), { ssr: false });
const CookieConsent = dynamic(() => import('@/components/ui/CookieConsent'), { ssr: false });

export default function ClientProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The public-site overlays (concierge chat FAB, back-to-top, cookie banner)
  // are fixed-position and stack above the admin login form on phones, where
  // the cookie banner (z-[1000]) and chat FAB cover the Sign In button. The
  // admin area has its own chrome, so none of them belong on /admin routes.
  const isAdmin = pathname.startsWith('/admin');
  return (
    <LazyMotion features={domAnimation}>
      <ThreeCanvas />
      {children}
      {!isAdmin && <ChatWidget />}
      {!isAdmin && <BackToTop />}
      {!isAdmin && <CookieConsent />}
    </LazyMotion>
  );
}
