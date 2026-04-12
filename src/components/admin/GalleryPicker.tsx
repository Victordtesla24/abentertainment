'use client';

import { useState } from 'react';
import type { GalleryImage } from '@/lib/data';

interface GalleryPickerProps {
  images: GalleryImage[];
  onSelect: (image: GalleryImage) => void;
  onClose: () => void;
  title?: string;
}

export default function GalleryPicker({ images, onSelect, onClose, title = 'Select from Gallery' }: GalleryPickerProps) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const categories = Array.from(new Set(images.map(img => img.category))).filter(Boolean);

  const filtered = images.filter(img => {
    if (filterCategory !== 'all' && img.category !== filterCategory) return false;
    if (search && !img.alt.toLowerCase().includes(search.toLowerCase()) && !img.src.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#0A0A0A] border border-[#C9A84C]/30 w-[90vw] max-w-4xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-sm font-display font-semibold text-[#C9A84C]">{title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">&times;</button>
        </div>

        {/* Search + Filter */}
        <div className="px-5 py-3 border-b border-white/5 space-y-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search images..."
            className="w-full px-3 py-2 bg-[#111111] border border-white/10 text-white text-sm font-body placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/30"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterCategory('all')}
              className={`text-[10px] font-body px-3 py-1 border transition-colors ${filterCategory === 'all' ? 'bg-[#C9A84C]/15 border-[#C9A84C]/30 text-[#C9A84C]' : 'border-white/10 text-white/40 hover:text-white'}`}
            >
              All ({images.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`text-[10px] font-body px-3 py-1 border transition-colors ${filterCategory === cat ? 'bg-[#C9A84C]/15 border-[#C9A84C]/30 text-[#C9A84C]' : 'border-white/10 text-white/40 hover:text-white'}`}
              >
                {cat} ({images.filter(i => i.category === cat).length})
              </button>
            ))}
          </div>
        </div>

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <p className="text-white/30 text-sm font-body text-center py-8">No images found. Add images in the Gallery tab first.</p>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map(image => (
                <button
                  key={image.id}
                  onClick={() => onSelect(image)}
                  className="group bg-[#111111] border border-white/5 overflow-hidden hover:border-[#C9A84C]/40 transition-colors text-left"
                >
                  <div className="aspect-[4/3] bg-[#0A0A0A] flex items-center justify-center overflow-hidden">
                    {image.src ? (
                      <img src={image.src} alt={image.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    ) : (
                      <span className="text-white/20 text-[10px] font-body">No image</span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-white text-[10px] font-body font-medium truncate">{image.alt}</p>
                    <p className="text-white/25 text-[8px] font-body mt-0.5 truncate">{image.category}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
