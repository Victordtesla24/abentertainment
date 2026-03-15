"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Image as ImageIcon,
  MapPin,
  TrendingUp,
  ArrowRight,
  Users,
  Award,
  FileText,
  Settings,
} from "lucide-react";

interface DashboardStats {
  totalEvents: number;
  upcomingEvents: number;
  pastEvents: number;
  totalGalleryImages: number;
  totalVenues: number;
  totalTeamMembers: number;
  totalSponsors: number;
  activeSponsors: number;
  totalBlogPosts: number;
  publishedPosts: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  accent = false,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
        accent
          ? "border-[#c9a84c]/20 bg-[#c9a84c]/8"
          : "border-white/8 bg-white/4 hover:border-white/15"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40">{label}</p>
          <p className="mt-2 font-serif text-4xl font-medium text-white">{value}</p>
        </div>
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            accent ? "bg-[#c9a84c]/15 text-[#c9a84c]" : "bg-white/8 text-white/40"
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </span>
      </div>
      <div className="mt-4 flex items-center gap-1 text-xs text-white/30 transition-colors group-hover:text-[#c9a84c]">
        Manage <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}

export function AdminDashboardClient() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEvents: 0,
    upcomingEvents: 0,
    pastEvents: 0,
    totalGalleryImages: 0,
    totalVenues: 0,
    totalTeamMembers: 0,
    totalSponsors: 0,
    activeSponsors: 0,
    totalBlogPosts: 0,
    publishedPosts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-white">Dashboard</h1>
        <p className="mt-2 text-sm text-white/40">
          Welcome back. Manage your events, gallery, team, sponsors, and site content.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl border border-white/8 bg-white/4"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Primary Stats */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Events"
              value={stats.totalEvents}
              icon={CalendarDays}
              href="/admin/events"
            />
            <StatCard
              label="Upcoming"
              value={stats.upcomingEvents}
              icon={TrendingUp}
              href="/admin/events"
              accent
            />
            <StatCard
              label="Gallery Images"
              value={stats.totalGalleryImages}
              icon={ImageIcon}
              href="/admin/gallery"
            />
            <StatCard
              label="Venues"
              value={stats.totalVenues}
              icon={MapPin}
              href="/admin/venues"
            />
          </div>

          {/* Secondary Stats */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Team Members"
              value={stats.totalTeamMembers}
              icon={Users}
              href="/admin/team"
            />
            <StatCard
              label="Sponsors"
              value={stats.totalSponsors}
              icon={Award}
              href="/admin/sponsors"
            />
            <StatCard
              label="Blog Posts"
              value={stats.totalBlogPosts}
              icon={FileText}
              href="/admin/blog"
            />
            <StatCard
              label="Published"
              value={stats.publishedPosts}
              icon={FileText}
              href="/admin/blog"
              accent
            />
          </div>
        </>
      )}

      {/* Quick Actions */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-white/80">Quick Actions</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/events?action=new"
            className="rounded-2xl border border-[#c9a84c]/20 bg-[#c9a84c]/6 p-5 transition-all hover:-translate-y-0.5 hover:border-[#c9a84c]/30 hover:bg-[#c9a84c]/10"
          >
            <CalendarDays className="h-5 w-5 text-[#c9a84c]" strokeWidth={1.6} />
            <p className="mt-3 text-sm font-semibold text-white">Create Event</p>
            <p className="mt-1 text-xs text-white/40">Add an upcoming event</p>
          </Link>
          <Link
            href="/admin/gallery?action=upload"
            className="rounded-2xl border border-white/10 bg-white/4 p-5 transition-all hover:-translate-y-0.5 hover:border-white/15"
          >
            <ImageIcon className="h-5 w-5 text-white/50" strokeWidth={1.6} />
            <p className="mt-3 text-sm font-semibold text-white">Upload Photos</p>
            <p className="mt-1 text-xs text-white/40">Add photos to gallery</p>
          </Link>
          <Link
            href="/admin/blog?action=new"
            className="rounded-2xl border border-white/10 bg-white/4 p-5 transition-all hover:-translate-y-0.5 hover:border-white/15"
          >
            <FileText className="h-5 w-5 text-white/50" strokeWidth={1.6} />
            <p className="mt-3 text-sm font-semibold text-white">New Blog Post</p>
            <p className="mt-1 text-xs text-white/40">Write editorial content</p>
          </Link>
          <Link
            href="/admin/settings"
            className="rounded-2xl border border-white/10 bg-white/4 p-5 transition-all hover:-translate-y-0.5 hover:border-white/15"
          >
            <Settings className="h-5 w-5 text-white/50" strokeWidth={1.6} />
            <p className="mt-3 text-sm font-semibold text-white">Site Settings</p>
            <p className="mt-1 text-xs text-white/40">Configure website options</p>
          </Link>
        </div>
      </div>

      {/* System Info */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-white/80">System Info</h2>
        <div className="mt-4 rounded-2xl border border-white/8 bg-white/4 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/30">Platform</p>
              <p className="mt-1 text-sm text-white/60">Next.js + Sanity CMS</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-white/30">Auth</p>
              <p className="mt-1 text-sm text-white/60">Clerk Authentication</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-white/30">Storage</p>
              <p className="mt-1 text-sm text-white/60">Local JSON + Sanity CDN</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
