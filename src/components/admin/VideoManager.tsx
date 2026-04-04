'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useState, useMemo, useRef, useEffect, useCallback, FormEvent } from 'react';
import type { Video, Event } from '@/lib/data';

interface VideoManagerProps {
  initialVideos: Video[];
  events?: Event[];
}

const EMPTY_VIDEO: Omit<Video, 'id' | 'createdAt' | 'updatedAt'> = {
  title: '',
  url: '',
  type: 'promo',
  eventId: '',
  thumbnail: '',
  featured: false,
  order: 0,
};

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function VideoManager({ initialVideos, events = [] }: VideoManagerProps) {
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [editing, setEditing] = useState<Video | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_VIDEO);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Inline title edit state
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const sortedVideos = useMemo(() => {
    return [...videos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [videos]);

  const summary = useMemo(() => {
    const total = videos.length;
    const featured = videos.filter((v) => v.featured).length;
    const promo = videos.filter((v) => v.type === 'promo').length;
    const eventVids = videos.filter((v) => v.type === 'event').length;
    const featuredType = videos.filter((v) => v.type === 'featured').length;
    return { total, featured, promo, eventVids, featuredType };
  }, [videos]);

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
  }, [checkScroll, videos]);

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setForm(EMPTY_VIDEO);
  }

  function startEdit(video: Video) {
    setCreating(false);
    setEditing(video);
    setForm({
      title: video.title,
      url: video.url,
      type: video.type,
      eventId: video.eventId || '',
      thumbnail: video.thumbnail || '',
      featured: video.featured,
      order: video.order,
    });
  }

  function cancelForm() {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY_VIDEO);
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

      const res = await adminFetch('/api/admin/videos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save video');

      const data = await res.json();
      if (creating) {
        setVideos((prev) => [...prev, data.video]);
      } else {
        setVideos((prev) =>
          prev.map((v) => (v.id === data.video.id ? data.video : v))
        );
      }

      cancelForm();
      showMessage(creating ? 'Video created' : 'Video updated');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this video?')) return;

    try {
      const res = await adminFetch('/api/admin/videos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Failed to delete');
      setVideos((prev) => prev.filter((v) => v.id !== id));
      showMessage('Video deleted');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // --- Toggle Featured ---
  async function handleToggleFeatured(video: Video) {
    const newFeatured = !video.featured;
    try {
      const res = await adminFetch('/api/admin/videos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: video.id, featured: newFeatured }),
      });

      if (!res.ok) throw new Error('Failed to toggle featured');

      const data = await res.json();
      setVideos((prev) =>
        prev.map((v) => (v.id === data.video.id ? data.video : v))
      );
      showMessage(newFeatured ? 'Video marked as featured' : 'Video unfeatured');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // --- Inline Title Edit ---
  function startTitleEdit(video: Video) {
    setEditingTitleId(video.id);
    setEditTitle(video.title);
  }

  async function saveTitleEdit(id: string) {
    if (!editTitle.trim()) {
      setEditingTitleId(null);
      return;
    }

    try {
      const res = await adminFetch('/api/admin/videos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: editTitle }),
      });

      if (!res.ok) throw new Error('Failed to rename');

      const data = await res.json();
      setVideos((prev) =>
        prev.map((v) => (v.id === data.video.id ? data.video : v))
      );
      setEditingTitleId(null);
      showMessage('Video renamed');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setEditingTitleId(null);
    }
  }

  // --- Reorder ---
  async function handleMoveUp(video: Video) {
    const sorted = [...videos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = sorted.findIndex((v) => v.id === video.id);
    if (idx <= 0) return;

    const above = sorted[idx - 1];
    const currentOrder = video.order ?? 0;
    const aboveOrder = above.order ?? 0;

    try {
      const [res1, res2] = await Promise.all([
        adminFetch('/api/admin/videos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: video.id, order: aboveOrder }),
        }),
        adminFetch('/api/admin/videos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: above.id, order: currentOrder }),
        }),
      ]);

      if (!res1.ok || !res2.ok) throw new Error('Failed to reorder');

      setVideos((prev) =>
        prev.map((v) => {
          if (v.id === video.id) return { ...v, order: aboveOrder };
          if (v.id === above.id) return { ...v, order: currentOrder };
          return v;
        })
      );
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Failed to reorder'}`);
    }
  }

  async function handleMoveDown(video: Video) {
    const sorted = [...videos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = sorted.findIndex((v) => v.id === video.id);
    if (idx < 0 || idx >= sorted.length - 1) return;

    const below = sorted[idx + 1];
    const currentOrder = video.order ?? 0;
    const belowOrder = below.order ?? 0;

    try {
      const [res1, res2] = await Promise.all([
        adminFetch('/api/admin/videos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: video.id, order: belowOrder }),
        }),
        adminFetch('/api/admin/videos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: below.id, order: currentOrder }),
        }),
      ]);

      if (!res1.ok || !res2.ok) throw new Error('Failed to reorder');

      setVideos((prev) =>
        prev.map((v) => {
          if (v.id === video.id) return { ...v, order: belowOrder };
          if (v.id === below.id) return { ...v, order: currentOrder };
          return v;
        })
      );
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Failed to reorder'}`);
    }
  }

  // --- Export CSV ---
  function handleExportCsv() {
    const headers = ['id', 'title', 'url', 'type', 'eventId', 'thumbnail', 'featured', 'order', 'createdAt'];
    const rows = videos.map((v) => [
      escapeCsvField(v.id),
      escapeCsvField(v.title),
      escapeCsvField(v.url),
      escapeCsvField(v.type),
      escapeCsvField(v.eventId || ''),
      escapeCsvField(v.thumbnail || ''),
      String(v.featured),
      String(v.order),
      escapeCsvField(v.createdAt),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const today = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `videos-export-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage('Videos exported as CSV');
  }

  function getEventName(eventId?: string): string {
    if (!eventId) return '';
    const event = events.find((e) => e.id === eventId);
    return event ? event.title : eventId;
  }

  const showForm = creating || editing;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-display font-bold text-white">Videos</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="px-4 py-2 border border-[#C9A84C]/40 text-[#C9A84C] text-sm font-semibold rounded-sm hover:bg-[#C9A84C]/10 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors"
          >
            + New Video
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

      {/* Summary Bar */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Videos</p>
          <p className="text-xl font-display font-bold text-white">{summary.total}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Featured</p>
          <p className="text-xl font-display font-bold text-[#C9A84C]">{summary.featured}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Promo</p>
          <p className="text-xl font-display font-bold text-[#1BBFA1]">{summary.promo}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Event</p>
          <p className="text-xl font-display font-bold text-[#1BBFA1]">{summary.eventVids}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Featured Type</p>
          <p className="text-xl font-display font-bold text-white/40">{summary.featuredType}</p>
        </div>
      </div>

      {showForm && (
        <div className="mb-8 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">
            {creating ? 'Add Video' : `Edit: ${editing!.title}`}
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
              <label className="block text-xs text-white/40 mb-1">URL</label>
              <input
                type="text"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                required
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] placeholder-white/20"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Video['type'] })}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              >
                <option value="promo">Promo</option>
                <option value="featured">Featured</option>
                <option value="event">Event</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Event</label>
              <select
                value={form.eventId}
                onChange={(e) => setForm({ ...form, eventId: e.target.value })}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              >
                <option value="">No Event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Thumbnail URL</label>
              <input
                type="text"
                value={form.thumbnail}
                onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
                placeholder="https://img.youtube.com/vi/.../maxresdefault.jpg"
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
            <div className="md:col-span-2 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="w-4 h-4 accent-[#C9A84C] cursor-pointer"
                />
                <span className="text-sm text-white/60">Featured Video</span>
              </label>
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : creating ? 'Add Video' : 'Update Video'}
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

      {/* Videos Table */}
      <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm overflow-hidden relative">
        <div ref={scrollContainerRef} className="overflow-x-auto" role="region" aria-label="Videos table">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-[#C9A84C]/20">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Order</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">URL</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Event</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Featured</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedVideos.map((video, idx) => (
                <tr key={video.id} className="border-b border-[#C9A84C]/10 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveUp(video)}
                        disabled={idx === 0}
                        className="text-xs text-[#C9A84C] hover:text-[#D4B65C] disabled:text-white/10 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        &#9650;
                      </button>
                      <button
                        onClick={() => handleMoveDown(video)}
                        disabled={idx === sortedVideos.length - 1}
                        className="text-xs text-[#C9A84C] hover:text-[#D4B65C] disabled:text-white/10 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        &#9660;
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {editingTitleId === video.id ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => saveTitleEdit(video.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveTitleEdit(video.id);
                          if (e.key === 'Escape') setEditingTitleId(null);
                        }}
                        className="w-full px-2 py-1 bg-[#111111] border border-[#C9A84C]/30 text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="text-sm text-white font-medium cursor-pointer hover:text-[#C9A84C] transition-colors"
                        onClick={() => startTitleEdit(video)}
                        title="Click to rename"
                      >
                        {video.title}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white/40 hover:text-[#C9A84C] transition-colors truncate block max-w-[200px]"
                      title={video.url}
                    >
                      {video.url}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-sm ${
                      video.type === 'promo' ? 'bg-[#1BBFA1]/20 text-[#1BBFA1]' :
                      video.type === 'featured' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' :
                      'bg-white/20 text-white/40'
                    }`}>
                      {video.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-white/40">
                    {getEventName(video.eventId) || <span className="text-white/20">--</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleFeatured(video)}
                      className={`text-xs px-2 py-1 rounded-sm ${
                        video.featured
                          ? 'bg-[#C9A84C]/20 text-[#C9A84C]'
                          : 'bg-white/5 text-white/30 hover:text-white/60'
                      }`}
                    >
                      {video.featured ? '\u2605 Featured' : '\u2606 Feature'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(video)}
                      className="text-xs text-[#1BBFA1] hover:text-[#1BBFA1]/80 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(video.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {videos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-white/40 text-sm">
                    No videos yet. Click &quot;+ New Video&quot; to create one.
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
