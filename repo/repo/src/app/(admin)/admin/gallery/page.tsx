"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Save, X, Image as ImageIcon } from "lucide-react";
import type { AdminGalleryImage } from "@/lib/admin-store";

type ImageFormData = Omit<AdminGalleryImage, "id" | "createdAt">;

const EMPTY_FORM: ImageFormData = {
  src: "",
  title: "",
  alt: "",
  eventName: "",
  year: new Date().getFullYear().toString(),
  category: "On Stage",
};

const CATEGORIES = [
  "On Stage",
  "Artist Focus",
  "Venue Atmosphere",
  "Audience",
  "Behind the Scenes",
  "Reception",
];

export default function GalleryPage() {
  const [images, setImages] = useState<AdminGalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ImageFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchImages = useCallback(async () => {
    const res = await fetch("/api/admin/gallery");
    const data = await res.json();
    setImages(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (img: AdminGalleryImage) => {
    setEditing(img.id);
    setCreating(false);
    setForm({
      src: img.src,
      title: img.title,
      alt: img.alt,
      eventName: img.eventName,
      year: img.year,
      category: img.category,
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
        await fetch("/api/admin/gallery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else if (editing) {
        await fetch(`/api/admin/gallery/${editing}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      cancel();
      await fetchImages();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this gallery image?")) return;
    await fetch(`/api/admin/gallery/${id}`, { method: "DELETE" });
    await fetchImages();
  };

  const showForm = creating || editing;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-white">Gallery</h1>
          <p className="mt-2 text-sm text-white/40">
            Manage event photos displayed in the website gallery.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-5 py-2.5 text-sm font-medium text-[#0e0d10] transition-colors hover:bg-[#d4b75e]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add Photo
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/4 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {creating ? "Add New Photo" : "Edit Photo"}
            </h2>
            <button onClick={cancel} className="rounded-lg p-2 text-white/40 hover:bg-white/8">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Image Path
              </label>
              <input
                type="text"
                value={form.src}
                onChange={(e) => setForm((p) => ({ ...p, src: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="/images/gallery/my-photo.jpg"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="Photo title"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Alt Text
              </label>
              <input
                type="text"
                value={form.alt}
                onChange={(e) => setForm((p) => ({ ...p, alt: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="Descriptive alt text"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Event Name
              </label>
              <input
                type="text"
                value={form.eventName}
                onChange={(e) => setForm((p) => ({ ...p, eventName: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="e.g. Niyam V Ati Lagu"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Year
              </label>
              <input
                type="text"
                value={form.year}
                onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#c9a84c]/40"
                placeholder="2024"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-white/40">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#c9a84c]/40"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !form.src || !form.title}
              className="flex items-center gap-2 rounded-xl bg-[#c9a84c] px-6 py-2.5 text-sm font-medium text-[#0e0d10] transition-colors hover:bg-[#d4b75e] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : creating ? "Add Photo" : "Save Changes"}
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

      {/* Gallery Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl border border-white/8 bg-white/4" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No gallery images yet. Add your first photo above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-white/8 bg-white/4"
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 translate-y-2 p-4 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                <p className="text-xs font-medium text-white">{img.title}</p>
                <p className="mt-0.5 text-[0.65rem] text-white/50">
                  {img.eventName} · {img.year}
                </p>
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => startEdit(img)}
                    className="rounded-lg bg-white/15 p-1.5 text-white backdrop-blur-sm hover:bg-white/25"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(img.id)}
                    className="rounded-lg bg-red-500/20 p-1.5 text-red-300 backdrop-blur-sm hover:bg-red-500/30"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[0.55rem] text-white/60 backdrop-blur-sm">
                {img.category}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
