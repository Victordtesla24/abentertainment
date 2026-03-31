'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

// Dynamic imports for heavy client components — saves ~680KB from initial bundle
const ThreeCanvas = dynamic(() => import('@/components/ui/ThreeCanvas'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 -z-10 pointer-events-none bg-[#0A0A0A]" aria-hidden="true" />
  ),
});
const Preloader = dynamic(() => import('@/components/ui/Preloader'), { ssr: false });
const ChatWidget = dynamic(() => import('@/components/ui/ChatWidget'), { ssr: false });
const BackToTop = dynamic(() => import('@/components/ui/BackToTop'), { ssr: false });
const CookieConsent = dynamic(() => import('@/components/ui/CookieConsent'), { ssr: false });

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <Preloader />
      <ThreeCanvas />
      {children}
      <ChatWidget />
      <BackToTop />
      <CookieConsent />
    </>
  );
}
