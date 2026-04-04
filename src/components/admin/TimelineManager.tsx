'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useState, useCallback, FormEvent } from 'react';
import type { TimelineChapter } from '@/lib/data';

interface TimelineManagerProps {
  initialChapters: TimelineChapter[];
}

export default function TimelineManager({ initialChapters }: TimelineManagerProps) {
  const [chapters, setChapters] = useState<TimelineChapter[]>(initialChapters);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // New chapter form state
  const [newPreTitle, setNewPreTitle] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newStatValue, setNewStatValue] = useState('');
  const [newStatLabel, setNewStatLabel] = useState('');
  const [newBgImage, setNewBgImage] = useState('');
  const [newAccent, setNewAccent] = useState('#C9A84C');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPreTitle, setEditPreTitle] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editStatValue, setEditStatValue] = useState('');
  const [editStatLabel, setEditStatLabel] = useState('');
  const [editBgImage, setEditBgImage] = useState('');
  const [editAccent, setEditAccent] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  // --- Create ---
  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const res = await adminFetch('/api/admin/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preTitle: newPreTitle,
          title: newTitle,
          body: newBody,
          statValue: newStatValue,
          statLabel: newStatLabel,
          backgroundImage: newBgImage,
          accent: newAccent,
        }),
      });

      if (!res.ok) throw new Error('Failed to add chapter');

      const data = await res.json();
      setChapters((prev) => [...prev, data.chapter]);
      setNewPreTitle('');
      setNewTitle('');
      setNewBody('');
      setNewStatValue('');
      setNewStatLabel('');
      setNewBgImage('');
      setNewAccent('#C9A84C');
      setCreating(false);
      showMessage('Chapter added');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  // --- Delete ---
  async function handleDelete(id: string) {
    if (!confirm('Delete this timeline chapter?')) return;

    try {
      const res = await adminFetch('/api/admin/timeline', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Failed to delete');
      setChapters((prev) => prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i })));
      showMessage('Chapter deleted');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // --- Edit ---
  function startEditing(chapter: TimelineChapter) {
    setEditingId(chapter.id);
    setEditPreTitle(chapter.preTitle);
    setEditTitle(chapter.title);
    setEditBody(chapter.body);
    setEditStatValue(chapter.statValue || '');
    setEditStatLabel(chapter.statLabel || '');
    setEditBgImage(chapter.backgroundImage || '');
    setEditAccent(chapter.accent);
  }

  function cancelEditing() {
    setEditingId(null);
  }

  async function handleEditSave(id: string) {
    setEditSaving(true);
    try {
      const res = await adminFetch('/api/admin/timeline', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          preTitle: editPreTitle,
          title: editTitle,
          body: editBody,
          statValue: editStatValue,
          statLabel: editStatLabel,
          backgroundImage: editBgImage,
          accent: editAccent,
        }),
      });

      if (!res.ok) throw new Error('Failed to update chapter');

      setChapters((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                preTitle: editPreTitle,
                title: editTitle,
                body: editBody,
                statValue: editStatValue,
                statLabel: editStatLabel,
                backgroundImage: editBgImage,
                accent: editAccent,
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      );
      cancelEditing();
      showMessage('Chapter updated');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setEditSaving(false);
    }
  }

  // --- Reorder ---
  const handleMoveUp = useCallback(
    async (index: number) => {
      if (index <= 0) return;

      setChapters((prev) => {
        const next = [...prev];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        return next.map((c, i) => ({ ...c, order: i }));
      });

      try {
        const reordered = [...chapters];
        [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
        const updated = reordered.map((c, i) => ({ ...c, order: i }));
        await adminFetch('/api/admin/timeline', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapters: updated }),
        });
      } catch {
        showMessage('Error: Failed to save order');
      }
    },
    [chapters],
  );

  const handleMoveDown = useCallback(
    async (index: number) => {
      if (index >= chapters.length - 1) return;

      setChapters((prev) => {
        const next = [...prev];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        return next.map((c, i) => ({ ...c, order: i }));
      });

      try {
        const reordered = [...chapters];
        [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
        const updated = reordered.map((c, i) => ({ ...c, order: i }));
        await adminFetch('/api/admin/timeline', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapters: updated }),
        });
      } catch {
        showMessage('Error: Failed to save order');
      }
    },
    [chapters],
  );

  const inputClass =
    'w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Timeline Chapters</h2>
          <p className="text-xs font-body text-white/30 mt-1">
            {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} in &quot;Our Story&quot;
          </p>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className="px-4 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors"
        >
          + Add Chapter
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 px-4 py-2 rounded-sm text-sm font-body ${
            message.startsWith('Error')
              ? 'bg-red-400/10 text-red-400 border border-red-400/20'
              : 'bg-[#1BBFA1]/10 text-[#1BBFA1] border border-[#1BBFA1]/20'
          }`}
        >
          {message}
        </div>
      )}

      {/* Create Form */}
      {creating && (
        <div className="mb-6 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">Add Timeline Chapter</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1">Pre-title</label>
              <input
                type="text"
                value={newPreTitle}
                onChange={(e) => setNewPreTitle(e.target.value)}
                placeholder="Chapter IV"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                placeholder="Chapter title"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-white/40 mb-1">Body</label>
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                required
                rows={3}
                placeholder="Chapter description..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Stat Value</label>
              <input
                type="text"
                value={newStatValue}
                onChange={(e) => setNewStatValue(e.target.value)}
                placeholder="e.g. 50+"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Stat Label</label>
              <input
                type="text"
                value={newStatLabel}
                onChange={(e) => setNewStatLabel(e.target.value)}
                placeholder="e.g. Events Hosted"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Background Image URL</label>
              <input
                type="text"
                value={newBgImage}
                onChange={(e) => setNewBgImage(e.target.value)}
                placeholder="/images/timeline/chapter-4.jpg"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Accent Color (hex)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newAccent}
                  onChange={(e) => setNewAccent(e.target.value)}
                  placeholder="#C9A84C"
                  className={inputClass}
                />
                <div
                  className="w-9 h-9 rounded-sm border border-white/10 flex-shrink-0"
                  style={{ backgroundColor: newAccent }}
                />
              </div>
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Chapter'}
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="px-6 py-2 border border-white/30 text-white/40 text-sm rounded-sm hover:text-white hover:border-white/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Chapter Cards */}
      {chapters.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {chapters.map((chapter, index) => {
            const isEditing = editingId === chapter.id;

            return (
              <div
                key={chapter.id}
                className="bg-[#111111] border border-white/5 rounded-sm overflow-hidden hover:border-[#C9A84C]/20 transition-colors"
              >
                {/* Image Preview */}
                <div className="relative h-40 bg-[#0A0A0A] overflow-hidden">
                  {chapter.backgroundImage ? (
                    <>
                      <img
                        src={chapter.backgroundImage}
                        alt=""
                        className="w-full h-full object-cover opacity-40"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
                    </>
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{
                        background: `radial-gradient(ellipse, ${chapter.accent}20, #0A0A0A)`,
                      }}
                    />
                  )}
                  <div className="absolute bottom-3 left-4">
                    <span className="text-[10px] text-[#C9A84C] uppercase tracking-widest">
                      {chapter.preTitle}
                    </span>
                    <h4 className="text-lg font-display font-bold text-white">{chapter.title}</h4>
                  </div>
                  {/* Order badge */}
                  <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/60 border border-white/10 flex items-center justify-center">
                    <span className="text-[10px] text-white/50 font-mono">{index + 1}</span>
                  </div>
                </div>

                {isEditing ? (
                  /* Edit Form */
                  <div className="p-4 space-y-3 bg-[#0A0A0A] border-t border-[#C9A84C]/20">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-body uppercase tracking-wider text-white/35 mb-0.5">
                          Pre-title
                        </label>
                        <input
                          type="text"
                          value={editPreTitle}
                          onChange={(e) => setEditPreTitle(e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#111111] border border-[#C9A84C]/20 text-white text-[11px] font-body focus:outline-none focus:border-[#C9A84C]/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-body uppercase tracking-wider text-white/35 mb-0.5">
                          Title
                        </label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#111111] border border-[#C9A84C]/20 text-white text-[11px] font-body focus:outline-none focus:border-[#C9A84C]/50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-body uppercase tracking-wider text-white/35 mb-0.5">
                        Body
                      </label>
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={3}
                        className="w-full px-2 py-1.5 bg-[#111111] border border-[#C9A84C]/20 text-white text-[11px] font-body focus:outline-none focus:border-[#C9A84C]/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-body uppercase tracking-wider text-white/35 mb-0.5">
                          Stat Value
                        </label>
                        <input
                          type="text"
                          value={editStatValue}
                          onChange={(e) => setEditStatValue(e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#111111] border border-[#C9A84C]/20 text-white text-[11px] font-body focus:outline-none focus:border-[#C9A84C]/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-body uppercase tracking-wider text-white/35 mb-0.5">
                          Stat Label
                        </label>
                        <input
                          type="text"
                          value={editStatLabel}
                          onChange={(e) => setEditStatLabel(e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#111111] border border-[#C9A84C]/20 text-white text-[11px] font-body focus:outline-none focus:border-[#C9A84C]/50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-body uppercase tracking-wider text-white/35 mb-0.5">
                        Background Image URL
                      </label>
                      <input
                        type="text"
                        value={editBgImage}
                        onChange={(e) => setEditBgImage(e.target.value)}
                        className="w-full px-2 py-1.5 bg-[#111111] border border-[#C9A84C]/20 text-white text-[11px] font-body focus:outline-none focus:border-[#C9A84C]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-body uppercase tracking-wider text-white/35 mb-0.5">
                        Accent Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editAccent}
                          onChange={(e) => setEditAccent(e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#111111] border border-[#C9A84C]/20 text-white text-[11px] font-body focus:outline-none focus:border-[#C9A84C]/50"
                        />
                        <div
                          className="w-7 h-7 rounded-sm border border-white/10 flex-shrink-0"
                          style={{ backgroundColor: editAccent }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleEditSave(chapter.id)}
                        disabled={editSaving}
                        className="flex-1 px-3 py-1.5 bg-[#C9A84C] text-black text-[10px] font-body font-semibold hover:bg-[#D4B65C] disabled:opacity-50 transition-colors"
                      >
                        {editSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="flex-1 px-3 py-1.5 border border-white/20 text-white/40 text-[10px] font-body hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div className="p-4">
                    <p className="text-white/60 text-xs font-body leading-relaxed line-clamp-2">
                      {chapter.body}
                    </p>
                    {(chapter.statValue || chapter.statLabel) && (
                      <div className="flex items-baseline gap-2 mt-2">
                        {chapter.statValue && (
                          <span className="text-sm font-display font-bold" style={{ color: chapter.accent }}>
                            {chapter.statValue}
                          </span>
                        )}
                        {chapter.statLabel && (
                          <span className="text-[10px] text-white/30 font-body">{chapter.statLabel}</span>
                        )}
                      </div>
                    )}
                    {chapter.backgroundImage && (
                      <p className="text-white/20 text-[9px] font-body mt-2 truncate">
                        {chapter.backgroundImage}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5">
                      <button
                        onClick={() => startEditing(chapter)}
                        className="px-2 py-1 text-[9px] font-body text-white/40 border border-white/10 hover:text-[#C9A84C] hover:border-[#C9A84C]/30 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index <= 0}
                        className="px-2 py-1 text-[9px] font-body text-white/40 border border-white/10 hover:text-white hover:border-white/30 disabled:opacity-20 disabled:hover:text-white/40 disabled:hover:border-white/10 transition-colors"
                        title="Move up"
                      >
                        Up
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index >= chapters.length - 1}
                        className="px-2 py-1 text-[9px] font-body text-white/40 border border-white/10 hover:text-white hover:border-white/30 disabled:opacity-20 disabled:hover:text-white/40 disabled:hover:border-white/10 transition-colors"
                        title="Move down"
                      >
                        Down
                      </button>
                      <button
                        onClick={() => handleDelete(chapter.id)}
                        className="ml-auto px-2 py-1 text-[9px] font-body text-red-400/60 border border-red-400/15 hover:text-red-400 hover:border-red-400/30 transition-colors"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-8 text-center">
          <p className="text-white/40 text-sm font-body">
            No timeline chapters yet. Click &quot;+ Add Chapter&quot; to create one.
          </p>
        </div>
      )}
    </div>
  );
}
