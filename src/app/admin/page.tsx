'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { getApiUrl } from '@/lib/api-config';

/**
 * Admin page — verifies session via server-side API check instead of
 * reading document.cookie directly. This allows the auth cookie to be
 * httpOnly (not readable by JS), preventing XSS session theft (#3).
 */
export default function AdminPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(getApiUrl('/api/admin/auth'), {
          method: 'GET',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthed(true);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Auth check failed — redirect to login
      }
      router.replace('/admin/login');
      setLoading(false);
    }
    checkAuth();
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
