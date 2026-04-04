'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useState, FormEvent } from 'react';
import type { Testimonial } from '@/lib/data';

interface TestimonialsManagerProps {
  initialTestimonials: Testimonial[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <svg key={star} className={`w-3.5 h-3.5 ${star <= rating ? 'text-[#C9A84C]' : 'text-white/20'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function TestimonialsManager({ initialTestimonials }: TestimonialsManagerProps) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(initialTestimonials);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [quote, setQuote] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function resetForm() {
    setName('');
    setRole('');
    setQuote('');
    setRating(5);
    setAvatar('');
    setEditing(null);
    setCreating(false);
  }

  function startCreate() {
    resetForm();
    setCreating(true);
  }

  function startEdit(testimonial: Testimonial) {
    setCreating(false);
    setEditing(testimonial);
    setName(testimonial.name);
    setRole(testimonial.role);
    setQuote(testimonial.quote);
    setRating(testimonial.rating);
    setAvatar(testimonial.avatar || '');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const method = creating ? 'POST' : 'PUT';
      const payload: Record<string, unknown> = {
        name,
        role,
        quote,
        rating: Number(rating),
        avatar: avatar || undefined,
      };
      if (!creating) {
        payload.id = editing!.id;
      }

      const res = await adminFetch('/api/admin/testimonials', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save testimonial');

      const data = await res.json();
      if (creating) {
        setTestimonials((prev) => [...prev, data.testimonial]);
      } else {
        setTestimonials((prev) =>
          prev.map((t) => (t.id === data.testimonial.id ? data.testimonial : t))
        );
      }

      resetForm();
      setMessage(creating ? 'Testimonial created' : 'Testimonial updated');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this testimonial?')) return;

    try {
      const res = await adminFetch('/api/admin/testimonials', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Failed to delete');
      setTestimonials((prev) => prev.filter((t) => t.id !== id));
      if (editing?.id === id) resetForm();
      setMessage('Testimonial deleted');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    const idx = testimonials.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= testimonials.length) return;

    const reordered = [...testimonials];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    setTestimonials(reordered);

    // Persist reorder by updating both items
    try {
      await adminFetch('/api/admin/testimonials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reordered[idx]),
      });
      await adminFetch('/api/admin/testimonials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reordered[swapIdx]),
      });
    } catch {
      setMessage('Error: Failed to save new order');
      setTimeout(() => setMessage(''), 3000);
    }
  }

  function handleExportCSV() {
    const header = 'id,name,role,rating,quote,avatar';
    const escape = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    const rows = testimonials.map((t) =>
      [
        escape(t.id),
        escape(t.name),
        escape(t.role),
        String(t.rating),
        escape(t.quote),
        escape(t.avatar || ''),
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    link.download = `testimonials-export-${today}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const showForm = creating || editing;
  const inputClasses =
    'w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]';

  const avgRating = testimonials.length > 0
    ? (testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length).toFixed(1)
    : '0';

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-display font-bold text-white">Testimonials</h2>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 border border-[#C9A84C]/40 text-[#C9A84C] text-sm font-semibold rounded-sm hover:bg-[#C9A84C]/10 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors"
          >
            + New Testimonial
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-white/40 mb-1">Total Testimonials</p>
            <p className="text-xl font-semibold text-white">{testimonials.length}</p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">Average Rating</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-semibold text-[#C9A84C]">{avgRating}</p>
              <StarRating rating={Math.round(Number(avgRating))} />
            </div>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">5-Star Reviews</p>
            <p className="text-xl font-semibold text-[#1BBFA1]">{testimonials.filter(t => t.rating === 5).length}</p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">With Avatars</p>
            <p className="text-xl font-semibold text-white">{testimonials.filter(t => t.avatar).length}</p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 px-4 py-2 rounded-sm text-sm ${
            message.startsWith('Error')
              ? 'bg-red-400/10 text-red-400'
              : 'bg-[#1BBFA1]/10 text-[#1BBFA1]'
          }`}
        >
          {message}
        </div>
      )}

      {showForm && (
        <div className="mb-8 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">
            {creating ? 'Add Testimonial' : `Edit: ${editing!.name}`}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Role</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Event Attendee"
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Rating</label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className={inputClasses}
              >
                <option value={5}>5 Stars</option>
                <option value={4}>4 Stars</option>
                <option value={3}>3 Stars</option>
                <option value={2}>2 Stars</option>
                <option value={1}>1 Star</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Avatar URL</label>
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://..."
                className={inputClasses}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-white/40 mb-1">Quote</label>
              <textarea
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                required
                rows={3}
                className={`${inputClasses} resize-none`}
              />
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] disabled:opacity-50"
              >
                {saving ? 'Saving...' : creating ? 'Add Testimonial' : 'Update'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border border-white/30 text-white/40 text-sm rounded-sm hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-[320px]">
          {testimonials.map((testimonial, idx) => (
            <div
              key={testimonial.id}
              className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {testimonial.avatar ? (
                    <img src={testimonial.avatar} alt={testimonial.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
                      <span className="text-[#C9A84C] text-sm font-semibold">{testimonial.name.charAt(0)}</span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-white font-semibold text-sm">{testimonial.name}</h3>
                    {testimonial.role && (
                      <p className="text-white/40 text-xs">{testimonial.role}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => handleMove(testimonial.id, 'up')}
                    disabled={idx === 0}
                    className="text-xs text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    &#9650;
                  </button>
                  <button
                    onClick={() => handleMove(testimonial.id, 'down')}
                    disabled={idx === testimonials.length - 1}
                    className="text-xs text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    &#9660;
                  </button>
                  <button
                    onClick={() => startEdit(testimonial)}
                    className="text-xs text-[#1BBFA1] hover:text-[#1BBFA1]/80"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(testimonial.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mb-2">
                <StarRating rating={testimonial.rating} />
              </div>
              <p className="text-white/60 text-xs leading-relaxed line-clamp-3">{testimonial.quote}</p>
            </div>
          ))}
          {testimonials.length === 0 && (
            <p className="text-white/40 text-sm col-span-full text-center py-8">
              No testimonials yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
