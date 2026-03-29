'use client';
import { getApiUrl } from '@/lib/api-config';

import { useState, FormEvent } from 'react';
import type { Event } from '@/lib/data';

interface EventsManagerProps {
  initialEvents: Event[];
}

const EMPTY_EVENT: Omit<Event, 'id' | 'createdAt' | 'updatedAt'> = {
  title: '',
  slug: '',
  date: '',
  venue: '',
  description: '',
  longDescription: '',
  price: 0,
  currency: 'AUD',
  status: 'upcoming',
  image: '',
  category: '',
  capacity: 0,
  ticketUrl: '',
};

export default function EventsManager({ initialEvents }: EventsManagerProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [editing, setEditing] = useState<Event | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_EVENT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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
      price: event.price,
      currency: event.currency,
      status: event.status,
      image: event.image,
      category: event.category,
      capacity: event.capacity || 0,
      ticketUrl: event.ticketUrl || '',
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

      const res = await fetch(getApiUrl('/api/admin/events'), {
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
      const res = await fetch(getApiUrl('/api/admin/events'), {
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

  const showForm = creating || editing;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-display font-bold text-white">Events</h2>
        <button
          onClick={startCreate}
          className="px-4 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors"
        >
          + New Event
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-sm text-sm ${
          message.startsWith('Error') ? 'bg-red-400/10 text-red-400 border border-red-400/20' : 'bg-[#1BBFA1]/10 text-[#1BBFA1] border border-[#1BBFA1]/20'
        }`}>
          {message}
        </div>
      )}

      {showForm && (
        <div className="mb-8 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">
            {creating ? 'Create Event' : `Edit: ${editing!.title}`}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[white/40] mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-xs text-[white/40] mb-1">Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                required
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-xs text-[white/40] mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-xs text-[white/40] mb-1">Venue</label>
              <input
                type="text"
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                required
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-[white/40] mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                rows={3}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-[white/40] mb-1">Price (AUD)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                min={0}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-xs text-[white/40] mb-1">Category</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-xs text-[white/40] mb-1">Status</label>
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
              <label className="block text-xs text-[white/40] mb-1">Image URL</label>
              <input
                type="text"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
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
                className="px-6 py-2 border border-[white/40]/30 text-[white/40] text-sm rounded-sm hover:text-white hover:border-white/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Events Table */}
      <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#C9A84C]/20">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Title</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Category</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-[#C9A84C]/10 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-sm text-white font-medium">{event.title}</td>
                <td className="px-4 py-3 text-sm text-[white/40]">{event.date}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-sm ${
                    event.status === 'upcoming' ? 'bg-[#1BBFA1]/20 text-[#1BBFA1]' :
                    event.status === 'live' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' :
                    'bg-[white/40]/20 text-[white/40]'
                  }`}>
                    {event.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[white/40]">{event.category}</td>
                <td className="px-4 py-3 text-right">
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
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[white/40] text-sm">
                  No events yet. Click &quot;+ New Event&quot; to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
