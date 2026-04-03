'use client';

import dynamic from 'next/dynamic';
import { ReactNode, useState, useCallback } from 'react';
import { LazyMotion, domAnimation } from 'framer-motion';

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
  const [, setPreloaderDone] = useState(false);
  const handlePreloaderComplete = useCallback(() => {
    setPreloaderDone(true);
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <Preloader onComplete={handlePreloaderComplete} />
      <ThreeCanvas />
      {children}
      <ChatWidget />
      <BackToTop />
      <CookieConsent />
      {/* preloaderDone state tracks when curtain animation finishes; available for future context integration */}
    </LazyMotion>
  );
}
