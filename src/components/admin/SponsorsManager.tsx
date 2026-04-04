'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { uploadFile } from '@/lib/upload-helper';

import { useState, useMemo, FormEvent } from 'react';
import type { Sponsor, Event } from '@/lib/data';

interface SponsorsManagerProps {
  initialSponsors: Sponsor[];
  allEvents?: Event[];
}

export default function SponsorsManager({ initialSponsors, allEvents }: SponsorsManagerProps) {
  const [sponsors, setSponsors] = useState<Sponsor[]>(
    () => [...initialSponsors].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [url, setUrl] = useState('');
  const [tier, setTier] = useState<Sponsor['tier']>('silver');
  const [description, setDescription] = useState('');
  const [revenue, setRevenue] = useState<string>('');
  const [contractValue, setContractValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  const summary = useMemo(() => {
    const totalRevenue = sponsors.reduce((sum, s) => sum + (s.revenue ?? 0), 0);
    const totalContractValue = sponsors.reduce((sum, s) => sum + (s.contractValue ?? 0), 0);
    const tierCounts: Record<Sponsor['tier'], number> = {
      platinum: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
    };
    for (const s of sponsors) {
      tierCounts[s.tier]++;
    }
    return { total: sponsors.length, totalRevenue, totalContractValue, tierCounts };
  }, [sponsors]);

  function resetForm() {
    setName('');
    setLogo('');
    setUrl('');
    setTier('silver');
    setDescription('');
    setRevenue('');
    setContractValue('');
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
    setRevenue(sponsor.revenue != null ? String(sponsor.revenue) : '');
    setContractValue(sponsor.contractValue != null ? String(sponsor.contractValue) : '');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const method = creating ? 'POST' : 'PUT';
      const payload: Record<string, unknown> = {
        name,
        logo,
        url,
        tier,
        description,
        revenue: revenue !== '' ? Number(revenue) : undefined,
        contractValue: contractValue !== '' ? Number(contractValue) : undefined,
      };
      if (!creating) {
        payload.id = editing!.id;
      }

      const res = await adminFetch('/api/admin/sponsors', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      const res = await adminFetch('/api/admin/sponsors', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Failed to delete');
      setSponsors((prev) => prev.filter((s) => s.id !== id));
      if (editing?.id === id) resetForm();
      setMessage('Sponsor deleted');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    const idx = sponsors.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sponsors.length) return;

    const reordered = [...sponsors];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

    const updated = reordered.map((s, i) => ({ ...s, order: i }));
    setSponsors(updated);

    try {
      await adminFetch('/api/admin/sponsors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updated[idx].id,
          order: updated[idx].order,
        }),
      });
      await adminFetch('/api/admin/sponsors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updated[swapIdx].id,
          order: updated[swapIdx].order,
        }),
      });
    } catch {
      setMessage('Error: Failed to save new order');
      setTimeout(() => setMessage(''), 3000);
    }
  }

  function handleExportCSV() {
    const header = 'id,name,tier,revenue,contractValue,url';
    const escape = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    const rows = sponsors.map((s) =>
      [
        escape(s.id),
        escape(s.name),
        escape(s.tier),
        s.revenue != null ? String(s.revenue) : '',
        s.contractValue != null ? String(s.contractValue) : '',
        escape(s.url),
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    link.download = `sponsors-export-${today}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function formatAUD(value: number): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  const showForm = creating || editing;
  const tierColors: Record<Sponsor['tier'], string> = {
    platinum: 'bg-purple-400/20 text-purple-300',
    gold: 'bg-[#C9A84C]/20 text-[#C9A84C]',
    silver: 'bg-gray-400/20 text-gray-300',
    bronze: 'bg-orange-400/20 text-orange-300',
  };

  const inputClasses =
    'w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]';

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-display font-bold text-white">Sponsors</h2>
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
            + New Sponsor
          </button>
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="mb-6 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-white/40 mb-1">Total Sponsors</p>
            <p className="text-xl font-semibold text-white">{summary.total}</p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">Total Revenue</p>
            <p className="text-xl font-semibold text-[#1BBFA1]">
              {formatAUD(summary.totalRevenue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">Total Contract Value</p>
            <p className="text-xl font-semibold text-[#C9A84C]">
              {formatAUD(summary.totalContractValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">By Tier</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {(['platinum', 'gold', 'silver', 'bronze'] as const).map((t) => (
                <span
                  key={t}
                  className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-sm ${tierColors[t]}`}
                >
                  {t} {summary.tierCounts[t]}
                </span>
              ))}
            </div>
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
            {creating ? 'Add Sponsor' : `Edit: ${editing!.name}`}
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
              <label className="block text-xs text-white/40 mb-1">Logo URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  className={`flex-1 px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]`}
                />
                <input
                  type="file"
                  id="sponsor-logo-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const result = await uploadFile(file, 'sponsors');
                      setLogo(result.url);
                    } catch (err) {
                      setMessage(`Error: ${err instanceof Error ? err.message : 'Upload failed'}`);
                    } finally {
                      setUploading(false);
                      e.target.value = '';
                    }
                  }}
                />
                <label
                  htmlFor="sponsor-logo-upload"
                  className="text-[11px] font-body px-3 py-1.5 bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20 hover:bg-[#C9A84C]/20 transition-colors cursor-pointer whitespace-nowrap flex items-center rounded-sm"
                >
                  {uploading ? 'Uploading...' : 'Upload File'}
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Website URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Tier</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as Sponsor['tier'])}
                className={inputClasses}
              >
                <option value="platinum">Platinum</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="bronze">Bronze</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Revenue (AUD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                placeholder="0"
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Contract Value (AUD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder="0"
                className={inputClasses}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-white/40 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={`${inputClasses} resize-none`}
              />
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] disabled:opacity-50"
              >
                {saving ? 'Saving...' : creating ? 'Add Sponsor' : 'Update'}
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
          {sponsors.map((sponsor, idx) => (
            <div
              key={sponsor.id}
              className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-semibold text-sm">{sponsor.name}</h3>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-sm ${tierColors[sponsor.tier]}`}
                  >
                    {sponsor.tier}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => handleMove(sponsor.id, 'up')}
                    disabled={idx === 0}
                    className="text-xs text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    &#9650;
                  </button>
                  <button
                    onClick={() => handleMove(sponsor.id, 'down')}
                    disabled={idx === sponsors.length - 1}
                    className="text-xs text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    &#9660;
                  </button>
                  <button
                    onClick={() => startEdit(sponsor)}
                    className="text-xs text-[#1BBFA1] hover:text-[#1BBFA1]/80"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(sponsor.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {(sponsor.revenue != null || sponsor.contractValue != null) && (
                <div className="flex gap-4 mb-2 text-xs">
                  {sponsor.revenue != null && (
                    <span className="text-[#1BBFA1]">
                      Rev: {formatAUD(sponsor.revenue)}
                    </span>
                  )}
                  {sponsor.contractValue != null && (
                    <span className="text-[#C9A84C]">
                      Contract: {formatAUD(sponsor.contractValue)}
                    </span>
                  )}
                </div>
              )}
              {sponsor.description && (
                <p className="text-white/40 text-xs">{sponsor.description}</p>
              )}
              {/* Linked Events */}
              {allEvents && allEvents.filter(e => (e.sponsorIds || []).includes(sponsor.id)).length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <p className="text-[9px] text-white/30 mb-1">LINKED EVENTS</p>
                  <div className="flex flex-wrap gap-1">
                    {allEvents.filter(e => (e.sponsorIds || []).includes(sponsor.id)).map(e => (
                      <span key={e.id} className="text-[9px] px-1.5 py-0.5 bg-white/5 text-white/50 rounded-sm">{e.title}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {sponsors.length === 0 && (
            <p className="text-white/40 text-sm col-span-full text-center py-8">
              No sponsors yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
