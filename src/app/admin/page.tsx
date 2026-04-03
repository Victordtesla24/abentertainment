'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { getApiUrl } from '@/lib/api-config';

/**
 * Admin page — checks session cookie client-side.
 * Production VPS should set httpOnly: true on the cookie;
 * this dev-mode route uses httpOnly: false for local testing.
 */
export default function AdminPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const verify = async () => {
      if (!document.cookie.includes('ab-admin-session-v3')) {
        router.replace('/admin/login');
        if (!isCancelled) setLoading(false);
        return;
      }

      try {
        const response = await fetch(getApiUrl('/api/admin/auth'), {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          router.replace('/admin/login');
          return;
        }

        if (!isCancelled) {
          setIsAuthed(true);
        }
      } catch {
        router.replace('/admin/login');
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void verify();

    return () => {
      isCancelled = true;
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="text-white/50 text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthed) return null;

  return (
    <AdminDashboard
      initialEvents={[]}
      initialSponsors={[]}
      initialGallery={[]}
      initialSettings={{
        chatModel: 'gpt-4o-mini',
        heroTitle: 'AB ENTERTAINMENT',
        heroSubtitle: 'Experience Events Like No Other',
        contactEmail: 'abhi@abentertainment.com.au',
        contactPhone: '(+61) 430082646',
      }}
    />
  );
}
