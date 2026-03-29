'use client';
import { getApiUrl } from '@/lib/api-config';

import { useState, FormEvent } from 'react';
import type { GalleryImage } from '@/lib/data';

interface GalleryManagerProps {
  initialGallery: GalleryImage[];
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

export default function GalleryManager({ initialGallery }: GalleryManagerProps) {
  const [images, setImages] = useState<GalleryImage[]>(initialGallery);
  const [creating, setCreating] = useState(false);
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  const [category, setCategory] = useState('event');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch(getApiUrl('/api/admin/gallery'), {
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
      setMessage('Image added');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this image?')) return;

    try {
      const res = await fetch(getApiUrl('/api/admin/gallery'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Failed to delete');
      setImages((prev) => prev.filter((img) => img.id !== id));
      setMessage('Image deleted');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
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

  const totalImages = SITE_IMAGES.reduce((sum, g) => sum + g.images.length, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Gallery</h2>
          <p className="text-xs font-body text-white/30 mt-1">{totalImages} images across {SITE_IMAGES.length} categories</p>
        </div>
        <button onClick={() => setCreating(!creating)} className="px-4 py-2 bg-[#C9A84C] text-black text-sm font-body font-semibold hover:bg-[#D4B65C] transition-colors">
          + Add Image
        </button>
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
              <input type="text" value={src} onChange={(e) => setSrc(e.target.value)} required placeholder="/images/gallery/new-image.jpg" className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/15 text-white text-sm font-body focus:outline-none focus:border-[#C9A84C]/40" />
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {group.images.map((image) => (
              <div key={image.src} className="group bg-[#111111] border border-white/5 overflow-hidden hover:border-[#C9A84C]/20 transition-colors">
                <div className="aspect-[4/3] bg-[#0A0A0A] flex items-center justify-center overflow-hidden">
                  <img src={image.src} alt={image.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                </div>
                <div className="p-2.5">
                  <p className="text-white text-[11px] font-body font-medium truncate">{image.alt}</p>
                  <p className="text-white/25 text-[9px] font-body mt-0.5 truncate">{image.src}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* User-added images */}
      {images.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-display font-semibold text-[#C9A84C]">Custom Uploads</h3>
            <span className="text-[10px] font-body text-white/25">{images.length} images</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((image) => (
              <div key={image.id} className="relative group bg-[#111111] border border-white/5 overflow-hidden hover:border-[#C9A84C]/20 transition-colors">
                <div className="aspect-[4/3] bg-[#0A0A0A] flex items-center justify-center overflow-hidden">
                  {image.src ? (
                    <img src={image.src} alt={image.alt} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-white/20 text-xs font-body">No image</span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-white text-[11px] font-body font-medium truncate">{image.alt}</p>
                  <p className="text-white/25 text-[9px] font-body mt-0.5">{image.category}</p>
                </div>
                <button
                  onClick={() => handleDelete(image.id)}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredSiteImages.length === 0 && images.length === 0 && (
        <p className="text-white/30 text-sm font-body text-center py-8">No images match your search.</p>
      )}
    </div>
  );
}
