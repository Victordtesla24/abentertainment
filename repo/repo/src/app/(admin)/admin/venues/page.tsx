"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Save, X, MapPin, Users } from "lucide-react";
import type { AdminVenue } from "@/lib/admin-store";

type VenueFormData = Omit<AdminVenue, "id" | "createdAt" | "updatedAt">;

const EMPTY_FORM: VenueFormData = {
  name: "",
  address: "",
  city: "Melbourne",
  capacity: undefined,
  mapUrl: "",
  description: "",
};

export default function VenuesPage() {
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<VenueFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchVenues = useCallback(async () => {
    const res = await fetch("/api/admin/venues");
    const data = await res.json();
    setVenues(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (venue: AdminVenue) => {
    setEditing(venue.id);
    setCreating(false);
    setForm({
      name: venue.name,
      address: venue.address,
      city: venue.city,
      capacity: venue.capacity,
      mapUrl: venue.mapUrl ?? "",
      description: venue.description ?? "",
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
        await fetch("/api/admin/venues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else if (editing) {
        await fetch(`/api/admin/venues/${editing}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      cancel();
      await fetchVenues();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this venue?")) return;
    await fetch(`/api/admin/venues/${id}`, { method: "DELETE" });
    await fetchVenues();
  };

  const showForm = creating || editing;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-white">Venues</h1>
          <p className="mt-2 text-sm text-white/40">
            Manage venue information for events.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-5 py-2.5 text-sm font-medium text-[#0e0d10] transition-colors hover:bg-[#d4b75e]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add Venue
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/4 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {creating ? "Add New Venue" : "Edit Venue"}
            </h2>
            <button onClick={cancel} className="rounded-lg p-2 text-white/40 hover:bg-white/8">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Venue Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="Melbourne Convention Centre"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Address
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="1 Convention Centre Place, South Wharf VIC 3006"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                City
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="Melbourne"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Capacity
              </label>
              <input
                type="number"
                value={form.capacity ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    capacity: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="5000"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Google Maps URL
              </label>
              <input
                type="text"
                value={form.mapUrl}
                onChange={(e) => setForm((p) => ({ ...p, mapUrl: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="https://www.google.com/maps/..."
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
                placeholder="A brief description of the venue..."
              />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-6 py-2.5 text-sm font-medium text-[#0e0d10] transition-colors hover:bg-[#d4b75e] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : creating ? "Add Venue" : "Save Changes"}
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

      {/* Venues List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/8 bg-white/4" />
          ))}
        </div>
      ) : venues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
          <MapPin className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No venues registered yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className="group rounded-2xl border border-white/8 bg-white/4 p-5 transition-all duration-200 hover:border-white/15"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif text-lg text-white">{venue.name}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-white/40">
                    <MapPin className="h-3 w-3" />
                    {venue.address}
                  </p>
                  <div className="mt-3 flex items-center gap-4">
                    <span className="text-xs text-white/30">{venue.city}</span>
                    {venue.capacity && (
                      <span className="flex items-center gap-1 text-xs text-white/30">
                        <Users className="h-3 w-3" />
                        {venue.capacity.toLocaleString()} capacity
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 opacity-50 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => startEdit(venue)}
                    className="rounded-lg p-2 text-white/50 hover:bg-white/8 hover:text-white"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(venue.id)}
                    className="rounded-lg p-2 text-red-400/50 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
