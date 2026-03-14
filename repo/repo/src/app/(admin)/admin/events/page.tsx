"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  CalendarDays,
  MapPin,
  Star,
  ChevronDown,
} from "lucide-react";
import type { AdminEvent } from "@/lib/admin-store";

type EventFormData = Omit<AdminEvent, "id" | "slug" | "createdAt" | "updatedAt">;

const EMPTY_FORM: EventFormData = {
  title: "",
  status: "upcoming",
  featured: false,
  date: "",
  time: "",
  venue: { name: "", address: "", city: "Melbourne", mapUrl: "" },
  description: "",
  tagline: "",
  ticketPrice: { from: 0, to: 0, currency: "AUD" },
  ticketUrl: "",
  artists: [],
  story: [],
  heroImage: "",
  accent: "gold",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function EventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<EventFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    const res = await fetch("/api/admin/events");
    const data = await res.json();
    setEvents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (event: AdminEvent) => {
    setEditing(event.id);
    setCreating(false);
    setForm({
      title: event.title,
      status: event.status,
      featured: event.featured,
      date: event.date.split("T")[0],
      time: event.time,
      venue: { ...event.venue },
      description: event.description,
      tagline: event.tagline ?? "",
      ticketPrice: event.ticketPrice ?? { from: 0, to: 0, currency: "AUD" },
      ticketUrl: event.ticketUrl ?? "",
      artists: [...event.artists],
      story: [...event.story],
      heroImage: event.heroImage ?? "",
      accent: event.accent,
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
        await fetch("/api/admin/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else if (editing) {
        await fetch(`/api/admin/events/${editing}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      cancel();
      await fetchEvents();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    await fetchEvents();
  };

  const updateField = <K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addArtist = () => {
    setForm((prev) => ({
      ...prev,
      artists: [...prev.artists, { name: "", role: "" }],
    }));
  };

  const removeArtist = (index: number) => {
    setForm((prev) => ({
      ...prev,
      artists: prev.artists.filter((_, i) => i !== index),
    }));
  };

  const updateArtist = (index: number, field: "name" | "role", value: string) => {
    setForm((prev) => ({
      ...prev,
      artists: prev.artists.map((a, i) =>
        i === index ? { ...a, [field]: value } : a
      ),
    }));
  };

  const showForm = creating || editing;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-white">Events</h1>
          <p className="mt-2 text-sm text-white/40">
            Create, edit, and manage upcoming and past events.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-5 py-2.5 text-sm font-medium text-[#0e0d10] transition-colors hover:bg-[#d4b75e]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New Event
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/4 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {creating ? "Create New Event" : "Edit Event"}
            </h2>
            <button onClick={cancel} className="rounded-lg p-2 text-white/40 hover:bg-white/8">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Event Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="e.g. Swaranirmiti 2026"
              />
            </div>

            {/* Status */}
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Status
              </label>
              <div className="relative">
                <select
                  value={form.status}
                  onChange={(e) =>
                    updateField("status", e.target.value as AdminEvent["status"])
                  }
                  className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                  <option value="draft">Draft</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              </div>
            </div>

            {/* Accent */}
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Accent Colour
              </label>
              <div className="relative">
                <select
                  value={form.accent}
                  onChange={(e) =>
                    updateField("accent", e.target.value as AdminEvent["accent"])
                  }
                  className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
                >
                  <option value="gold">Gold</option>
                  <option value="burgundy">Burgundy</option>
                  <option value="charcoal">Charcoal</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              </div>
            </div>

            {/* Date & Time */}
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Time
              </label>
              <input
                type="text"
                value={form.time}
                onChange={(e) => updateField("time", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="e.g. 6:30 PM AEST"
              />
            </div>

            {/* Venue */}
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Venue Name
              </label>
              <input
                type="text"
                value={form.venue.name}
                onChange={(e) =>
                  updateField("venue", { ...form.venue, name: e.target.value })
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="Melbourne Convention Centre"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Venue City
              </label>
              <input
                type="text"
                value={form.venue.city}
                onChange={(e) =>
                  updateField("venue", { ...form.venue, city: e.target.value })
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="Melbourne"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="A brief description of the event..."
              />
            </div>

            {/* Tagline */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Tagline
              </label>
              <input
                type="text"
                value={form.tagline}
                onChange={(e) => updateField("tagline", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="A short tagline for the event"
              />
            </div>

            {/* Ticket Price */}
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Price From ($)
              </label>
              <input
                type="number"
                value={form.ticketPrice?.from ?? 0}
                onChange={(e) =>
                  updateField("ticketPrice", {
                    ...form.ticketPrice!,
                    from: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Price To ($)
              </label>
              <input
                type="number"
                value={form.ticketPrice?.to ?? 0}
                onChange={(e) =>
                  updateField("ticketPrice", {
                    ...form.ticketPrice!,
                    to: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              />
            </div>

            {/* Featured */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => updateField("featured", e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#c9a84c] accent-[#c9a84c]"
                />
                <span className="text-sm text-white/60">Featured event (shown prominently on homepage)</span>
              </label>
            </div>

            {/* Hero Image */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Hero Image Path
              </label>
              <input
                type="text"
                value={form.heroImage}
                onChange={(e) => updateField("heroImage", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="/images/events/event-poster-1.jpg"
              />
            </div>

            {/* Artists */}
            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs uppercase tracking-widest text-white/40">
                  Artists
                </label>
                <button
                  type="button"
                  onClick={addArtist}
                  className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs text-[#c9a84c] hover:bg-[#c9a84c]/10"
                >
                  <Plus className="h-3 w-3" /> Add Artist
                </button>
              </div>
              <div className="space-y-2">
                {form.artists.map((artist, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={artist.name}
                      onChange={(e) => updateArtist(i, "name", e.target.value)}
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none"
                      placeholder="Artist name"
                    />
                    <input
                      type="text"
                      value={artist.role}
                      onChange={(e) => updateArtist(i, "role", e.target.value)}
                      className="w-40 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none"
                      placeholder="Role"
                    />
                    <button
                      onClick={() => removeArtist(i)}
                      className="rounded-lg p-2 text-red-400/60 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !form.title}
              className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-6 py-2.5 text-sm font-medium text-[#0e0d10] transition-colors hover:bg-[#d4b75e] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : creating ? "Create Event" : "Save Changes"}
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

      {/* Events List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-white/8 bg-white/4"
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No events yet. Create your first event above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className={cn(
                "group flex items-center gap-5 rounded-2xl border p-5 transition-all duration-200 hover:border-white/15",
                editing === event.id
                  ? "border-[#c9a84c]/25 bg-[#c9a84c]/5"
                  : "border-white/8 bg-white/4"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="font-serif text-lg text-white">{event.title}</h3>
                  {event.featured && (
                    <Star className="h-3.5 w-3.5 fill-[#c9a84c] text-[#c9a84c]" />
                  )}
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[0.6rem] uppercase tracking-widest",
                      event.status === "upcoming"
                        ? "bg-green-500/12 text-green-400"
                        : event.status === "draft"
                        ? "bg-yellow-500/12 text-yellow-400"
                        : "bg-white/8 text-white/40"
                    )}
                  >
                    {event.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3 w-3" />
                    {new Date(event.date).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" />
                    {event.venue.name}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 opacity-50 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => startEdit(event)}
                  className="rounded-lg p-2 text-white/50 hover:bg-white/8 hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(event.id)}
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
