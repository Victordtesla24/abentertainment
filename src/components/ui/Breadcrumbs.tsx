'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const routeLabels: Record<string, string> = {
  about: 'About',
  events: 'Events',
  gallery: 'Gallery',
  sponsors: 'Sponsors',
  community: 'Community',
  contact: 'Contact',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
};

/** 44px-tall tap target on touch devices without changing the desktop look. */
const linkClass =
  'inline-flex items-center justify-center py-1 text-white/50 transition-colors duration-300 hover:text-[#C9A84C] pointer-coarse:min-h-11 pointer-coarse:min-w-11';

export default function Breadcrumbs() {
  const pathname = usePathname();
  if (pathname === '/') return null;

  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="mb-6 max-w-full pointer-coarse:mb-2">
      {/* Wraps instead of overflowing: event slugs make long trails on phones. */}
      <ol className="flex flex-wrap items-center gap-x-2 text-sm font-body">
        <li>
          <Link href="/" className={linkClass}>
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
            <li key={href} className="flex min-w-0 items-center gap-2">
              <span className="text-[#C9A84C]/30">/</span>
              {isLast ? (
                <span className="min-w-0 [overflow-wrap:anywhere] text-[#C9A84C]" aria-current="page">{label}</span>
              ) : (
                <Link href={href} className={linkClass}>
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
