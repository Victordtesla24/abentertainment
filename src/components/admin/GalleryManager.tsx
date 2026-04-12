'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { uploadFile } from '@/lib/upload-helper';

import { useState, useCallback, useEffect, FormEvent } from 'react';
import type { GalleryImage, Event } from '@/lib/data';

interface GalleryManagerProps {
  initialGallery: GalleryImage[];
  allEvents?: Event[];
  initialSiteImageOverrides?: Record<string, { alt?: string; src?: string }>;
}

// All images that exist on the website, organized by category
const SITE_IMAGES: { category: string; label: string; images: { src: string; alt: string }[] }[] = [
  {
    category: 'heroes',
    label: 'Page Hero Images',
    images: [
      { src: '/images/hero-bg.jpg', alt: 'Homepage Hero Background 1' },
      { src: '/images/hero-bg-2.jpg', alt: 'Homepage Hero Background 2' },
      { src: '/images/heroes/about-hero.png', alt: 'About Page Hero' },
      { src: '/images/heroes/events-hero.png', alt: 'Events Page Hero' },
      { src: '/images/heroes/gallery-hero.png', alt: 'Gallery Page Hero' },
      { src: '/images/heroes/sponsors-hero.png', alt: 'Sponsors Page Hero' },
      { src: '/images/heroes/contact-hero.png', alt: 'Contact Page Hero' },
    ],
  },
  {
    category: 'events',
    label: 'Event Promotional Images',
    images: [
      { src: '/images/events/shrimant-damodar-pant.jpg', alt: 'Shrimant Damodar Pant' },
      { src: '/images/events/arya-ambekar.jpg', alt: 'Arya Ambekar Live in Concert' },
      { src: '/images/events/shikayla-gelo-ek.jpg', alt: 'Shikayla Gelo Ek!' },
      { src: '/images/events/varvarche-vadhu-var.jpg', alt: 'Varvarche Vadhu Var' },
      { src: '/images/events/swaranirmiti.jpg', alt: 'Swaranirmiti 2026' },
      { src: '/images/events/diwali-spectacular.jpg', alt: 'Diwali Spectacular 2026' },
    ],
  },
  {
    category: 'gallery',
    label: 'Event Gallery Photos',
    images: [
      { src: '/images/gallery/event-1.jpg', alt: 'Event Photo 1' },
      { src: '/images/gallery/event-2.jpg', alt: 'Event Photo 2' },
      { src: '/images/gallery/event-3.jpg', alt: 'Event Photo 3' },
      { src: '/images/gallery/event-4.jpg', alt: 'Event Photo 4' },
      { src: '/images/gallery/event-5.jpg', alt: 'Event Photo 5' },
      { src: '/images/gallery/event-6.jpg', alt: 'Event Photo 6' },
      { src: '/images/gallery/event-7.jpg', alt: 'Event Photo 7' },
      { src: '/images/gallery/event-8.jpg', alt: 'Event Photo 8' },
      { src: '/images/gallery/event-9.jpg', alt: 'Event Photo 9' },
      { src: '/images/gallery/niyam-v-ati-1.jpg', alt: 'Niyam V Ati Lagu 1' },
      { src: '/images/gallery/niyam-v-ati-2.jpg', alt: 'Niyam V Ati Lagu 2' },
      { src: '/images/gallery/niyam-v-ati-3.jpg', alt: 'Niyam V Ati Lagu 3' },
      { src: '/images/gallery/niyam-v-ati-4.jpg', alt: 'Niyam V Ati Lagu 4' },
      { src: '/images/gallery/niyam-v-ati-5.jpg', alt: 'Niyam V Ati Lagu 5' },
      { src: '/images/gallery/niyam-v-ati-6.jpg', alt: 'Niyam V Ati Lagu 6' },
      { src: '/images/gallery/niyam-v-ati-7.jpg', alt: 'Niyam V Ati Lagu 7' },
      { src: '/images/gallery/niyam-v-ati-8.jpg', alt: 'Niyam V Ati Lagu 8' },
      { src: '/images/gallery/niyam-v-ati-9.jpg', alt: 'Niyam V Ati Lagu 9' },
      { src: '/images/gallery/niyam-v-ati-10.jpg', alt: 'Niyam V Ati Lagu 10' },
    ],
  },
  {
    category: 'sponsors',
    label: 'Sponsor Logos',
    images: [
      { src: '/images/sponsors/mac.png', alt: 'Melbourne Arts Council' },
      { src: '/images/sponsors/vmc.png', alt: 'Victorian Multicultural Commission' },
      { src: '/images/sponsors/sbs.png', alt: 'SBS Australia' },
      { src: '/images/sponsors/iam.jpg', alt: 'Indian Association of Melbourne' },
    ],
  },
  {
    category: 'team',
    label: 'Team Photos',
    images: [
      { src: '/images/team/abhijit-kadam.jpg', alt: 'Abhijit Kadam — President & CEO' },
      { src: '/images/team/vrushali-deshpande.jpg', alt: 'Vrushali Deshpande — Founder & Director' },
    ],
  },
  {
    category: 'branding',
    label: 'Branding & Logo',
    images: [
      { src: '/images/AB_Logo_transparent.png', alt: 'AB Entertainment Logo' },
    ],
  },
];

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export default function GalleryManager({ initialGallery, allEvents, initialSiteImageOverrides }: GalleryManagerProps) {
  const [images, setImages] = useState<GalleryImage[]>(initialGallery);
  const [creating, setCreating] = useState(false);
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  const [category, setCategory] = useState('event');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAlt, setEditAlt] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Site image edit state — initialized from persisted overrides
  const [siteImageEdits, setSiteImageEdits] = useState<Record<string, { alt?: string; src?: string }>>(initialSiteImageOverrides || {});
  const [editingSiteImage, setEditingSiteImage] = useState<string | null>(null);
  const [editSiteSrc, setEditSiteSrc] = useState('');
  const [editSiteAlt, setEditSiteAlt] = useState('');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Image health check — detect broken images that won't render on the public site
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkImages = async () => {
      const broken = new Set<string>();
      for (const img of images) {
        if (!img.src) { broken.add(img.id); continue; }
        try {
          const res = await fetch(img.src, { method: 'HEAD' });
          if (!res.ok) broken.add(img.id);
        } catch { broken.add(img.id); }
      }
      setBrokenImages(broken);
    };
    if (images.length > 0) checkImages();
  }, [images]);

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  /** Persist site image overrides to settings.json via the settings API. */
  async function saveSiteImageOverrides(overrides: Record<string, { alt?: string; src?: string }>) {
    try {
      const settingsRes = await adminFetch('/api/admin/settings');
      if (!settingsRes.ok) return;
      const { settings } = await settingsRes.json();
      await adminFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, siteImageOverrides: overrides }),
      });
    } catch {
      // Non-fatal — local state already updated, will retry on next save
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const res = await adminFetch('/api/admin/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ src, alt, category, width: 1200, height: 800 }),
      });

      if (!res.ok) throw new Error('Failed to add image');

      const data = await res.json();
      setImages((prev) => [...prev, data.image]);
      setSrc('');
      setAlt('');
      setCreating(false);
      showMessage('Image added');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this image?')) return;

    try {
      const res = await adminFetch('/api/admin/gallery', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Failed to delete');
      setImages((prev) => prev.filter((img) => img.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showMessage('Image deleted');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // --- Edit Image ---
  function startEditing(image: GalleryImage) {
    setEditingId(image.id);
    setEditAlt(image.alt);
    setEditCategory(image.category);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditAlt('');
    setEditCategory('');
  }

  async function handleEditSave(id: string) {
    setEditSaving(true);
    try {
      const res = await adminFetch('/api/admin/gallery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, alt: editAlt, category: editCategory }),
      });

      if (!res.ok) throw new Error('Failed to update image');

      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, alt: editAlt, category: editCategory } : img
        )
      );
      cancelEditing();
      showMessage('Image updated');
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
    setImages((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    try {
      await Promise.all([
        adminFetch('/api/admin/gallery', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: current.id, order: index - 1 }),
        }),
        adminFetch('/api/admin/gallery', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: above.id, order: index }),
        }),
      ]);
    } catch {
      // Order was already updated in local state
    }
  }, [images]);

  const handleMoveDown = useCallback(async (index: number) => {
    if (index >= images.length - 1) return;
    const current = images[index];
    const below = images[index + 1];
    setImages((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    try {
      await Promise.all([
        adminFetch('/api/admin/gallery', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: current.id, order: index + 1 }),
        }),
        adminFetch('/api/admin/gallery', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: below.id, order: index }),
        }),
      ]);
    } catch {
      // Order was already updated in local state
    }
  }, [images]);

  // --- Bulk Actions ---
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === images.length && images.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map((img) => img.id)));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected image${selectedIds.size > 1 ? 's' : ''}?`)) return;
    setBulkDeleting(true);

    try {
      const deletePromises = Array.from(selectedIds).map((id) =>
        adminFetch('/api/admin/gallery', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
      );
      await Promise.all(deletePromises);
      setImages((prev) => prev.filter((img) => !selectedIds.has(img.id)));
      showMessage(`${selectedIds.size} image${selectedIds.size > 1 ? 's' : ''} deleted`);
      setSelectedIds(new Set());
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBulkDeleting(false);
    }
  }

  // --- Export CSV ---
  function handleExportCsv() {
    const rows: string[][] = [['src', 'alt', 'category']];

    // Site images
    for (const group of SITE_IMAGES) {
      for (const img of group.images) {
        rows.push([escapeCsvField(img.src), escapeCsvField(img.alt), escapeCsvField(group.category)]);
      }
    }

    // Custom uploads
    for (const img of images) {
      rows.push([escapeCsvField(img.src), escapeCsvField(img.alt), escapeCsvField(img.category)]);
    }

    const csvContent = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gallery-export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showMessage('Gallery exported as CSV');
  }

  // Filter site images by category and search
  const filteredSiteImages = SITE_IMAGES
    .filter(group => activeCategory === 'all' || group.category === activeCategory)
    .map(group => ({
      ...group,
      images: group.images.filter(img =>
        !search || img.alt.toLowerCase().includes(search.toLowerCase()) || img.src.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(group => group.images.length > 0);

  // Filter custom uploads by search
  const filteredCustomImages = images.filter(img =>
    !search || img.alt.toLowerCase().includes(search.toLowerCase()) || img.src.toLowerCase().includes(search.toLowerCase())
  );

  const totalImages = SITE_IMAGES.reduce((sum, g) => sum + g.images.length, 0);
  const allSelected = images.length > 0 && selectedIds.size === images.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Gallery</h2>
          <p className="text-xs font-body text-white/30 mt-1">{totalImages} site images across {SITE_IMAGES.length} categories{images.length > 0 ? ` + ${images.length} custom upload${images.length > 1 ? 's' : ''}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCsv} className="px-4 py-2 border border-white/20 text-white/60 text-sm font-body hover:text-white hover:border-white/40 transition-colors">
            Export CSV
          </button>
          <button onClick={() => setCreating(!creating)} className="px-4 py-2 bg-[#C9A84C] text-black text-sm font-body font-semibold hover:bg-[#D4B65C] transition-colors">
            + Add Image
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 text-sm font-body ${message.startsWith('Error') ? 'bg-red-400/10 text-red-400 border border-red-400/20' : 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20'}`}>
          {message}
        </div>
      )}

      {creating && (
        <div className="mb-6 bg-[#111111] border border-[#C9A84C]/20 p-5">
          <h3 className="text-sm font-display font-semibold text-[#C9A84C] mb-4">Add Image</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-body uppercase tracking-wider text-white/35 mb-1">Image URL</label>
              <div className="flex gap-2">
                <input type="text" value={src} onChange={(e) => setSrc(e.target.value)} required placeholder="/images/gallery/new-image.jpg" className="flex-1 px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/15 text-white text-sm font-body focus:outline-none focus:border-[#C9A84C]/40" />
                <input
                  type="file"
                  id="gallery-src-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const result = await uploadFile(file, 'gallery');
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
                  htmlFor="gallery-src-upload"
                  className="text-[11px] font-body px-3 py-1.5 bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20 hover:bg-[#C9A84C]/20 transition-colors cursor-pointer whitespace-nowrap flex items-center"
                >
                  {uploading ? 'Uploading...' : 'Upload File'}
                </label>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-body uppercase tracking-wider text-white/35 mb-1">Alt Text</label>
              <input type="text" value={alt} onChange={(e) => setAlt(e.target.value)} required className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/15 text-white text-sm font-body focus:outline-none focus:border-[#C9A84C]/40" />
            </div>
            <div>
              <label className="block text-[10px] font-body uppercase tracking-wider text-white/35 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/15 text-white text-sm font-body focus:outline-none focus:border-[#C9A84C]/40">
                <option value="event">Event</option>
                <option value="behind-the-scenes">Behind the Scenes</option>
                <option value="venue">Venue</option>
                <option value="promotional">Promotional</option>
              </select>
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-[#C9A84C] text-black text-sm font-body font-semibold hover:bg-[#D4B65C] disabled:opacity-50">
                {saving ? 'Adding...' : 'Add Image'}
              </button>
              <button type="button" onClick={() => setCreating(false)} className="px-6 py-2 border border-white/20 text-white/40 text-sm font-body hover:text-white">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Category Filter */}
      <div className="mb-5 space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search images by name or path..."
          className="w-full px-3 py-2 bg-[#111111] border border-white/10 text-white text-sm font-body placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/30"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory('all')}
            className={`text-[10px] font-body px-3 py-1.5 border transition-colors ${activeCategory === 'all' ? 'bg-[#C9A84C]/15 border-[#C9A84C]/30 text-[#C9A84C]' : 'border-white/10 text-white/40 hover:text-white'}`}
          >
            All ({totalImages})
          </button>
          {SITE_IMAGES.map(group => (
            <button
              key={group.category}
              onClick={() => setActiveCategory(group.category)}
              className={`text-[10px] font-body px-3 py-1.5 border transition-colors ${activeCategory === group.category ? 'bg-[#C9A84C]/15 border-[#C9A84C]/30 text-[#C9A84C]' : 'border-white/10 text-white/40 hover:text-white'}`}
            >
              {group.label} ({group.images.length})
            </button>
          ))}
        </div>
      </div>

      {/* Site Images by Category */}
      {filteredSiteImages.map(group => (
        <div key={group.category} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-display font-semibold text-[#C9A84C]">{group.label}</h3>
            <span className="text-[10px] font-body text-white/25">{group.images.length} images</span>
          </div>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 min-w-[320px]">
              {group.images.map((image) => (
                <div key={image.src} className="group bg-[#111111] border border-white/5 overflow-hidden hover:border-[#C9A84C]/20 transition-colors">
                  <div className="aspect-[4/3] bg-[#0A0A0A] flex items-center justify-center overflow-hidden">
                    <img src={siteImageEdits[image.src]?.src || image.src} alt={siteImageEdits[image.src]?.alt || image.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  </div>
                  {editingSiteImage === image.src ? (
                    <div className="p-2.5 space-y-2 bg-[#0A0A0A] border-t border-[#C9A84C]/20">
                      <div>
                        <label className="block text-[9px] font-body uppercase tracking-wider text-white/35 mb-0.5">Alt Text</label>
                        <input type="text" value={editSiteAlt} onChange={(e) => setEditSiteAlt(e.target.value)} className="w-full px-2 py-1.5 bg-[#111111] border border-[#C9A84C]/20 text-white text-[11px] font-body focus:outline-none focus:border-[#C9A84C]/50" autoFocus />
                      </div>
                      <div>
                        <label className="block text-[9px] font-body uppercase tracking-wider text-white/35 mb-0.5">Image URL</label>
                        <input type="text" value={editSiteSrc} onChange={(e) => setEditSiteSrc(e.target.value)} className="w-full px-2 py-1.5 bg-[#111111] border border-[#C9A84C]/20 text-white text-[11px] font-body focus:outline-none focus:border-[#C9A84C]/50" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => { const updated = { ...siteImageEdits, [image.src]: { alt: editSiteAlt, src: editSiteSrc } }; setSiteImageEdits(updated); setEditingSiteImage(null); saveSiteImageOverrides(updated); showMessage('Image updated'); }} className="flex-1 px-3 py-1.5 bg-[#C9A84C] text-black text-[10px] font-body font-semibold hover:bg-[#D4B65C] transition-colors">Save</button>
                        <button onClick={() => setEditingSiteImage(null)} className="flex-1 px-3 py-1.5 border border-white/20 text-white/40 text-[10px] font-body hover:text-white transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5">
                      <p className="text-white text-[11px] font-body font-medium truncate">{siteImageEdits[image.src]?.alt || image.alt}</p>
                      <p className="text-white/25 text-[9px] font-body mt-0.5 truncate">{siteImageEdits[image.src]?.src || image.src}</p>
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/5">
                        <button onClick={() => { setEditingSiteImage(image.src); setEditSiteAlt(siteImageEdits[image.src]?.alt || image.alt); setEditSiteSrc(siteImageEdits[image.src]?.src || image.src); }} className="px-2 py-1 text-[9px] font-body text-white/40 border border-white/10 hover:text-[#C9A84C] hover:border-[#C9A84C]/30 transition-colors">Edit</button>
                        <button onClick={() => { const updated = { ...siteImageEdits, [image.src]: { ...siteImageEdits[image.src], src: '' } }; setSiteImageEdits(updated); saveSiteImageOverrides(updated); showMessage('Image marked for replacement'); }} className="px-2 py-1 text-[9px] font-body text-white/40 border border-white/10 hover:text-[#C9A84C] hover:border-[#C9A84C]/30 transition-colors">Replace</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Broken image warning */}
      {brokenImages.size > 0 && (
        <div className="mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-body">
          <span className="font-semibold">{brokenImages.size} image{brokenImages.size > 1 ? 's' : ''} hidden on the public website</span>
          <span className="text-amber-400/60"> — the image file is missing or inaccessible. Re-upload the image or delete the broken entry.</span>
        </div>
      )}

      {/* Custom Uploads (editable) */}
      {filteredCustomImages.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-display font-semibold text-[#C9A84C]">Custom Uploads</h3>
              <span className="text-[10px] font-body text-white/25">{filteredCustomImages.length} images</span>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          <div className="flex items-center gap-3 mb-3 bg-[#111111] border border-white/5 px-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 accent-[#C9A84C] cursor-pointer"
              />
              <span className="text-[10px] font-body text-white/50">Select All</span>
            </label>
            {selectedIds.size > 0 && (
              <>
                <span className="text-[10px] font-body text-white/30">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="ml-auto px-3 py-1 bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] font-body font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-colors"
                >
                  {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Selected`}
                </button>
              </>
            )}
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-[320px]">
              {filteredCustomImages.map((image) => {
                const realIndex = images.findIndex((img) => img.id === image.id);
                const isEditing = editingId === image.id;
                const isSelected = selectedIds.has(image.id);

                return (
                  <div
                    key={image.id}
                    className={`relative group bg-[#111111] border overflow-hidden transition-colors ${isSelected ? 'border-[#C9A84C]/40' : 'border-white/5 hover:border-[#C9A84C]/20'}`}
                  >
                    {/* Selection checkbox */}
                    <div className="absolute top-2 left-2 z-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(image.id)}
                        className="w-3.5 h-3.5 accent-[#C9A84C] cursor-pointer"
                      />
                    </div>

                    {/* Image preview - click to edit */}
                    <div
                      className="aspect-[4/3] bg-[#0A0A0A] flex items-center justify-center overflow-hidden cursor-pointer relative"
                      onClick={() => !isEditing && startEditing(image)}
                      title="Click to edit"
                    >
                      {image.src ? (
                        <img src={image.src} alt={image.alt} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span className="text-white/20 text-xs font-body">No image</span>
                      )}
                      {brokenImages.has(image.id) && (
                        <div className="absolute inset-0 bg-red-900/40 flex flex-col items-center justify-center p-3">
                          <span className="text-red-400 text-[10px] font-body font-semibold mb-1">Hidden on website</span>
                          <span className="text-red-400/70 text-[9px] font-body text-center">Image file missing — re-upload or delete</span>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      /* Inline Edit Form */
                      <div className="p-3 space-y-2 bg-[#0A0A0A] border-t border-[#C9A84C]/20">
                        <div>
                          <label className="block text-[9px] font-body uppercase tracking-wider text-white/35 mb-0.5">Alt Text / Name</label>
                          <input
                            type="text"
                            value={editAlt}
                            onChange={(e) => setEditAlt(e.target.value)}
                            className="w-full px-2 py-1.5 bg-[#111111] border border-[#C9A84C]/20 text-white text-[11px] font-body focus:outline-none focus:border-[#C9A84C]/50"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-body uppercase tracking-wider text-white/35 mb-0.5">Category</label>
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="w-full px-2 py-1.5 bg-[#111111] border border-[#C9A84C]/20 text-white text-[11px] font-body focus:outline-none focus:border-[#C9A84C]/50"
                          >
                            <option value="event">Event</option>
                            <option value="behind-the-scenes">Behind the Scenes</option>
                            <option value="venue">Venue</option>
                            <option value="promotional">Promotional</option>
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
                        <p className="text-white text-[11px] font-body font-medium truncate">
                          {image.alt}
                          {image.eventId && allEvents && (
                            <span className="text-[9px] text-[#C9A84C]/60 ml-1">
                              ({allEvents.find(e => e.id === image.eventId)?.title || 'Unknown event'})
                            </span>
                          )}
                        </p>
                        <p className="text-white/25 text-[9px] font-body mt-0.5">{image.category}</p>

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
      )}

      {/* Empty state when no custom uploads exist but filter might hide site images */}
      {images.length === 0 && filteredSiteImages.length === 0 && (
        <p className="text-white/30 text-sm font-body text-center py-8">No images match your search.</p>
      )}
    </div>
  );
}
