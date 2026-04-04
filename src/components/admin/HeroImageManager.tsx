'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { uploadFile } from '@/lib/upload-helper';

import { useState, useCallback, FormEvent } from 'react';
import type { HeroImage } from '@/lib/data';

interface HeroImageManagerProps {
  initialImages: HeroImage[];
}

const PAGES = ['Home', 'About', 'Events', 'Gallery', 'Sponsors', 'Contact'];

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export default function HeroImageManager({ initialImages }: HeroImageManagerProps) {
  const [images, setImages] = useState<HeroImage[]>(initialImages);
  const [creating, setCreating] = useState(false);
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  const [page, setPage] = useState('Home');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAlt, setEditAlt] = useState('');
  const [editPage, setEditPage] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const res = await adminFetch('/api/admin/hero-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ src, alt, page }),
      });

      if (!res.ok) throw new Error('Failed to add hero image');

      const data = await res.json();
      setImages((prev) => [...prev, data.image]);
      setSrc('');
      setAlt('');
      setPage('Home');
      setCreating(false);
      showMessage('Hero image added');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this hero image?')) return;

    try {
      const res = await adminFetch('/api/admin/hero-images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Failed to delete');
      setImages((prev) => prev.filter((img) => img.id !== id));
      showMessage('Hero image deleted');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // --- Edit Image ---
  function startEditing(image: HeroImage) {
    setEditingId(image.id);
    setEditAlt(image.alt);
    setEditPage(image.page);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditAlt('');
    setEditPage('');
  }

  async function handleEditSave(id: string) {
    setEditSaving(true);
    try {
      const res = await adminFetch('/api/admin/hero-images', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, alt: editAlt, page: editPage }),
      });

      if (!res.ok) throw new Error('Failed to update hero image');

      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, alt: editAlt, page: editPage, updatedAt: new Date().toISOString() } : img
        )
      );
      cancelEditing();
      showMessage('Hero image updated');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setEditSaving(false);
    }
  }

  // --- Reorder Images ---
  const handleMoveUp = useCallback(async (index: number) => {
    if (index <= 0) return;
    const current = images[index];
    const above = images[index - 1];
    const currentOrder = current.order;
    const aboveOrder = above.order;

    setImages((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((img, i) => ({ ...img, order: i }));
    });
    try {
      await Promise.all([
        adminFetch('/api/admin/hero-images', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: current.id, order: aboveOrder }),
        }),
        adminFetch('/api/admin/hero-images', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: above.id, order: currentOrder }),
        }),
      ]);
    } catch {
      showMessage('Error: Failed to save order');
    }
  }, [images]);

  const handleMoveDown = useCallback(async (index: number) => {
    if (index >= images.length - 1) return;
    const current = images[index];
    const below = images[index + 1];
    const currentOrder = current.order;
    const belowOrder = below.order;

    setImages((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((img, i) => ({ ...img, order: i }));
    });
    try {
      await Promise.all([
        adminFetch('/api/admin/hero-images', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: current.id, order: belowOrder }),
        }),
        adminFetch('/api/admin/hero-images', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: below.id, order: currentOrder }),
        }),
      ]);
    } catch {
      showMessage('Error: Failed to save order');
    }
  }, [images]);

  // --- Export CSV ---
  function handleExportCsv() {
    const headers = ['id', 'src', 'alt', 'page', 'order', 'createdAt'];
    const rows = images.map((img) => [
      escapeCsvField(img.id),
      escapeCsvField(img.src),
      escapeCsvField(img.alt),
      escapeCsvField(img.page),
      String(img.order),
      escapeCsvField(img.createdAt),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const today = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `hero-images-export-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage('Hero images exported as CSV');
  }

  // Group images by page
  const imagesByPage: Record<string, { image: HeroImage; realIndex: number }[]> = {};
  images.forEach((img, idx) => {
    if (!imagesByPage[img.page]) imagesByPage[img.page] = [];
    imagesByPage[img.page].push({ image: img, realIndex: idx });
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Hero Images</h2>
          <p className="text-xs font-body text-white/30 mt-1">
            {images.length} hero image{images.length !== 1 ? 's' : ''} across {Object.keys(imagesByPage).length} page{Object.keys(imagesByPage).length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCsv} className="px-4 py-2 border border-[#C9A84C]/40 text-[#C9A84C] text-sm font-semibold rounded-sm hover:bg-[#C9A84C]/10 transition-colors">
            Export CSV
          </button>
          <button onClick={() => setCreating(!creating)} className="px-4 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors">
            + Add Hero Image
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-sm text-sm font-body ${message.startsWith('Error') ? 'bg-red-400/10 text-red-400 border border-red-400/20' : 'bg-[#1BBFA1]/10 text-[#1BBFA1] border border-[#1BBFA1]/20'}`}>
          {message}
        </div>
      )}

      {creating && (
        <div className="mb-6 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">Add Hero Image</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-white/40 mb-1">Image URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={src}
                  onChange={(e) => setSrc(e.target.value)}
                  required
                  placeholder="/images/heroes/new-hero.jpg"
                  className="flex-1 px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                />
                <input
                  type="file"
                  id="hero-src-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const result = await uploadFile(file, 'heroes');
                      setSrc(result.url);
                    } catch (err) {
                      setMessage(`Error: ${err instanceof Error ? err.message : 'Upload failed'}`);
                    } finally {
                      setUploading(false);
                      e.target.value = '';
                    }
                  }}
                />
                <label
                  htmlFor="hero-src-upload"
                  className="text-[11px] font-body px-3 py-1.5 bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20 hover:bg-[#C9A84C]/20 transition-colors cursor-pointer whitespace-nowrap flex items-center rounded-sm"
                >
                  {uploading ? 'Uploading...' : 'Upload File'}
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Alt Text</label>
              <input
                type="text"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                required
                placeholder="Describe the hero image"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Page</label>
              <select
                value={page}
                onChange={(e) => setPage(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
              >
                {PAGES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Hero Image'}
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

      {/* Hero Images grouped by page */}
      {Object.keys(imagesByPage).length > 0 ? (
        Object.entries(imagesByPage).map(([pageName, pageImages]) => (
          <div key={pageName} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-display font-semibold text-[#C9A84C]">{pageName} Page</h3>
              <span className="text-[10px] font-body text-white/25">{pageImages.length} image{pageImages.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-x-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-[320px]">
                {pageImages.map(({ image, realIndex }) => {
                  const isEditing = editingId === image.id;

                  return (
                    <div
                      key={image.id}
                      className="relative group bg-[#111111] border border-white/5 overflow-hidden hover:border-[#C9A84C]/20 transition-colors"
                    >
                      {/* Image preview - click to edit */}
                      <div
                        className="aspect-[16/7] bg-[#0A0A0A] flex items-center justify-center overflow-hidden cursor-pointer"
                        onClick={() => !isEditing && startEditing(image)}
                        title="Click to edit"
                      >
                        {image.src ? (
                          <img src={image.src} alt={image.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        ) : (
                          <span className="text-white/20 text-xs font-body">No image</span>
                        )}
                      </div>

                      {isEditing ? (
                        /* Inline Edit Form */
                        <div className="p-3 space-y-2 bg-[#0A0A0A] border-t border-[#C9A84C]/20">
                          <div>
                            <label className="block text-[9px] font-body uppercase tracking-wider text-white/35 mb-0.5">Alt Text</label>
                            <input
                              type="text"
                              value={editAlt}
                              onChange={(e) => setEditAlt(e.target.value)}
                              className="w-full px-2 py-1.5 bg-[#111111] border border-[#C9A84C]/20 text-white text-[11px] font-body focus:outline-none focus:border-[#C9A84C]/50"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-body uppercase tracking-wider text-white/35 mb-0.5">Page</label>
                            <select
                              value={editPage}
                              onChange={(e) => setEditPage(e.target.value)}
                              className="w-full px-2 py-1.5 bg-[#111111] border border-[#C9A84C]/20 text-white text-[11px] font-body focus:outline-none focus:border-[#C9A84C]/50"
                            >
                              {PAGES.map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleEditSave(image.id)}
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
                        /* Display mode */
                        <div className="p-2.5">
                          <p className="text-white text-[11px] font-body font-medium truncate">{image.alt}</p>
                          <p className="text-white/25 text-[9px] font-body mt-0.5 truncate">{image.src}</p>

                          {/* Action buttons row */}
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/5">
                            <button
                              onClick={() => startEditing(image)}
                              className="px-2 py-1 text-[9px] font-body text-white/40 border border-white/10 hover:text-[#C9A84C] hover:border-[#C9A84C]/30 transition-colors"
                              title="Edit"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleMoveUp(realIndex)}
                              disabled={realIndex <= 0}
                              className="px-2 py-1 text-[9px] font-body text-white/40 border border-white/10 hover:text-white hover:border-white/30 disabled:opacity-20 disabled:hover:text-white/40 disabled:hover:border-white/10 transition-colors"
                              title="Move up"
                            >
                              Up
                            </button>
                            <button
                              onClick={() => handleMoveDown(realIndex)}
                              disabled={realIndex >= images.length - 1}
                              className="px-2 py-1 text-[9px] font-body text-white/40 border border-white/10 hover:text-white hover:border-white/30 disabled:opacity-20 disabled:hover:text-white/40 disabled:hover:border-white/10 transition-colors"
                              title="Move down"
                            >
                              Down
                            </button>
                            <button
                              onClick={() => handleDelete(image.id)}
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
            </div>
          </div>
        ))
      ) : (
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-8 text-center">
          <p className="text-white/40 text-sm font-body">No hero images yet. Click &quot;+ Add Hero Image&quot; to create one.</p>
        </div>
      )}
    </div>
  );
}
