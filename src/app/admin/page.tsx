import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionCookieName, validateSessionToken } from '@/lib/auth';
import { getEvents, getSponsors, getGalleryImages, getSettings } from '@/lib/data';
import AdminDashboard from '@/components/admin/AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(getSessionCookieName());

  if (!sessionCookie || !validateSessionToken(sessionCookie.value)) {
    redirect('/admin/login');
  }

  const [events, sponsors, gallery, settings] = await Promise.all([
    getEvents(),
    getSponsors(),
    getGalleryImages(),
    getSettings(),
  ]);

  return (
    <AdminDashboard
      initialEvents={events}
      initialSponsors={sponsors}
      initialGallery={gallery}
      initialSettings={settings}
    />
  );
}
