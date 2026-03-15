"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Image as ImageIcon,
  LayoutDashboard,
  MapPin,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Users,
  Award,
  FileText,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";

const NAV_MAIN = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Events", href: "/admin/events", icon: CalendarDays },
  { label: "Gallery", href: "/admin/gallery", icon: ImageIcon },
  { label: "Venues", href: "/admin/venues", icon: MapPin },
] as const;

const NAV_MANAGE = [
  { label: "Team", href: "/admin/team", icon: Users },
  { label: "Sponsors", href: "/admin/sponsors", icon: Award },
  { label: "Blog", href: "/admin/blog", icon: FileText },
  { label: "Settings", href: "/admin/settings", icon: Settings },
] as const;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AdminShell({
  displayName,
  email,
  children,
}: {
  displayName: string;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { signOut } = useClerk();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen bg-[#0e0d10]">
      {/* Sidebar - Desktop */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-white/8 bg-[#141318] lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/8 px-6 py-5">
            <Link href="/" className="flex items-center">
              <Image
                src="/images/ab-logo-hq.jpg"
                alt="AB Entertainment"
                width={120}
                height={40}
                className="h-8 w-auto object-contain"
              />
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-1">
              {NAV_MAIN.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                      isActive(item.href)
                        ? "bg-[#c9a84c]/12 text-[#c9a84c]"
                        : "text-white/50 hover:bg-white/5 hover:text-white/80"
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                    {item.label}
                    {isActive(item.href) && (
                      <ChevronRight className="ml-auto h-3.5 w-3.5 text-[#c9a84c]/50" />
                    )}
                  </Link>
                );
              })}
            </div>
            <div className="my-3 mx-4 h-px bg-white/8" />
            <p className="mb-2 px-4 text-[0.6rem] uppercase tracking-widest text-white/25">
              Manage
            </p>
            <div className="space-y-1">
              {NAV_MANAGE.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                      isActive(item.href)
                        ? "bg-[#c9a84c]/12 text-[#c9a84c]"
                        : "text-white/50 hover:bg-white/5 hover:text-white/80"
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                    {item.label}
                    {isActive(item.href) && (
                      <ChevronRight className="ml-auto h-3.5 w-3.5 text-[#c9a84c]/50" />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-white/8 px-4 py-4">
            <div className="rounded-xl bg-white/5 px-4 py-3">
              <p className="text-sm font-medium text-white/80">{displayName}</p>
              <p className="mt-0.5 truncate text-xs text-white/40">{email}</p>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              className="mt-2 flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.8} />
              Sign Out
            </button>
          </div>

          <div className="border-t border-white/8 px-4 py-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs text-white/30 transition-colors hover:text-white/60"
            >
              ← Back to Website
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-72 h-full bg-[#141318] border-r border-white/8 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <span className="text-sm font-semibold text-white">Admin Panel</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="px-3 py-4">
              <div className="space-y-1">
                {NAV_MAIN.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                        isActive(item.href)
                          ? "bg-[#c9a84c]/12 text-[#c9a84c]"
                          : "text-white/50 hover:bg-white/5 hover:text-white/80"
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              <div className="my-3 mx-4 h-px bg-white/8" />
              <p className="mb-2 px-4 text-[0.6rem] uppercase tracking-widest text-white/25">
                Manage
              </p>
              <div className="space-y-1">
                {NAV_MANAGE.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                        isActive(item.href)
                          ? "bg-[#c9a84c]/12 text-[#c9a84c]"
                          : "text-white/50 hover:bg-white/5 hover:text-white/80"
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-4 border-b border-white/8 bg-[#141318]/50 px-4 backdrop-blur-md lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-white/40 hover:bg-white/8 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <Link
            href="/"
            className="rounded-xl border border-white/10 px-4 py-2 text-xs text-white/50 transition-colors hover:border-white/20 hover:text-white/70"
          >
            View Website →
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
