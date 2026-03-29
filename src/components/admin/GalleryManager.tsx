'use client';
import { getApiUrl } from '@/lib/api-config';

import { useState, FormEvent } from 'react';
import type { GalleryImage } from '@/lib/data';

interface GalleryManagerProps {
  initialGallery: GalleryImage[];
}

export default function GalleryManager({ initialGallery }: GalleryManagerProps) {
  const [images, setImages] = useState<GalleryImage[]>(initialGallery);
  const [creating, setCreating] = useState(false);
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  const [category, setCategory] = useState('event');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-display font-bold text-white">Gallery</h2>
        <button onClick={() => setCreating(!creating)} className="px-4 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors">
          + Add Image
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-sm text-sm ${message.startsWith('Error') ? 'bg-red-400/10 text-red-400' : 'bg-[#1BBFA1]/10 text-[#1BBFA1]'}`}>
          {message}
        </div>
      )}

      {creating && (
        <div className="mb-8 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">Add Image</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-[white/40] mb-1">Image URL</label>
              <input type="text" value={src} onChange={(e) => setSrc(e.target.value)} required className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs text-[white/40] mb-1">Alt Text</label>
              <input type="text" value={alt} onChange={(e) => setAlt(e.target.value)} required className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs text-[white/40] mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]">
                <option value="event">Event</option>
                <option value="behind-the-scenes">Behind the Scenes</option>
                <option value="venue">Venue</option>
                <option value="promotional">Promotional</option>
              </select>
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] disabled:opacity-50">
                {saving ? 'Adding...' : 'Add Image'}
              </button>
              <button type="button" onClick={() => setCreating(false)} className="px-6 py-2 border border-[white/40]/30 text-[white/40] text-sm rounded-sm hover:text-white">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image) => (
          <div key={image.id} className="relative group bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm overflow-hidden">
            <div className="aspect-[4/3] bg-[#0A0A0A] flex items-center justify-center">
              {image.src ? (
                <img src={image.src} alt={image.alt} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[white/40] text-xs">No image</span>
              )}
            </div>
            <div className="p-2">
              <p className="text-white text-xs truncate">{image.alt}</p>
              <p className="text-[white/40] text-xs">{image.category}</p>
            </div>
            <button
              onClick={() => handleDelete(image.id)}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              x
            </button>
          </div>
        ))}
        {images.length === 0 && (
          <p className="text-[white/40] text-sm col-span-full text-center py-8">No gallery images yet.</p>
        )}
      </div>
    </div>
  );
}
