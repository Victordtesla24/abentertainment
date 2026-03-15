"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles, Shield, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, SITE_CONFIG } from "@/lib/constants";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { useUser, useClerk } from "@clerk/nextjs";

export function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 42);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <header className="fixed inset-x-0 top-4 z-50 px-4 md:px-6">
        <motion.nav
          initial={false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "luxury-panel-dark mx-auto flex max-w-6xl items-center justify-between rounded-[1.75rem] px-4 py-3 transition-all duration-700 md:px-6",
            isScrolled
              ? "border-gold/18 bg-charcoal-deep/88 shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_1px_rgba(201,168,76,0.15)]"
              : "border-transparent bg-charcoal-deep/50"
          )}
        >
          <Link
            href="/"
            onClick={closeMenu}
            className="group relative z-10 flex items-center"
            aria-label={`${SITE_CONFIG.name} - Home`}
          >
            <Image
              src="/images/ab-logo-hq.jpg"
              alt="AB Entertainment"
              width={160}
              height={55}
              className="h-14 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
              priority
            />
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-full px-4 py-2 font-body text-xs uppercase tracking-[0.26em] transition-all duration-300",
                  isActive(item.href)
                    ? "bg-gold/12 text-gold"
                    : "text-ivory/62 hover:bg-ivory/6 hover:text-ivory"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <span className="hidden items-center gap-2 rounded-full border border-ivory/10 bg-ivory/5 px-3 py-2 xl:flex">
              <Sparkles className="h-3.5 w-3.5 text-gold" strokeWidth={1.8} />
              <span className="font-body text-[0.62rem] uppercase tracking-[0.3em] text-ivory/75">
                Season 2026
              </span>
            </span>
            <LocaleSwitcher />
            <ThemeToggle />

            {/* Admin Login / Dashboard */}
            {isSignedIn ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/admin"
                  className={cn(
                    "group inline-flex items-center gap-2 rounded-full border px-4 py-2.5 font-body text-xs uppercase tracking-[0.22em] transition-all duration-300",
                    isActive("/admin")
                      ? "border-gold/50 bg-gold/15 text-gold"
                      : "border-ivory/12 bg-ivory/5 text-ivory/60 hover:border-gold/30 hover:bg-gold/8 hover:text-gold"
                  )}
                  title={`Signed in as ${user?.firstName || user?.emailAddresses?.[0]?.emailAddress || "Admin"}`}
                >
                  <Shield className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Admin
                </Link>
                <button
                  onClick={() => signOut({ redirectUrl: "/" })}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-ivory/8 bg-ivory/5 text-ivory/65 transition-all duration-300 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              </div>
            ) : (
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 rounded-full border border-ivory/12 bg-ivory/5 px-4 py-2.5 font-body text-xs uppercase tracking-[0.22em] text-ivory/72 transition-all duration-300 hover:border-ivory/25 hover:bg-ivory/8 hover:text-ivory/90"
              >
                <Shield className="h-3.5 w-3.5" strokeWidth={1.8} />
                Admin Login
              </Link>
            )}

            <Link
              href="/contact"
              className="group inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-5 py-2.5 font-body text-xs uppercase tracking-[0.26em] text-gold transition-all duration-300 hover:border-gold hover:bg-gold hover:text-charcoal"
            >
              Book Now
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                strokeWidth={1.8}
              />
            </Link>
          </div>

          <button
            onClick={() => setIsOpen((value) => !value)}
            className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full border border-ivory/10 bg-ivory/5 text-ivory lg:hidden"
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
          >
            <div className="flex flex-col gap-1.5">
              <motion.span
                animate={isOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.25 }}
                className="block h-px w-5 bg-current"
              />
              <motion.span
                animate={isOpen ? { opacity: 0 } : { opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="block h-px w-5 bg-current"
              />
              <motion.span
                animate={isOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.25 }}
                className="block h-px w-5 bg-current"
              />
            </div>
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
            className="fixed inset-0 z-40 overflow-hidden bg-charcoal-deep/96 px-6 pb-8 pt-28 backdrop-blur-2xl lg:hidden"
          >
            <div
              className="absolute inset-0"
              aria-hidden="true"
              style={{
                background:
                  "radial-gradient(circle at top, rgba(201, 168, 76, 0.16), transparent 30%), radial-gradient(circle at bottom right, rgba(107, 29, 58, 0.24), transparent 28%)",
              }}
            />
            <div className="relative mx-auto flex h-full max-w-sm flex-col justify-between">
              <div>
                <p className="eyebrow-label">The Digital Theatre</p>
                <div className="mt-10 space-y-4">
                  {NAV_ITEMS.map((item, index) => (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
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
                          "block rounded-[1.5rem] border px-5 py-5 font-display text-4xl transition-all duration-300",
                          isActive(item.href)
                            ? "border-gold/35 bg-gold/10 text-gold"
                            : "border-ivory/10 bg-ivory/5 text-ivory/72"
                        )}
                      >
                        {item.label}
                      </Link>
                    </motion.div>
                  ))}

                  {/* Mobile Admin Link */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{
                      delay: NAV_ITEMS.length * 0.06,
                      duration: 0.45,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    {isSignedIn ? (
                      <div className="flex gap-3">
                        <Link
                          href="/admin"
                          onClick={closeMenu}
                          className="flex flex-1 items-center gap-3 rounded-[1.5rem] border border-gold/20 bg-gold/8 px-5 py-5 font-display text-2xl text-gold transition-all duration-300"
                        >
                          <Shield className="h-6 w-6" strokeWidth={1.5} />
                          Admin
                        </Link>
                        <button
                          onClick={() => {
                            closeMenu();
                            signOut({ redirectUrl: "/" });
                          }}
                          className="flex items-center justify-center rounded-[1.5rem] border border-ivory/10 bg-ivory/5 px-5 text-ivory/72 transition-all duration-300 hover:border-red-500/30 hover:text-red-400"
                        >
                          <LogOut className="h-5 w-5" strokeWidth={1.5} />
                        </button>
                      </div>
                    ) : (
                      <Link
                        href="/sign-in"
                        onClick={closeMenu}
                        className="flex items-center gap-3 rounded-[1.5rem] border border-ivory/10 bg-ivory/5 px-5 py-5 font-display text-2xl text-ivory/72 transition-all duration-300"
                      >
                        <Shield className="h-6 w-6" strokeWidth={1.5} />
                        Admin Login
                      </Link>
                    )}
                  </motion.div>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.5 }}
                className="luxury-panel-dark rounded-[2rem] p-6"
              >
                <p className="font-body text-[0.62rem] uppercase tracking-[0.34em] text-gold/70">
                  Season Brief
                </p>
                <p className="mt-4 font-display text-2xl leading-tight text-ivory">
                  A premium cultural program designed with the discipline of live production.
                </p>
                <p className="mt-4 font-body text-sm leading-relaxed text-ivory/75">
                  Concerts, theatrical evenings, and community-defining moments across Australia.
                </p>
                <div className="mt-6 flex items-center justify-between">
                  <ThemeToggle />
                  <Link
                    href="/contact"
                    onClick={closeMenu}
                    className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 font-body text-xs uppercase tracking-[0.24em] text-charcoal"
                  >
                    Start an Enquiry
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </Link>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
