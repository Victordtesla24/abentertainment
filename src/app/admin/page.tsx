'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';
export default function AdminPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!document.cookie.includes('ab_admin_session')) { router.replace('/admin/login'); } else { setIsAuthed(true); }
    setLoading(false);
  }, [router]);
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0a1628]"><div className="text-white/50 text-sm">Loading...</div></div>;
  if (!isAuthed) return null;
  return <AdminDashboard initialEvents={[]} initialSponsors={[]} initialGallery={[]} initialSettings={{ chatModel: 'gpt-4o', heroTitle: '', heroSubtitle: '', contactEmail: 'abhi@abentertainment.com.au', contactPhone: '(+61) 430082646' }} />;
}
