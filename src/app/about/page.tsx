import { Metadata } from 'next';
import AboutPageContent from '@/components/about/AboutPageContent';

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

export default function AboutPage() {
  return <AboutPageContent />;
}
