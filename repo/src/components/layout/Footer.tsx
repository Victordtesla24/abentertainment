import Link from "next/link";
import { SITE_CONFIG, NAV_ITEMS } from "@/lib/constants";
import { FooterNewsletter } from "./FooterNewsletter";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-charcoal-deep text-ivory/70">
      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-2" id="footer">
            <Link href="/" className="inline-block">
              <span className="font-display text-3xl font-semibold text-gold">
                AB
              </span>
              <span className="font-display text-3xl font-light text-ivory">
                {" "}Entertainment
              </span>
            </Link>
            <p className="mt-4 max-w-md font-body text-sm leading-relaxed text-ivory/50">
              {SITE_CONFIG.description}
            </p>
            <div className="mt-6 flex gap-4">
              {Object.entries(SITE_CONFIG.social).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-ivory/10 text-ivory/40 transition-all duration-300 hover:border-gold/40 hover:text-gold"
                  aria-label={`Follow us on ${platform}`}
                >
                  <SocialIcon platform={platform} />
                </a>
              ))}
            </div>
          </div>

          {/* Navigation column */}
          <div>
            <h3 className="font-body text-xs font-medium uppercase tracking-[0.2em] text-ivory/40">
              Navigate
            </h3>
            <ul className="mt-4 space-y-3">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="font-body text-sm text-ivory/60 transition-colors hover:text-gold"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact column */}
          <div>
            <h3 className="font-body text-xs font-medium uppercase tracking-[0.2em] text-ivory/40">
              Get in Touch
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href={`mailto:${SITE_CONFIG.contact.email}`}
                  className="font-body text-sm text-ivory/60 transition-colors hover:text-gold"
                >
                  {SITE_CONFIG.contact.email}
                </a>
              </li>
              <li className="font-body text-sm text-ivory/60">
                {SITE_CONFIG.contact.location}
              </li>
            </ul>
          </div>

          {/* Newsletter column */}
          <FooterNewsletter />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-ivory/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 md:flex-row lg:px-8">
          <p className="font-body text-xs text-ivory/30">
            &copy; {currentYear} {SITE_CONFIG.name}. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="font-body text-xs text-ivory/30 transition-colors hover:text-ivory/60"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="font-body text-xs text-ivory/30 transition-colors hover:text-ivory/60"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ platform }: { platform: string }) {
  const size = "h-4 w-4";
  switch (platform) {
    case "instagram":
      return (
        <svg className={size} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      );
    case "facebook":
      return (
        <svg className={size} fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "youtube":
      return (
        <svg className={size} fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    default:
      return null;
  }
}