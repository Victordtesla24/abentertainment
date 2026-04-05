'use client';
import React from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { uploadFile } from '@/lib/upload-helper';

import { useState, useRef, useEffect, useCallback, FormEvent, useMemo } from 'react';
import type { Event, GalleryImage, Sponsor } from '@/lib/data';

interface EventsManagerProps {
  initialEvents: Event[];
  allSponsors?: Sponsor[];
}

const EMPTY_EVENT: Omit<Event, 'id' | 'createdAt' | 'updatedAt'> = {
  title: '',
  slug: '',
  date: '',
  venue: '',
  description: '',
  longDescription: '',
  hook: '',
  cast: '',
  price: 0,
  currency: 'AUD',
  status: 'upcoming',
  ticketStatus: 'available',
  image: '',
  heroImage: '',
  category: '',
  capacity: 0,
  ticketUrl: '',
  videoUrl: '',
  featuredVideo: '',
  ticketsSold: 0,
  ticketRevenue: 0,
  order: 0,
};

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function EventsManager({ initialEvents, allSponsors = [] }: EventsManagerProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [editing, setEditing] = useState<Event | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_EVENT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [eventImages, setEventImages] = useState<Record<string, GalleryImage[]>>({});
  const [addingImageToEvent, setAddingImageToEvent] = useState<string | null>(null);
  const [newImageSrc, setNewImageSrc] = useState('');
  const [newImageAlt, setNewImageAlt] = useState('');

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [events]);

  const revenueSummary = useMemo(() => {
    const totalEvents = events.length;
    const totalTicketsSold = events.reduce((sum, ev) => sum + (ev.ticketsSold ?? 0), 0);
    const totalRevenue = events.reduce((sum, ev) => sum + (ev.ticketRevenue ?? 0), 0);
    const upcoming = events.filter((ev) => ev.status === 'upcoming' || ev.status === 'live').length;
    const past = events.filter((ev) => ev.status === 'past').length;
    return { totalEvents, totalTicketsSold, totalRevenue, upcoming, past };
  }, [events]);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollWidth - el.scrollLeft - el.clientWidth > 1);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, events]);

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setForm(EMPTY_EVENT);
  }

  function startEdit(event: Event) {
    setCreating(false);
    setEditing(event);
    setForm({
      title: event.title,
      slug: event.slug,
      date: event.date,
      venue: event.venue,
      description: event.description,
      longDescription: event.longDescription || '',
      hook: event.hook || '',
      cast: event.cast || '',
      price: event.price,
      currency: event.currency,
      status: event.status,
      ticketStatus: event.ticketStatus,
      image: event.image,
      heroImage: event.heroImage || '',
      category: event.category,
      capacity: event.capacity || 0,
      ticketUrl: event.ticketUrl || '',
      videoUrl: event.videoUrl || '',
      featuredVideo: event.featuredVideo || '',
      ticketsSold: event.ticketsSold || 0,
      ticketRevenue: event.ticketRevenue || 0,
      order: event.order || 0,
    });
  }

  function cancelForm() {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY_EVENT);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const method = creating ? 'POST' : 'PUT';
      const body = creating
        ? form
        : { ...form, id: editing!.id };

      const res = await adminFetch('/api/admin/events', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save event');

      const data = await res.json();
      if (creating) {
        setEvents((prev) => [...prev, data.event]);
      } else {
        setEvents((prev) =>
          prev.map((ev) => (ev.id === data.event.id ? data.event : ev))
        );
      }

      cancelForm();
      setMessage(creating ? 'Event created' : 'Event updated');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const res = await adminFetch('/api/admin/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Failed to delete');
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
      setMessage('Event deleted');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleMoveUp(event: Event) {
    const sorted = [...events].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = sorted.findIndex((ev) => ev.id === event.id);
    if (idx <= 0) return;

    const above = sorted[idx - 1];
    const currentOrder = event.order ?? 0;
    const aboveOrder = above.order ?? 0;

    try {
      const [res1, res2] = await Promise.all([
        adminFetch('/api/admin/events', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: event.id, order: aboveOrder }),
        }),
        adminFetch('/api/admin/events', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: above.id, order: currentOrder }),
        }),
      ]);

      if (!res1.ok || !res2.ok) throw new Error('Failed to reorder');

      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id === event.id) return { ...ev, order: aboveOrder };
          if (ev.id === above.id) return { ...ev, order: currentOrder };
          return ev;
        })
      );
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Failed to reorder'}`);
    }
  }

  async function handleMoveDown(event: Event) {
    const sorted = [...events].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = sorted.findIndex((ev) => ev.id === event.id);
    if (idx < 0 || idx >= sorted.length - 1) return;

    const below = sorted[idx + 1];
    const currentOrder = event.order ?? 0;
    const belowOrder = below.order ?? 0;

    try {
      const [res1, res2] = await Promise.all([
        adminFetch('/api/admin/events', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: event.id, order: belowOrder }),
        }),
        adminFetch('/api/admin/events', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: below.id, order: currentOrder }),
        }),
      ]);

      if (!res1.ok || !res2.ok) throw new Error('Failed to reorder');

      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id === event.id) return { ...ev, order: belowOrder };
          if (ev.id === below.id) return { ...ev, order: currentOrder };
          return ev;
        })
      );
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Failed to reorder'}`);
    }
  }

  async function fetchEventImages(eventId: string) {
    try {
      const res = await adminFetch(`/api/admin/gallery?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setEventImages(prev => ({ ...prev, [eventId]: data.images || [] }));
      }
    } catch { /* silent */ }
  }

  function toggleEventImages(eventId: string) {
    if (expandedEventId === eventId) {
      setExpandedEventId(null);
    } else {
      setExpandedEventId(eventId);
      if (!eventImages[eventId]) fetchEventImages(eventId);
    }
  }

  async function handleAddEventImage(eventId: string) {
    if (!newImageSrc.trim()) return;
    try {
      const res = await adminFetch('/api/admin/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ src: newImageSrc, alt: newImageAlt || 'Event image', category: 'event', eventId, width: 1200, height: 800 }),
      });
      if (res.ok) {
        const data = await res.json();
        setEventImages(prev => ({ ...prev, [eventId]: [...(prev[eventId] || []), data.image] }));
        setNewImageSrc('');
        setNewImageAlt('');
        setAddingImageToEvent(null);
      }
    } catch { setMessage('Error: Failed to add image'); }
  }

  async function handleDeleteEventImage(imageId: string, eventId: string) {
    if (!confirm('Delete this image?')) return;
    try {
      const res = await adminFetch('/api/admin/gallery', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: imageId }),
      });
      if (res.ok) {
        setEventImages(prev => ({ ...prev, [eventId]: (prev[eventId] || []).filter(img => img.id !== imageId) }));
      }
    } catch { setMessage('Error: Failed to delete image'); }
  }

  async function handleUnlinkSponsor(eventId: string, sponsorId: string) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const updatedIds = (event.sponsorIds || []).filter(id => id !== sponsorId);
    try {
      const res = await adminFetch('/api/admin/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId, sponsorIds: updatedIds }),
      });
      if (res.ok) {
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, sponsorIds: updatedIds } : e));
      }
    } catch { setMessage('Error: Failed to unlink sponsor'); }
  }

  function handleExportCsv() {
    const headers = ['id', 'title', 'slug', 'date', 'venue', 'description', 'longDescription', 'hook', 'cast', 'price', 'currency', 'status', 'ticketStatus', 'image', 'category', 'capacity', 'ticketUrl', 'videoUrl', 'featuredVideo', 'ticketsSold', 'ticketRevenue', 'order'];
    const rows = events.map((ev) => headers.map(h => {
      const val = ev[h as keyof Event];
      return escapeCsvField(String(val ?? ''));
    }));

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const today = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-export-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleExportJson() {
    const data = {
      exportDate: new Date().toISOString(),
      events: events.map(ev => ({
        ...ev,
        galleryImages: eventImages[ev.id] || [],
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-full-export-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const showForm = creating || editing;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-display font-bold text-white">Events</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="px-4 py-2 border border-[#C9A84C]/40 text-[#C9A84C] text-sm font-semibold rounded-sm hover:bg-[#C9A84C]/10 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={handleExportJson}
            className="px-4 py-2 border border-[#C9A84C]/40 text-[#C9A84C] text-sm font-semibold rounded-sm hover:bg-[#C9A84C]/10 transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors"
          >
            + New Event
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-sm text-sm ${
          message.startsWith('Error') ? 'bg-red-400/10 text-red-400 border border-red-400/20' : 'bg-[#1BBFA1]/10 text-[#1BBFA1] border border-[#1BBFA1]/20'
        }`}>
          {message}
        </div>
      )}

      {/* Revenue Summary Bar */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Events</p>
          <p className="text-xl font-display font-bold text-white">{revenueSummary.totalEvents}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Tickets Sold</p>
          <p className="text-xl font-display font-bold text-[#C9A84C]">{revenueSummary.totalTicketsSold.toLocaleString()}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Revenue</p>
          <p className="text-xl font-display font-bold text-[#1BBFA1]">${revenueSummary.totalRevenue.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Upcoming / Live</p>
          <p className="text-xl font-display font-bold text-[#1BBFA1]">{revenueSummary.upcoming}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Past</p>
          <p className="text-xl font-display font-bold text-white/40">{revenueSummary.past}</p>
        </div>
      </div>

      {showForm && (
        <div className="mb-8 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">
            {creating ? 'Create Event' : `Edit: ${editing!.title}`}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                required
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Venue</label>
              <input
                type="text"
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                required
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-white/40 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                rows={3}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] resize-none"
              />
              <p className="text-[9px] text-[#C9A84C]/40 mt-1 font-body">Tip: Use structured fields below for better formatting.</p>
            </div>
            {/* Structured content fields — Hook / Details / Cast */}
            <div className="md:col-span-2">
              <label className="block text-xs text-white/40 mb-1">Event Hook / One-liner</label>
              <input
                type="text"
                maxLength={120}
                value={form.hook}
                onChange={(e) => setForm({ ...form, hook: e.target.value })}
                placeholder="A compelling one-liner for the event (max 120 chars)"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] placeholder-white/20"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-white/40 mb-1">Full Description</label>
              <textarea
                rows={4}
                value={form.longDescription}
                onChange={(e) => setForm({ ...form, longDescription: e.target.value })}
                placeholder="Detailed event description for the event page"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] resize-none placeholder-white/20"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-white/40 mb-1">Cast / Performers</label>
              <textarea
                rows={3}
                value={form.cast}
                onChange={(e) => setForm({ ...form, cast: e.target.value })}
                placeholder="List the cast and performers for this event"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] resize-none placeholder-white/20"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Price (AUD)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                min={0}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Category</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Event['status'] })}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              >
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="past">Past</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Ticket Status</label>
              <select
                value={form.ticketStatus}
                onChange={(e) => setForm({ ...form, ticketStatus: e.target.value as Event['ticketStatus'] })}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              >
                <option value="available">Available</option>
                <option value="selling_fast">Selling Fast</option>
                <option value="sold_out">Sold Out</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Main Image URL <span className="text-white/25">(event cards & gallery folder cover)</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  className="flex-1 px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                />
                <input
                  type="file"
                  id="event-image-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const result = await uploadFile(file, 'events');
                      setForm((prev) => ({ ...prev, image: result.url }));
                    } catch (err) {
                      setMessage(`Error: ${err instanceof Error ? err.message : 'Upload failed'}`);
                    } finally {
                      setUploading(false);
                      e.target.value = '';
                    }
                  }}
                />
                <label
                  htmlFor="event-image-upload"
                  className="text-[11px] font-body px-3 py-1.5 bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20 hover:bg-[#C9A84C]/20 transition-colors cursor-pointer whitespace-nowrap flex items-center rounded-sm"
                >
                  {uploading ? 'Uploading...' : 'Upload File'}
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Hero Image URL <span className="text-white/25">(large banner on event detail page — falls back to Main Image)</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.heroImage || ''}
                  onChange={(e) => setForm({ ...form, heroImage: e.target.value })}
                  placeholder="(optional — leave blank to reuse the Main Image)"
                  className="flex-1 px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] placeholder-white/20"
                />
                <input
                  type="file"
                  id="event-hero-image-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const result = await uploadFile(file, 'events');
                      setForm((prev) => ({ ...prev, heroImage: result.url }));
                    } catch (err) {
                      setMessage(`Error: ${err instanceof Error ? err.message : 'Upload failed'}`);
                    } finally {
                      setUploading(false);
                      e.target.value = '';
                    }
                  }}
                />
                <label
                  htmlFor="event-hero-image-upload"
                  className="text-[11px] font-body px-3 py-1.5 bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20 hover:bg-[#C9A84C]/20 transition-colors cursor-pointer whitespace-nowrap flex items-center rounded-sm"
                >
                  {uploading ? 'Uploading...' : 'Upload File'}
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Ticket URL</label>
              <input
                type="text"
                value={form.ticketUrl}
                onChange={(e) => setForm({ ...form, ticketUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] placeholder-white/20"
              />
            </div>
            {/* Ticket Sales & Video Fields */}
            <div>
              <label className="block text-xs text-white/40 mb-1">Tickets Sold</label>
              <input
                type="number"
                value={form.ticketsSold}
                onChange={(e) => setForm({ ...form, ticketsSold: Number(e.target.value) })}
                min={0}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Ticket Revenue (AUD)</label>
              <input
                type="number"
                value={form.ticketRevenue}
                onChange={(e) => setForm({ ...form, ticketRevenue: Number(e.target.value) })}
                min={0}
                step="0.01"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Promo Video URL</label>
              <input
                type="text"
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                placeholder="https://youtube.com/..."
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] placeholder-white/20"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Featured Video URL</label>
              <input
                type="text"
                value={form.featuredVideo}
                onChange={(e) => setForm({ ...form, featuredVideo: e.target.value })}
                placeholder="https://youtube.com/..."
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] placeholder-white/20"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Display Order</label>
              <input
                type="number"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : creating ? 'Create Event' : 'Update Event'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="px-6 py-2 border border-white/30 text-white/40 text-sm rounded-sm hover:text-white hover:border-white/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Events Table */}
      <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm overflow-hidden relative">
        <div ref={scrollContainerRef} className="overflow-x-auto" role="region" aria-label="Events table">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-[#C9A84C]/20">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Order</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Title</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Category</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedEvents.map((event, idx) => (
              <React.Fragment key={event.id}>
              <tr className="border-b border-[#C9A84C]/10 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveUp(event)}
                      disabled={idx === 0}
                      className="text-xs text-[#C9A84C] hover:text-[#D4B65C] disabled:text-white/10 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      &#9650;
                    </button>
                    <button
                      onClick={() => handleMoveDown(event)}
                      disabled={idx === sortedEvents.length - 1}
                      className="text-xs text-[#C9A84C] hover:text-[#D4B65C] disabled:text-white/10 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      &#9660;
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-white font-medium">{event.title}</td>
                <td className="px-4 py-3 text-sm text-white/40">{event.date}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-sm ${
                    event.status === 'upcoming' ? 'bg-[#1BBFA1]/20 text-[#1BBFA1]' :
                    event.status === 'live' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' :
                    'bg-white/20 text-white/40'
                  }`}>
                    {event.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-white/40">{event.category}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleEventImages(event.id)}
                    className="text-xs text-[#C9A84C] hover:text-[#C9A84C]/80 mr-3"
                  >
                    Images
                  </button>
                  <button
                    onClick={() => startEdit(event)}
                    className="text-xs text-[#1BBFA1] hover:text-[#1BBFA1]/80 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
              {expandedEventId === event.id && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 bg-[#111111]">
                    {/* Linked Sponsors */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-[#C9A84C]">Linked Sponsors</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(event.sponsorIds || []).length === 0 && (
                          <p className="text-white/30 text-xs">No sponsors linked. Use the Sponsors tab to manage sponsor associations.</p>
                        )}
                        {(event.sponsorIds || []).map(sid => {
                          const sponsor = allSponsors.find(s => s.id === sid);
                          return sponsor ? (
                            <span key={sid} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] text-[10px] rounded-sm">
                              {sponsor.name}
                              <button onClick={() => handleUnlinkSponsor(event.id, sid)} className="text-white/30 hover:text-red-400 ml-1">&times;</button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-[#C9A84C]">Event Images</h4>
                        <button onClick={() => setAddingImageToEvent(event.id)} className="text-xs px-3 py-1 bg-[#C9A84C] text-white rounded-sm hover:bg-[#D4B65C]">
                          + Add Image
                        </button>
                      </div>
                      {/* Add image form */}
                      {addingImageToEvent === event.id && (
                        <div className="flex gap-2">
                          <input type="text" value={newImageSrc} onChange={e => setNewImageSrc(e.target.value)} placeholder="Image URL" className="flex-1 px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm" />
                          <input type="text" value={newImageAlt} onChange={e => setNewImageAlt(e.target.value)} placeholder="Alt text" className="flex-1 px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm" />
                          <button onClick={() => handleAddEventImage(event.id)} className="px-3 py-2 bg-[#C9A84C] text-white text-sm rounded-sm">Add</button>
                          <button onClick={() => { setAddingImageToEvent(null); setNewImageSrc(''); setNewImageAlt(''); }} className="px-3 py-2 border border-white/20 text-white/40 text-sm rounded-sm">Cancel</button>
                        </div>
                      )}
                      {/* Image grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {(eventImages[event.id] || []).map((img) => (
                          <div key={img.id} className="bg-[#0A0A0A] border border-white/10 overflow-hidden">
                            <div className="aspect-[4/3] bg-[#0A0A0A]">
                              <img src={img.src} alt={img.alt} className="w-full h-full object-cover" loading="lazy" />
                            </div>
                            <div className="p-2 flex items-center justify-between">
                              <span className="text-[10px] text-white/40 truncate">{img.alt}</span>
                              <div className="flex gap-1">
                                <button onClick={() => handleDeleteEventImage(img.id, event.id)} className="text-[9px] text-red-400 hover:text-red-300">Del</button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(eventImages[event.id] || []).length === 0 && (
                          <p className="col-span-full text-center text-white/30 text-xs py-4">No images for this event</p>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/40 text-sm">
                  No events yet. Click &quot;+ New Event&quot; to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        {canScrollRight && (
          <div
            className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none bg-gradient-to-l from-[#0A0A0A] to-transparent"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
