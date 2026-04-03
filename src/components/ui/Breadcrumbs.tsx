'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const routeLabels: Record<string, string> = {
  about: 'About',
  events: 'Events',
  gallery: 'Gallery',
  sponsors: 'Sponsors',
  contact: 'Contact',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  if (pathname === '/') return null;

  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-2 text-sm font-body">
        <li>
          <Link href="/" className="text-white/50 hover:text-[#C9A84C] transition-colors duration-300">
            Home
          </Link>
        </li>
        {segments.map((segment, index) => {
          const href = '/' + segments.slice(0, index + 1).join('/');
          const isLast = index === segments.length - 1;
          const label = routeLabels[segment] || segment
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          return (
            <li key={href} className="flex items-center gap-2">
              <span className="text-[#C9A84C]/30">/</span>
              {isLast ? (
                <span className="text-[#C9A84C]" aria-current="page">{label}</span>
              ) : (
                <Link href={href} className="text-white/50 hover:text-[#C9A84C] transition-colors duration-300">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
