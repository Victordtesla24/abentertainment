"use client";

import { useEffect, useState, useCallback } from "react";
import { Save, Settings, Globe, Mail, Share2, AlertTriangle } from "lucide-react";
import type { AdminSiteSettings } from "@/lib/admin-store";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AdminSiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    setSettings(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/8" />
          <div className="mt-3 h-4 w-80 animate-pulse rounded-lg bg-white/5" />
        </div>
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-white/8 bg-white/4" />
          ))}
        </div>
      </div>
    );
  }

  const update = (field: keyof AdminSiteSettings, value: string | boolean) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-white">Site Settings</h1>
          <p className="mt-2 text-sm text-white/40">
            Configure website-wide settings, contact info, and social links.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-6 py-2.5 text-sm font-medium text-[#0e0d10] transition-colors hover:bg-[#d4b75e] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
        </button>
      </div>

      <div className="space-y-6">
        {/* General */}
        <section className="rounded-2xl border border-white/10 bg-white/4 p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c9a84c]/10">
              <Globe className="h-4 w-4 text-[#c9a84c]" />
            </div>
            <h2 className="text-lg font-semibold text-white">General</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Site Name
              </label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => update("siteName", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Tagline
              </label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) => update("tagline", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Description
              </label>
              <textarea
                value={settings.description}
                onChange={(e) => update("description", e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Footer Text
              </label>
              <input
                type="text"
                value={settings.footerText}
                onChange={(e) => update("footerText", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              />
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-2xl border border-white/10 bg-white/4 p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c9a84c]/10">
              <Mail className="h-4 w-4 text-[#c9a84c]" />
            </div>
            <h2 className="text-lg font-semibold text-white">Contact Information</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Email
              </label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Phone
              </label>
              <input
                type="text"
                value={settings.contactPhone}
                onChange={(e) => update("contactPhone", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              />
            </div>
          </div>
        </section>

        {/* Social */}
        <section className="rounded-2xl border border-white/10 bg-white/4 p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c9a84c]/10">
              <Share2 className="h-4 w-4 text-[#c9a84c]" />
            </div>
            <h2 className="text-lg font-semibold text-white">Social Media</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Instagram
              </label>
              <input
                type="text"
                value={settings.socialInstagram}
                onChange={(e) => update("socialInstagram", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Facebook
              </label>
              <input
                type="text"
                value={settings.socialFacebook}
                onChange={(e) => update("socialFacebook", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                YouTube
              </label>
              <input
                type="text"
                value={settings.socialYoutube}
                onChange={(e) => update("socialYoutube", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              />
            </div>
          </div>
        </section>

        {/* Maintenance Mode */}
        <section className="rounded-2xl border border-white/10 bg-white/4 p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Advanced</h2>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/3 p-4">
            <div>
              <p className="text-sm font-medium text-white">Maintenance Mode</p>
              <p className="mt-0.5 text-xs text-white/40">
                When enabled, visitors will see a maintenance page instead of the website.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) => update("maintenanceMode", e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white/40 after:transition-all peer-checked:bg-red-500/30 peer-checked:after:translate-x-full peer-checked:after:bg-red-400" />
            </label>
          </div>
        </section>

        {/* Last Updated */}
        <p className="text-center text-xs text-white/20">
          Last updated: {new Date(settings.updatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
