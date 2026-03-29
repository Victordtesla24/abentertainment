'use client';
import { getApiUrl } from '@/lib/api-config';

import { useState, FormEvent } from 'react';
import type { Sponsor } from '@/lib/data';

interface SponsorsManagerProps {
  initialSponsors: Sponsor[];
}

export default function SponsorsManager({ initialSponsors }: SponsorsManagerProps) {
  const [sponsors, setSponsors] = useState<Sponsor[]>(initialSponsors);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [url, setUrl] = useState('');
  const [tier, setTier] = useState<Sponsor['tier']>('silver');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function resetForm() {
    setName('');
    setLogo('');
    setUrl('');
    setTier('silver');
    setDescription('');
    setEditing(null);
    setCreating(false);
  }

  function startCreate() {
    resetForm();
    setCreating(true);
  }

  function startEdit(sponsor: Sponsor) {
    setCreating(false);
    setEditing(sponsor);
    setName(sponsor.name);
    setLogo(sponsor.logo);
    setUrl(sponsor.url);
    setTier(sponsor.tier);
    setDescription(sponsor.description || '');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const method = creating ? 'POST' : 'PUT';
      const body = creating
        ? { name, logo, url, tier, description }
        : { id: editing!.id, name, logo, url, tier, description };

      const res = await fetch(getApiUrl('/api/admin/sponsors'), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save sponsor');

      const data = await res.json();
      if (creating) {
        setSponsors((prev) => [...prev, data.sponsor]);
      } else {
        setSponsors((prev) =>
          prev.map((s) => (s.id === data.sponsor.id ? data.sponsor : s))
        );
      }

      resetForm();
      setMessage(creating ? 'Sponsor created' : 'Sponsor updated');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this sponsor?')) return;

    try {
      const res = await fetch(getApiUrl('/api/admin/sponsors'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Failed to delete');
      setSponsors((prev) => prev.filter((s) => s.id !== id));
      setMessage('Sponsor deleted');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  const showForm = creating || editing;
  const tierColors: Record<Sponsor['tier'], string> = {
    platinum: 'bg-purple-400/20 text-purple-300',
    gold: 'bg-[#C9A84C]/20 text-[#C9A84C]',
    silver: 'bg-gray-400/20 text-gray-300',
    bronze: 'bg-orange-400/20 text-orange-300',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-display font-bold text-white">Sponsors</h2>
        <button onClick={startCreate} className="px-4 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors">
          + New Sponsor
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-sm text-sm ${message.startsWith('Error') ? 'bg-red-400/10 text-red-400' : 'bg-[#1BBFA1]/10 text-[#1BBFA1]'}`}>
          {message}
        </div>
      )}

      {showForm && (
        <div className="mb-8 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">
            {creating ? 'Add Sponsor' : `Edit: ${editing!.name}`}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[white/40] mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs text-[white/40] mb-1">Logo URL</label>
              <input type="text" value={logo} onChange={(e) => setLogo(e.target.value)} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs text-[white/40] mb-1">Website URL</label>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs text-[white/40] mb-1">Tier</label>
              <select value={tier} onChange={(e) => setTier(e.target.value as Sponsor['tier'])} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]">
                <option value="platinum">Platinum</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="bronze">Bronze</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-[white/40] mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] resize-none" />
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] disabled:opacity-50">
                {saving ? 'Saving...' : creating ? 'Add Sponsor' : 'Update'}
              </button>
              <button type="button" onClick={resetForm} className="px-6 py-2 border border-[white/40]/30 text-[white/40] text-sm rounded-sm hover:text-white">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sponsors.map((sponsor) => (
          <div key={sponsor.id} className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-white font-semibold text-sm">{sponsor.name}</h3>
                <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-sm ${tierColors[sponsor.tier]}`}>
                  {sponsor.tier}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(sponsor)} className="text-xs text-[#1BBFA1] hover:text-[#1BBFA1]/80">Edit</button>
                <button onClick={() => handleDelete(sponsor.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
              </div>
            </div>
            {sponsor.description && (
              <p className="text-[white/40] text-xs">{sponsor.description}</p>
            )}
          </div>
        ))}
        {sponsors.length === 0 && (
          <p className="text-[white/40] text-sm col-span-full text-center py-8">No sponsors yet.</p>
        )}
      </div>
    </div>
  );
}
