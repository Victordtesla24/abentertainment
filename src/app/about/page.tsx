import { Metadata } from 'next';
import AboutPageContent from '@/components/about/AboutPageContent';
import { getPublicSiteMetrics } from '@/lib/data';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn about AB Entertainment, Melbourne\'s premier Indian & Marathi cultural events company.',
  alternates: {
    canonical: 'https://abentertainment.com.au/about/',
  },
  openGraph: {
    title: 'About | AB Entertainment',
    description:
      'Learn about AB Entertainment, Melbourne\'s premier Indian & Marathi cultural events company.',
    url: 'https://abentertainment.com.au/about/',
  },
};

export default async function AboutPage() {
  // Build-time (or revalidated) snapshot of the admin-managed metrics; the
  // page then fetches the live values from /api/metrics.
  const metrics = await getPublicSiteMetrics();
  return <AboutPageContent initialMetrics={metrics} />;
}
