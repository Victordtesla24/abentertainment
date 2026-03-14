"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Images,
  PhoneCall,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, SITE_CONFIG } from "@/lib/constants";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const SHOWCASE_CARDS = [
  {
    href: "/events",
    label: "Act I",
    title: "Season Program",
    description: "Headline concerts, theatre nights, and cultural productions staged like marquee events.",
    image: "/images/hero/hero-stage-2.jpg",
    stat: "6 signature productions",
    className: "md:col-span-2 xl:col-span-2",
  },
  {
    href: "/gallery",
    label: "Act II",
    title: "Archive Gallery",
    description: "An immersive wall of stage, audience, and backstage moments with cinematic lightbox reveals.",
    image: "/images/gallery/niyam-v-ati-5.jpg",
    stat: "AI-tagged visual archive",
  },
  {
    href: "/contact",
    label: "Act III",
    title: "Private Bookings",
    description: "Partnerships, premium hospitality, sponsor conversations, and private cultural productions.",
    image: "/images/hero/hero-event-live.jpg",
    stat: "Concierge-led response",
  },
];

const QUICK_NOTES = [
  {
    icon: CalendarDays,
    title: "Season 2026",
    body: "Luxury cultural programming for audiences across Melbourne and the wider AU/NZ circuit.",
  },
  {
    icon: Images,
    title: "Visual Archive",
    body: "Lightbox-first galleries with editorial curation, mood tags, and immersive crop treatments.",
  },
  {
    icon: Users,
    title: "Partner Ready",
    body: "Sponsor portal, branded hospitality, and premium enquiry flows for high-trust collaborators.",
  },
];

export function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setIsScrolled(currentY > 42);

      // Apple-style: hide on scroll down, reveal on scroll up
      if (!isOpen) {
        if (currentY > lastScrollY.current && currentY > 80) {
          setIsHidden(true);
        } else if (currentY < lastScrollY.current) {
          setIsHidden(false);
        }
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);
  const toggleMenu = () => setIsOpen((value) => !value);

  return (
    <>
      <header className="fixed inset-x-0 top-4 z-50 px-4 md:px-6">
        <motion.nav
          initial={false}
          animate={{
            y: isHidden ? -100 : 0,
            opacity: isHidden ? 0 : 1,
          }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "luxury-panel-dark mx-auto flex max-w-[88rem] items-center justify-between gap-4 rounded-[1.85rem] px-4 py-3 md:px-5 lg:px-6",
            isScrolled
              ? "border-gold/20 bg-charcoal-deep/88 shadow-[0_30px_90px_rgba(0,0,0,0.48)]"
              : "bg-charcoal-deep/68"
          )}
        >
          <Link
            href="/"
            onClick={closeMenu}
            className="group relative z-10 flex min-w-0 items-center gap-3 md:gap-4"
            aria-label={`${SITE_CONFIG.name} home`}
            data-magnetic
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/28 bg-gold/12 font-display text-lg text-gold transition-all duration-300 group-hover:border-gold group-hover:bg-gold/18">
              AB
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-[1.35rem] leading-none tracking-tight text-ivory md:text-[1.5rem]">
                Entertainment
              </span>
              <span className="mt-1 block truncate font-body text-[0.58rem] uppercase tracking-[0.34em] text-ivory/42">
                Melbourne&apos;s Digital Theatre
              </span>
            </span>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-magnetic
                className={cn(
                  "relative inline-flex items-center rounded-full px-4 py-2.5 font-body text-[0.68rem] uppercase tracking-[0.28em] transition-colors duration-300",
                  isActive(item.href)
                    ? "text-gold"
                    : "text-ivory/58 hover:text-ivory"
                )}
              >
                {isActive(item.href) ? (
                  <motion.span
                    layoutId="navigation-active-pill"
                    className="absolute inset-0 rounded-full border border-gold/18 bg-gold/10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : null}
                <span className="relative z-10">{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <div className="rounded-full border border-ivory/10 bg-ivory/5 px-3 py-2">
              <LocaleSwitcher />
            </div>
            <div className="rounded-full border border-ivory/10 bg-ivory/5 p-1.5">
              <ThemeToggle />
            </div>
            <Link
              href="/contact"
              className="button-primary glow-on-hover gold-shimmer px-5 py-3 text-[0.68rem]"
              data-magnetic
            >
              Book Now
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Link>
            <button
              type="button"
              onClick={toggleMenu}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
              className="button-dark px-4 py-3 text-[0.68rem]"
              data-magnetic
            >
              {isOpen ? "Close" : "Menu"}
            </button>
          </div>

          <button
            type="button"
            onClick={toggleMenu}
            className="button-dark shrink-0 px-4 py-3 text-[0.68rem] lg:hidden"
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
          >
            {isOpen ? "Close" : "Menu"}
          </button>
        </motion.nav>
      </header>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-40 overflow-y-auto bg-charcoal-deep/96 px-6 pb-8 pt-28 backdrop-blur-2xl lg:px-8"
          >
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
              style={{
                background:
                  "radial-gradient(circle at top, rgba(201, 168, 76, 0.18), transparent 26%), radial-gradient(circle at 88% 16%, rgba(107, 29, 58, 0.24), transparent 24%)",
              }}
            />
            <button
              type="button"
              onClick={toggleMenu}
              className="button-dark absolute right-6 top-6 px-4 py-3 text-[0.68rem] lg:right-8"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" strokeWidth={1.8} />
              Close
            </button>

            <div className="relative mx-auto max-w-[88rem]">
              <div className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="stage-card-dark rounded-[2.4rem] p-7 md:p-9"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="eyebrow-label">The Digital Theatre</span>
                    <span className="rounded-full border border-gold/16 bg-gold/10 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.3em] text-gold/72">
                      Four core destinations
                    </span>
                  </div>

                  <h2 className="mt-8 max-w-xl font-display text-[clamp(2.75rem,6vw,5rem)] leading-[0.94] text-ivory">
                    Navigate the season like an opening-night program.
                  </h2>
                  <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-ivory/58 md:text-lg">
                    Each section is framed as a distinct act: the live program, the archive, the studio story, and the concierge desk for partnerships and bookings.
                  </p>

                  <div className="mt-10 space-y-4">
                    {NAV_ITEMS.map((item, index) => (
                      <motion.div
                        key={item.href}
                        initial={{ opacity: 0, x: -18 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        transition={{
                          delay: index * 0.06,
                          duration: 0.45,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <Link
                          href={item.href}
                          onClick={closeMenu}
                          className={cn(
                            "group flex items-center justify-between rounded-[1.8rem] border px-5 py-5 transition-all duration-300 md:px-6 md:py-6",
                            isActive(item.href)
                              ? "border-gold/26 bg-gold/10"
                              : "border-ivory/10 bg-ivory/5 hover:border-gold/16 hover:bg-ivory/8"
                          )}
                        >
                          <div>
                            <p className="numeric-label !text-gold/62">Act 0{index + 1}</p>
                            <p className="mt-3 font-display text-[clamp(2rem,4vw,3.2rem)] leading-none text-ivory transition-colors duration-300 group-hover:text-gold">
                              {item.label}
                            </p>
                          </div>
                          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/16 bg-gold/8 text-gold transition-transform duration-300 group-hover:translate-x-1">
                            <ChevronRight className="h-5 w-5" strokeWidth={1.8} />
                          </span>
                        </Link>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-10 grid gap-4 md:grid-cols-3">
                    {QUICK_NOTES.map((note, index) => (
                      <motion.article
                        key={note.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.24 + index * 0.08,
                          duration: 0.45,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="stat-chip rounded-[1.6rem] p-5"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/18 bg-gold/10 text-gold">
                          <note.icon className="h-4 w-4" strokeWidth={1.8} />
                        </span>
                        <p className="mt-4 font-display text-xl text-ivory">{note.title}</p>
                        <p className="mt-3 font-body text-sm leading-relaxed text-ivory/52">
                          {note.body}
                        </p>
                      </motion.article>
                    ))}
                  </div>
                </motion.div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-2">
                  {SHOWCASE_CARDS.map((card, index) => (
                    <motion.article
                      key={card.href}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{
                        delay: 0.08 + index * 0.08,
                        duration: 0.45,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className={cn(
                        "group relative overflow-hidden rounded-[2.2rem] border border-ivory/8 bg-charcoal-light shadow-[0_26px_80px_rgba(0,0,0,0.36)]",
                        card.className
                      )}
                    >
                      <Link href={card.href} onClick={closeMenu} className="block h-full">
                        <div className="relative h-full min-h-[19rem]">
                          <Image
                            src={card.image}
                            alt={card.title}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                            sizes="(max-width: 1024px) 100vw, 50vw"
                          />
                          <div className="image-reveal-overlay" />
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.18),transparent_34%)]" />
                          <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="rounded-full border border-gold/16 bg-gold/10 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.3em] text-gold/78">
                                {card.label}
                              </span>
                              <span className="rounded-full border border-ivory/10 bg-ivory/5 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.3em] text-ivory/58">
                                {card.stat}
                              </span>
                            </div>
                            <h3 className="mt-5 font-display text-3xl leading-tight text-ivory md:text-[2.35rem]">
                              {card.title}
                            </h3>
                            <p className="mt-4 max-w-lg font-body text-sm leading-relaxed text-ivory/62 md:text-base">
                              {card.description}
                            </p>
                            <span className="mt-6 inline-flex items-center gap-2 font-body text-xs uppercase tracking-[0.26em] text-gold">
                              Enter this act
                              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                            </span>
                          </div>
                        </div>
                      </Link>
                    </motion.article>
                  ))}
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ delay: 0.32, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="stage-card-dark mt-6 rounded-[2rem] p-6 md:p-7"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="numeric-label !text-gold/65">Concierge Desk</p>
                    <p className="mt-3 max-w-3xl font-display text-2xl leading-tight text-ivory md:text-3xl">
                      For bookings, media requests, sponsor opportunities, and private productions.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={`mailto:${SITE_CONFIG.contact.email}`}
                      className="button-secondary px-5 py-3 text-[0.68rem]"
                    >
                      <PhoneCall className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {SITE_CONFIG.contact.email}
                    </a>
                    <Link
                      href="/contact"
                      onClick={closeMenu}
                      className="button-primary glow-on-hover gold-shimmer px-5 py-3 text-[0.68rem]"
                    >
                      Start an Enquiry
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
