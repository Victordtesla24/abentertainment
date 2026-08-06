import { Metadata } from 'next';
import { getPublicSponsors } from '@/lib/data';
import PageHero from '@/components/ui/PageHero';
import SponsorsContent from '@/components/SponsorsContent';

import type { Sponsor } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Sponsors',
  description:
    'Our valued sponsors and partners who make AB Entertainment events possible.',
  alternates: {
    canonical: 'https://abentertainment.com.au/sponsors/',
  },
  openGraph: {
    title: 'Sponsors | AB Entertainment',
    description:
      'Our valued sponsors and partners who make AB Entertainment events possible.',
    url: 'https://abentertainment.com.au/sponsors/',
  },
};

export default async function SponsorsPage() {
  let sponsors: Sponsor[] = [];

  try {
    sponsors = await getPublicSponsors();
  } catch (error) {
    console.error('Error loading sponsors:', error);
  }

  return (
    <div className="bg-[#0A0A0A]">
      <PageHero
        image="/images/heroes/sponsors-hero.png"
        badge="Our Partners"
        title="Sponsors &"
        highlight="Partners"
        subtitle="We are grateful to the organizations that support and make our cultural events possible"
      />

      <SponsorsContent initialSponsors={sponsors} />
    </div>
  );
}
