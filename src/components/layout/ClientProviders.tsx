'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { LazyMotion, domAnimation } from 'framer-motion';
import ThreeCanvas from '@/components/ui/ThreeCanvas';

// ThreeCanvas is now two plain CSS layers (no WebGL, no script of its own), so it is rendered with
// the page and the server HTML already has the final backdrop. The overlays below load on demand.
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
      {!isAdmin && <ThreeCanvas />}
      {children}
      {!isAdmin && <ChatWidget />}
      {!isAdmin && <BackToTop />}
      {!isAdmin && <CookieConsent />}
    </LazyMotion>
  );
}
