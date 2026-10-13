'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { uploadFile } from '@/lib/upload-helper';

import { useState, useMemo, useEffect, useRef, FormEvent } from 'react';
import type { Sponsor, Event, GalleryImage } from '@/lib/data';
import GalleryPicker from './GalleryPicker';

interface SponsorsManagerProps {
  initialSponsors: Sponsor[];
  allEvents?: Event[];
  allGallery?: GalleryImage[];
}

// Limits mirror the server-side validation in /api/admin/sponsors and
// /api/admin/upload, which remains the authority.
const MAX_NAME_LENGTH = 80;
const MAX_URL_LENGTH = 300;
const MAX_LOGO_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg';

interface FormState {
  name: string;
  companyName: string;
  logo: string;
  url: string;
  tier: Sponsor['tier'];
  description: string;
  revenue: string;
  contractValue: string;
  visible: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  companyName: '',
  logo: '',
  url: '',
  tier: 'silver',
  description: '',
  revenue: '',
  contractValue: '',
  visible: true,
};

function isVisible(sponsor: Sponsor): boolean {
  return sponsor.visible !== false;
}

/** Company name for display; records saved before the field existed fall back to the name. */
function companyNameOf(sponsor: Sponsor): string {
  return (sponsor.companyName ?? '').trim() || (sponsor.name ?? '').trim();
}

/** Same ordering as the public site: `order` ascending (none last), then oldest first. */
function byDisplayOrder(a: Sponsor, b: Sponsor): number {
  const byOrder = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
  if (byOrder !== 0) return byOrder;
  const createdA = a.createdAt ?? '';
  const createdB = b.createdAt ?? '';
  return createdA < createdB ? -1 : createdA > createdB ? 1 : 0;
}

function hasProtocol(value: string, protocols: string[]): boolean {
  if (/\s/.test(value)) return false;
  try {
    const parsed = new URL(value);
    return protocols.includes(parsed.protocol) && parsed.hostname !== '';
  } catch {
    return false;
  }
}

function isSitePath(value: string): boolean {
  return /^\/(?![/\\])[^\s\\]*$/.test(value);
}

/** Problems with the selected logo file, checked before anything is uploaded. */
function logoFileProblem(file: File): string | null {
  const dot = file.name.lastIndexOf('.');
  const extension = dot === -1 ? '' : file.name.slice(dot).toLowerCase();
  if (!LOGO_EXTENSIONS.includes(extension)) return 'Logo must be a PNG, JPG, WebP or SVG file';
  if (file.size > MAX_LOGO_BYTES) {
    return `Logo must be 2 MB or smaller (this file is ${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
  }
  return null;
}

function formProblems(form: FormState): string[] {
  const problems: string[] = [];
  const name = form.name.trim();
  const companyName = form.companyName.trim();
  const logo = form.logo.trim();
  const url = form.url.trim();

  if (!name) problems.push('Name is required');
  else if (name.length > MAX_NAME_LENGTH) problems.push(`Name must be ${MAX_NAME_LENGTH} characters or fewer`);

  if (!companyName) problems.push('Company name is required');
  else if (companyName.length > MAX_NAME_LENGTH) problems.push(`Company name must be ${MAX_NAME_LENGTH} characters or fewer`);

  if (logo.length > MAX_LOGO_LENGTH) problems.push(`Logo must be ${MAX_LOGO_LENGTH} characters or fewer`);
  else if (logo && !isSitePath(logo) && !hasProtocol(logo, ['https:'])) {
    problems.push('Logo must be an uploaded file, a site path starting with / or an https:// URL');
  }

  if (url.length > MAX_URL_LENGTH) problems.push(`Website URL must be ${MAX_URL_LENGTH} characters or fewer`);
  else if (url && !hasProtocol(url, ['http:', 'https:'])) {
    problems.push('Website URL must start with http:// or https:// (for example https://example.com)');
  }

  if (form.description.trim().length > MAX_DESCRIPTION_LENGTH) {
    problems.push(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`);
  }

  for (const [value, label] of [[form.revenue, 'Revenue'], [form.contractValue, 'Contract value']] as const) {
    if (value !== '' && !(Number.isFinite(Number(value)) && Number(value) >= 0)) {
      problems.push(`${label} must be a number of 0 or more`);
    }
  }
  return problems;
}

/** Logo on the same white chip the website uses, with a fallback when there is no usable image. */
function LogoThumb({ src, label, large = false }: { src: string; label: string; large?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = src !== '' && failedSrc !== src;
  return (
    <div
      className={`${large ? 'w-16 h-16' : 'w-12 h-12'} flex-shrink-0 flex items-center justify-center rounded-sm bg-white/90 p-1`}
    >
      {usable ? (
        <img
          src={src}
          alt={`${label} logo`}
          className="max-w-full max-h-full object-contain"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span className="text-[9px] leading-tight text-center text-[#0A0A0A]/50">
          {src === '' ? 'No logo' : 'Image unavailable'}
        </span>
      )}
    </div>
  );
}

export default function SponsorsManager({ initialSponsors, allEvents, allGallery = [] }: SponsorsManagerProps) {
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [sponsors, setSponsors] = useState<Sponsor[]>(
    () => [...initialSponsors].sort(byDisplayOrder)
  );
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  // The dashboard re-fetches its data whenever a tab opens; follow it so this
  // list never stays behind what the server holds.
  useEffect(() => {
    setSponsors([...initialSponsors].sort(byDisplayOrder));
  }, [initialSponsors]);

  const showForm = creating || editing;

  // Bring the form into view when it opens, since the cards can be far below it.
  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showForm, editing?.id]);

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
      if (s.tier in tierCounts) tierCounts[s.tier]++;
    }
    const visibleCount = sponsors.filter(isVisible).length;
    return { total: sponsors.length, visibleCount, totalRevenue, totalContractValue, tierCounts };
  }, [sponsors]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /** Show a message that clears itself after 3 seconds (errors stay until the next action). */
  function flash(text: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setMessage(text);
    flashTimer.current = setTimeout(() => setMessage(''), 3000);
  }

  function showError(text: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setMessage(`Error: ${text}`);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(false);
  }

  function startCreate() {
    resetForm();
    setMessage('');
    setCreating(true);
  }

  function startEdit(sponsor: Sponsor) {
    setCreating(false);
    setMessage('');
    setEditing(sponsor);
    setForm({
      name: sponsor.name,
      companyName: companyNameOf(sponsor),
      logo: sponsor.logo,
      // "#" was the old placeholder for "no website"; show it as empty.
      url: sponsor.url === '#' ? '' : sponsor.url,
      tier: sponsor.tier,
      description: sponsor.description || '',
      revenue: sponsor.revenue != null ? String(sponsor.revenue) : '',
      contractValue: sponsor.contractValue != null ? String(sponsor.contractValue) : '',
      visible: isVisible(sponsor),
    });
  }

  /** Read an error message from a failed API response, falling back to a generic one. */
  async function errorFrom(res: Response, fallback: string): Promise<Error> {
    const body = await res.json().catch(() => ({})) as { error?: string };
    return new Error(body.error || fallback);
  }

  async function handleLogoFile(file: File) {
    const problem = logoFileProblem(file);
    if (problem) {
      showError(problem);
      return;
    }
    setMessage('');
    setUploading(true);
    try {
      const result = await uploadFile(file, 'sponsors');
      setField('logo', result.url);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (uploading) {
      showError('Wait for the logo upload to finish');
      return;
    }
    const problems = formProblems(form);
    if (problems.length > 0) {
      showError(problems.join('; '));
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const method = creating ? 'POST' : 'PUT';
      const amount = (value: string): number | null | undefined =>
        value !== '' ? Number(value) : creating ? undefined : null;
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        companyName: form.companyName.trim(),
        logo: form.logo.trim(),
        url: form.url.trim(),
        tier: form.tier,
        description: form.description.trim(),
        visible: form.visible,
        revenue: amount(form.revenue),
        contractValue: amount(form.contractValue),
      };
      if (!creating) {
        payload.id = editing!.id;
      }

      const res = await adminFetch('/api/admin/sponsors', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw await errorFrom(res, 'Failed to save sponsor');

      const data = await res.json() as { sponsor: Sponsor };
      if (creating) {
        setSponsors((prev) => [...prev, data.sponsor].sort(byDisplayOrder));
      } else {
        setSponsors((prev) =>
          prev.map((s) => (s.id === data.sponsor.id ? data.sponsor : s)).sort(byDisplayOrder)
        );
      }

      const created = creating;
      resetForm();
      flash(created ? 'Sponsor created' : 'Sponsor updated');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sponsor: Sponsor) {
    if (!confirm(`Delete "${sponsor.name}"? It will be removed from the website carousel and the Sponsors page.`)) return;

    setBusyId(sponsor.id);
    try {
      const res = await adminFetch('/api/admin/sponsors', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sponsor.id }),
      });

      if (!res.ok) throw await errorFrom(res, 'Failed to delete');
      setSponsors((prev) => prev.filter((s) => s.id !== sponsor.id));
      if (editing?.id === sponsor.id) resetForm();
      flash('Sponsor deleted');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleVisible(sponsor: Sponsor) {
    const nextVisible = !isVisible(sponsor);
    setBusyId(sponsor.id);
    try {
      const res = await adminFetch('/api/admin/sponsors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sponsor.id, visible: nextVisible }),
      });

      if (!res.ok) throw await errorFrom(res, 'Failed to update visibility');
      const data = await res.json() as { sponsor: Sponsor };
      setSponsors((prev) => prev.map((s) => (s.id === data.sponsor.id ? data.sponsor : s)));
      flash(nextVisible ? `${sponsor.name} is now shown on the website` : `${sponsor.name} is now hidden from the website`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    const idx = sponsors.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sponsors.length) return;

    const previous = sponsors;
    const reordered = [...sponsors];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    setSponsors(reordered.map((s, i) => ({ ...s, order: i })));

    // One request persists the whole order, so the server never holds a
    // half-applied reorder (and repairs gaps or duplicates in older data).
    setReordering(true);
    try {
      const res = await adminFetch('/api/admin/sponsors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: reordered.map((s) => s.id) }),
      });
      if (!res.ok) throw await errorFrom(res, 'Failed to save new order');
      const data = await res.json() as { sponsors: Sponsor[] };
      setSponsors([...data.sponsors].sort(byDisplayOrder));
    } catch (err) {
      setSponsors(previous);
      showError(err instanceof Error ? err.message : 'Failed to save new order');
    } finally {
      setReordering(false);
    }
  }

  function handleExportCSV() {
    const header = 'id,name,tier,revenue,contractValue,url,companyName,visible';
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
        escape(companyNameOf(s)),
        isVisible(s) ? 'true' : 'false',
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl font-display font-bold text-white">Sponsors &amp; Partners</h2>
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
            <p className="text-[10px] text-white/30 mt-0.5">{summary.visibleCount} shown on website</p>
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
          role={message.startsWith('Error') ? 'alert' : 'status'}
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
        <div ref={formRef} className="mb-8 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6 scroll-mt-24">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">
            {creating ? 'Add Sponsor' : `Edit: ${editing!.name}`}
          </h3>
          <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sponsor-name" className="block text-xs text-white/40 mb-1">Name</label>
              <input
                id="sponsor-name"
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
                maxLength={MAX_NAME_LENGTH}
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="sponsor-company-name" className="block text-xs text-white/40 mb-1">Company name</label>
              <input
                id="sponsor-company-name"
                type="text"
                value={form.companyName}
                onChange={(e) => setField('companyName', e.target.value)}
                required
                maxLength={MAX_NAME_LENGTH}
                className={inputClasses}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="sponsor-logo-url" className="block text-xs text-white/40 mb-1">
                Logo <span className="text-white/25">(PNG, JPG, WebP or SVG, up to 2 MB)</span>
              </label>
              <div className="flex items-center gap-3">
                <LogoThumb src={form.logo.trim()} label={form.companyName.trim() || form.name.trim() || 'Sponsor'} large />
                <div className="flex-1 flex flex-wrap gap-2">
                  <input
                    id="sponsor-logo-url"
                    type="text"
                    value={form.logo}
                    onChange={(e) => setField('logo', e.target.value)}
                    placeholder="Upload a file, or paste a logo URL"
                    maxLength={MAX_LOGO_LENGTH}
                    className="flex-1 min-w-[12rem] px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                  />
                  <input
                    type="file"
                    id="sponsor-logo-upload"
                    accept={LOGO_ACCEPT}
                    className="hidden"
                    disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) await handleLogoFile(file);
                    }}
                  />
                  <label
                    htmlFor="sponsor-logo-upload"
                    className="text-[11px] font-body px-3 py-1.5 bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20 hover:bg-[#C9A84C]/20 transition-colors cursor-pointer whitespace-nowrap flex items-center rounded-sm"
                  >
                    {uploading ? 'Uploading...' : 'Upload File'}
                  </label>
                  {allGallery.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowGalleryPicker(true)}
                      className="text-[11px] font-body px-3 py-1.5 bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20 hover:bg-[#C9A84C]/20 transition-colors whitespace-nowrap flex items-center rounded-sm"
                    >
                      Gallery
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="sponsor-website-url" className="block text-xs text-white/40 mb-1">
                Website URL <span className="text-white/25">(optional)</span>
              </label>
              <input
                id="sponsor-website-url"
                type="text"
                inputMode="url"
                value={form.url}
                onChange={(e) => setField('url', e.target.value)}
                placeholder="https://example.com"
                maxLength={MAX_URL_LENGTH}
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="sponsor-tier" className="block text-xs text-white/40 mb-1">Tier</label>
              <select
                id="sponsor-tier"
                value={form.tier}
                onChange={(e) => setField('tier', e.target.value as Sponsor['tier'])}
                className={inputClasses}
              >
                <option value="platinum">Platinum</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="bronze">Bronze</option>
              </select>
            </div>
            <div>
              <label htmlFor="sponsor-revenue" className="block text-xs text-white/40 mb-1">Revenue (AUD)</label>
              <input
                id="sponsor-revenue"
                type="number"
                min="0"
                step="0.01"
                value={form.revenue}
                onChange={(e) => setField('revenue', e.target.value)}
                placeholder="0"
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="sponsor-contract-value" className="block text-xs text-white/40 mb-1">Contract Value (AUD)</label>
              <input
                id="sponsor-contract-value"
                type="number"
                min="0"
                step="0.01"
                value={form.contractValue}
                onChange={(e) => setField('contractValue', e.target.value)}
                placeholder="0"
                className={inputClasses}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="sponsor-description" className="block text-xs text-white/40 mb-1">Description</label>
              <textarea
                id="sponsor-description"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={2}
                maxLength={MAX_DESCRIPTION_LENGTH}
                className={`${inputClasses} resize-none`}
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <button
                type="button"
                id="sponsor-visible"
                role="switch"
                aria-checked={form.visible}
                aria-labelledby="sponsor-visible-label"
                onClick={() => setField('visible', !form.visible)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                  form.visible ? 'bg-[#1BBFA1]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    form.visible ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span id="sponsor-visible-label" className="text-sm text-white/70">
                Visible on website
                <span className="ml-2 text-xs text-white/30">
                  {form.visible ? 'Shown in the carousel and on the Sponsors page' : 'Hidden from the public site'}
                </span>
              </span>
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || uploading}
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
          {sponsors.map((sponsor, idx) => {
            const company = companyNameOf(sponsor);
            const visible = isVisible(sponsor);
            const busy = busyId === sponsor.id;
            return (
              <div
                key={sponsor.id}
                data-sponsor-id={sponsor.id}
                className={`bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4 ${visible ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <LogoThumb src={sponsor.logo} label={company} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-white font-semibold text-sm break-words">{sponsor.name}</h3>
                    {company.toLowerCase() !== (sponsor.name ?? '').trim().toLowerCase() && (
                      <p className="text-white/50 text-xs mt-0.5 break-words">{company}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-sm ${tierColors[sponsor.tier] ?? tierColors.silver}`}
                      >
                        {sponsor.tier}
                      </span>
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-sm ${
                          visible ? 'bg-[#1BBFA1]/15 text-[#1BBFA1]' : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {visible ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
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
                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/5">
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => handleMove(sponsor.id, 'up')}
                      disabled={idx === 0 || reordering}
                      className="text-xs text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                      title="Move up"
                      aria-label={`Move ${sponsor.name} up`}
                    >
                      &#9650;
                    </button>
                    <button
                      onClick={() => handleMove(sponsor.id, 'down')}
                      disabled={idx === sponsors.length - 1 || reordering}
                      className="text-xs text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                      title="Move down"
                      aria-label={`Move ${sponsor.name} down`}
                    >
                      &#9660;
                    </button>
                    <button
                      onClick={() => handleToggleVisible(sponsor)}
                      disabled={busy}
                      className="text-xs text-white/50 hover:text-white disabled:opacity-40"
                      title={visible ? 'Hide from the website' : 'Show on the website'}
                      aria-label={`${visible ? 'Hide' : 'Show'} ${sponsor.name}`}
                    >
                      {visible ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => startEdit(sponsor)}
                      className="text-xs text-[#1BBFA1] hover:text-[#1BBFA1]/80"
                      aria-label={`Edit ${sponsor.name}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(sponsor)}
                      disabled={busy}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                      aria-label={`Delete ${sponsor.name}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {sponsors.length === 0 && (
            <p className="text-white/40 text-sm col-span-full text-center py-8">
              No sponsors yet.
            </p>
          )}
        </div>
      </div>

      {showGalleryPicker && (
        <GalleryPicker
          images={allGallery}
          title="Select Sponsor Logo from Gallery"
          onSelect={(img) => {
            setField('logo', img.src);
            setShowGalleryPicker(false);
          }}
          onClose={() => setShowGalleryPicker(false)}
        />
      )}
    </div>
  );
}
