import { Metadata } from 'next';
import CommunityPageContent from '@/components/community/CommunityPageContent';

export const metadata: Metadata = {
  title: 'Community',
  description:
    'Connect with the AB Entertainment community — Melbourne\'s Indian & Marathi cultural family. Follow us, get in touch, and stay part of the story.',
  alternates: {
    canonical: 'https://abentertainment.com.au/community/',
  },
  openGraph: {
    title: 'Community | AB Entertainment',
    description:
      'Connect with the AB Entertainment community — Melbourne\'s Indian & Marathi cultural family. Follow us, get in touch, and stay part of the story.',
    url: 'https://abentertainment.com.au/community/',
  },
};

export default function CommunityPage() {
  return <CommunityPageContent />;
}
