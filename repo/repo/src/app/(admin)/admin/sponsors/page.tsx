"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Save, X, Award, ExternalLink } from "lucide-react";
import type { AdminSponsor } from "@/lib/admin-store";

type SponsorFormData = Omit<AdminSponsor, "id" | "createdAt" | "updatedAt">;

const EMPTY_FORM: SponsorFormData = {
  name: "",
  tier: "gold",
  logoUrl: "",
  websiteUrl: "",
  description: "",
  active: true,
};

const TIERS = [
  { value: "title", label: "Title Sponsor", color: "text-[#c9a84c]" },
  { value: "gold", label: "Gold", color: "text-[#d4b75e]" },
  { value: "silver", label: "Silver", color: "text-white/60" },
  { value: "community", label: "Community", color: "text-white/40" },
] as const;

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<AdminSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<SponsorFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchSponsors = useCallback(async () => {
    const res = await fetch("/api/admin/sponsors");
    const data = await res.json();
    setSponsors(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSponsors();
  }, [fetchSponsors]);

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (sponsor: AdminSponsor) => {
    setEditing(sponsor.id);
    setCreating(false);
    setForm({
      name: sponsor.name,
      tier: sponsor.tier,
      logoUrl: sponsor.logoUrl ?? "",
      websiteUrl: sponsor.websiteUrl ?? "",
      description: sponsor.description ?? "",
      active: sponsor.active,
    });
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (creating) {
        await fetch("/api/admin/sponsors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else if (editing) {
        await fetch(`/api/admin/sponsors/${editing}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      cancel();
      await fetchSponsors();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this sponsor?")) return;
    await fetch(`/api/admin/sponsors/${id}`, { method: "DELETE" });
    await fetchSponsors();
  };

  const showForm = creating || editing;

  const tierLabel = (tier: string) =>
    TIERS.find((t) => t.value === tier)?.label ?? tier;
  const tierColor = (tier: string) =>
    TIERS.find((t) => t.value === tier)?.color ?? "text-white/40";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-white">Sponsors</h1>
          <p className="mt-2 text-sm text-white/40">
            Manage event sponsors and partnership tiers.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-5 py-2.5 text-sm font-medium text-[#0e0d10] transition-colors hover:bg-[#d4b75e]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add Sponsor
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/4 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {creating ? "Add New Sponsor" : "Edit Sponsor"}
            </h2>
            <button onClick={cancel} className="rounded-lg p-2 text-white/40 hover:bg-white/8">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Sponsor Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="Company Name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Tier
              </label>
              <select
                value={form.tier}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    tier: e.target.value as SponsorFormData["tier"],
                  }))
                }
                className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              >
                {TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Logo URL
              </label>
              <input
                type="text"
                value={form.logoUrl}
                onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="/images/sponsors/logo.png"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Website URL
              </label>
              <input
                type="text"
                value={form.websiteUrl}
                onChange={(e) => setForm((p) => ({ ...p, websiteUrl: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="https://sponsor.com"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="Brief description of the sponsorship..."
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white/40 after:transition-all peer-checked:bg-[#c9a84c]/30 peer-checked:after:translate-x-full peer-checked:after:bg-[#c9a84c]" />
              </label>
              <span className="text-sm text-white/50">Active</span>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-6 py-2.5 text-sm font-medium text-[#0e0d10] transition-colors hover:bg-[#d4b75e] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : creating ? "Add Sponsor" : "Save Changes"}
            </button>
            <button
              onClick={cancel}
              className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white/50 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/8 bg-white/4" />
          ))}
        </div>
      ) : sponsors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
          <Award className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No sponsors registered yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-white/4 p-5 transition-all duration-200 hover:border-white/15"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#c9a84c]/15 bg-[#c9a84c]/8">
                <Award className={`h-5 w-5 ${tierColor(sponsor.tier)}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-lg text-white">{sponsor.name}</h3>
                  {!sponsor.active && (
                    <span className="rounded-full bg-white/8 px-2 py-0.5 text-[0.6rem] text-white/30">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <span className={`text-xs font-medium ${tierColor(sponsor.tier)}`}>
                    {tierLabel(sponsor.tier)}
                  </span>
                  {sponsor.websiteUrl && (
                    <a
                      href={sponsor.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60"
                    >
                      <ExternalLink className="h-3 w-3" /> Website
                    </a>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 opacity-50 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => startEdit(sponsor)}
                  className="rounded-lg p-2 text-white/50 hover:bg-white/8 hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(sponsor.id)}
                  className="rounded-lg p-2 text-red-400/50 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
