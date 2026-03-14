import Link from "next/link";
import { ArrowUpRight, MapPin, Mail, Sparkles } from "lucide-react";
import { NAV_ITEMS, SITE_CONFIG } from "@/lib/constants";
import { FooterNewsletter } from "./FooterNewsletter";

const SECONDARY_LINKS = [
  { label: "Cultural Journal", href: "/blog" },
  { label: "Sponsor Portal", href: "/sponsor-dashboard" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

const FOOTER_NOTES = [
  {
    title: "Season Language",
    body: "Luxury event hospitality, editorial storytelling, and cultural programming shaped with theatre-grade discipline.",
  },
  {
    title: "Coverage",
    body: "Melbourne-led productions with audience reach across Australia and New Zealand.",
  },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="stage-shell relative overflow-hidden border-t border-gold/10 bg-charcoal-deep text-ivory/72">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at top, rgba(201, 168, 76, 0.12), transparent 24%), radial-gradient(circle at 84% 18%, rgba(107, 29, 58, 0.18), transparent 24%)",
        }}
      />

      <div className="mx-auto max-w-7xl px-6 pb-6 pt-16 lg:px-8">
        <div className="stage-card-dark rounded-[2.6rem] p-6 md:p-8 lg:p-10">
          <div className="grid gap-10 xl:grid-cols-[1.04fr_0.96fr]">
            <div className="space-y-8">
              <div>
                <span className="eyebrow-label">Curtain Call</span>
                <h2 className="mt-7 max-w-3xl font-display text-[clamp(2.75rem,6vw,4.8rem)] leading-[0.94] text-ivory">
                  The next act begins long before the lights go down.
                </h2>
                <p className="mt-5 max-w-2xl font-body text-base leading-relaxed text-ivory/56 md:text-lg">
                  AB Entertainment blends premium guest experience, cultural reverence, and modern production precision to create moments that linger long after the applause.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {FOOTER_NOTES.map((note) => (
                  <article key={note.title} className="stat-chip rounded-[1.7rem] p-5">
                    <p className="numeric-label !text-gold/62">{note.title}</p>
                    <p className="mt-3 font-body text-sm leading-relaxed text-ivory/58">
                      {note.body}
                    </p>
                  </article>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[2rem] border border-ivory/10 bg-ivory/5 p-6">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/18 bg-gold/10 text-gold">
                      <Sparkles className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <div>
                      <p className="numeric-label !text-gold/62">Brand Signature</p>
                      <p className="mt-3 font-display text-2xl leading-tight text-ivory">
                        Where tradition takes the stage.
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 font-body text-sm leading-relaxed text-ivory/54">
                    A digital flagship for audiences, partners, artists, and sponsors who expect polish at every touchpoint.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {Object.entries(SITE_CONFIG.social).map(([platform, url]) => (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Follow us on ${platform}`}
                        className="group inline-flex items-center gap-2 rounded-full border border-ivory/10 bg-ivory/5 px-4 py-2 font-body text-[0.65rem] uppercase tracking-[0.24em] text-ivory/58 transition-all duration-300 hover:border-gold/20 hover:text-gold"
                      >
                        <SocialIcon platform={platform} />
                        {platform}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-ivory/10 bg-ivory/5 p-6">
                  <p className="numeric-label !text-gold/62">Reach The Team</p>
                  <div className="mt-5 space-y-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ivory/10 bg-charcoal text-gold">
                        <Mail className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <div>
                        <p className="font-body text-xs uppercase tracking-[0.24em] text-ivory/36">
                          Email
                        </p>
                        <a
                          href={`mailto:${SITE_CONFIG.contact.email}`}
                          className="mt-2 inline-block font-display text-2xl leading-tight text-ivory transition-colors hover:text-gold"
                        >
                          {SITE_CONFIG.contact.email}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ivory/10 bg-charcoal text-gold">
                        <MapPin className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <div>
                        <p className="font-body text-xs uppercase tracking-[0.24em] text-ivory/36">
                          Base
                        </p>
                        <p className="mt-2 font-body text-sm leading-relaxed text-ivory/58">
                          {SITE_CONFIG.contact.location}
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/contact"
                      className="button-secondary mt-2 px-5 py-3 text-[0.68rem]"
                    >
                      Start a Conversation
                      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              <FooterNewsletter />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="stage-card-dark rounded-[2rem] p-6">
                  <p className="eyebrow-label">Navigate</p>
                  <ul className="mt-6 space-y-3">
                    {NAV_ITEMS.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="group flex items-center justify-between rounded-[1.1rem] border border-transparent px-3 py-3 font-body text-sm text-ivory/62 transition-all duration-300 hover:border-gold/12 hover:bg-ivory/5 hover:text-gold"
                        >
                          {item.label}
                          <ArrowUpRight
                            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                            strokeWidth={1.8}
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="stage-card-dark rounded-[2rem] p-6">
                  <p className="eyebrow-label">Beyond The Stage</p>
                  <ul className="mt-6 space-y-3">
                    {SECONDARY_LINKS.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="group flex items-center justify-between rounded-[1.1rem] border border-transparent px-3 py-3 font-body text-sm text-ivory/62 transition-all duration-300 hover:border-gold/12 hover:bg-ivory/5 hover:text-gold"
                        >
                          {item.label}
                          <ArrowUpRight
                            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                            strokeWidth={1.8}
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 px-2 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <p className="font-body text-xs uppercase tracking-[0.24em] text-ivory/30">
            &copy; {currentYear} {SITE_CONFIG.name}. All rights reserved.
          </p>
          <p className="font-body text-xs uppercase tracking-[0.24em] text-ivory/28">
            Premium Indian and Marathi cultural experiences since 2007
          </p>
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
        <svg className={size} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      );
    case "facebook":
      return (
        <svg className={size} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "youtube":
      return (
        <svg className={size} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    default:
      return null;
  }
}
