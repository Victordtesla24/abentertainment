import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SponsorDashboardClient } from './SponsorDashboardClient';

export default async function SponsorDashboard() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const user = await currentUser();

  return <SponsorDashboardClient firstName={user?.firstName ?? ''} />;
}
