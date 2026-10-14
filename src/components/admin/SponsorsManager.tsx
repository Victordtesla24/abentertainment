'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { uploadFile } from '@/lib/upload-helper';

import { useState, useMemo, useEffect, useRef, FormEvent } from 'react';
import type { Sponsor, Event, GalleryImage } from '@/lib/data';
import { sortByAdminOrder } from '@/lib/event-display';
import { eventLinksOfSponsor, MAX_EVENTS_PER_SPONSOR } from '@/lib/event-sponsors';
import GalleryPicker from './GalleryPicker';
import LinkPicker, { choiceProblems, type LinkChoice, type LinkOption } from './LinkPicker';

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
const MAX_LABEL_LENGTH = 40;
// Suggestions for the free-text Category field (it accepts anything).
const CATEGORY_SUGGESTIONS = ['Sponsor', 'Partner', 'Sponsor & Partner'];
const NO_EVENTS: Event[] = [];
const EVENT_NOUN = { singular: 'event', plural: 'events' };
/** When a saved change reaches the public event pages (they are rebuilt from the live data; open pages check for updates themselves). */
const EVENTS_PUBLIC_NOTE =
  'Saved changes show on the public event pages within about 5 minutes (a visitor who has a page open sees them sooner). The same links appear in the Events tab.';
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg';
/** Control characters (including newlines and tabs) have no place in a one-line label such as the tier. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

// Colours for the classic tiers (matched case-insensitively); any other tier text gets the neutral style.
// Maps rather than plain objects, so free text such as "constructor" cannot hit an inherited property.
const TIER_STYLES = new Map<string, string>([
  ['platinum', 'bg-purple-400/20 text-purple-300'],
  ['gold', 'bg-[#C9A84C]/20 text-[#C9A84C]'],
  ['silver', 'bg-gray-400/20 text-gray-300'],
  ['bronze', 'bg-orange-400/20 text-orange-300'],
]);
const NEUTRAL_TIER_STYLE = 'bg-white/10 text-white/60';
const CLASSIC_TIER_RANK = new Map<string, number>([['platinum', 0], ['gold', 1], ['silver', 2], ['bronze', 3]]);

interface FormState {
  name: string;
  companyName: string;
  logo: string;
  url: string;
  tier: string;
  category: string;
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
  tier: '',
  category: '',
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

function tierStyle(tier: string | undefined): string {
  return TIER_STYLES.get((tier ?? '').trim().toLowerCase()) ?? NEUTRAL_TIER_STYLE;
}

/**
 * The distinct tiers in use, matched case-insensitively and shown with the
 * spelling seen first; empty tiers are skipped. The classic four come first in
 * their usual order, then any other tier in order of first appearance.
 */
function tierGroups(sponsors: Sponsor[]): { label: string; count: number }[] {
  const groups = new Map<string, { label: string; count: number }>();
  for (const sponsor of sponsors) {
    const label = (sponsor.tier ?? '').trim();
    if (!label) continue;
    const group = groups.get(label.toLowerCase());
    if (group) group.count += 1;
    else groups.set(label.toLowerCase(), { label, count: 1 });
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (CLASSIC_TIER_RANK.get(a) ?? 99) - (CLASSIC_TIER_RANK.get(b) ?? 99))
    .map(([, group]) => group);
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

  for (const [value, label] of [[form.tier, 'Tier'], [form.category, 'Category']] as const) {
    const text = value.trim();
    if (text.length > MAX_LABEL_LENGTH) problems.push(`${label} must be ${MAX_LABEL_LENGTH} characters or fewer`);
    else if (CONTROL_CHARACTERS.test(text)) problems.push(`${label} must not contain control characters`);
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

export default function SponsorsManager({ initialSponsors, allEvents = NO_EVENTS, allGallery = [] }: SponsorsManagerProps) {
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  // The events the picker offers and whose links the cards show. They follow the dashboard, and the form refreshes them
  // from the server when it opens, so a link made from the Events view is never missing here.
  const [events, setEvents] = useState<Event[]>(allEvents);
  const [eventChoices, setEventChoices] = useState<LinkChoice[]>([]);
  const [eventLinksTouched, setEventLinksTouched] = useState(false);
  const eventLinksTouchedRef = useRef(false);
  const editingIdRef = useRef<string | null>(null);
  const [formError, setFormError] = useState('');
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
  useEffect(() => {
    setEvents(allEvents);
  }, [allEvents]);

  const showForm = creating || editing;

  // Bring the form into view when it opens, since the cards can be far below it.
  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showForm, editing?.id]);

  const summary = useMemo(() => {
    const totalRevenue = sponsors.reduce((sum, s) => sum + (s.revenue ?? 0), 0);
    const totalContractValue = sponsors.reduce((sum, s) => sum + (s.contractValue ?? 0), 0);
    const visibleCount = sponsors.filter(isVisible).length;
    return { total: sponsors.length, visibleCount, totalRevenue, totalContractValue, tiers: tierGroups(sponsors) };
  }, [sponsors]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /** Show a message that clears itself after 3 seconds, or after `ms` (errors stay until the next action). */
  function flash(text: string, ms = 3000) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setMessage(text);
    flashTimer.current = setTimeout(() => setMessage(''), ms);
  }

  function showError(text: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setMessage(`Error: ${text}`);
  }

  /** The category of the sponsor, when it is usable as the role a new event starts with (the same limit as a role). */
  const startingRole = form.category.trim() !== '' && form.category.trim().length <= MAX_LABEL_LENGTH && !CONTROL_CHARACTERS.test(form.category) ? form.category.trim() : 'Sponsor';

  // The events in the same order as the Events tab (the rule every list of events follows), each with its date and status.
  const eventOptions = useMemo<LinkOption[]>(
    () =>
      sortByAdminOrder(events).map((event) => ({
        id: event.id,
        title: event.title,
        detail: [event.date, event.status].filter(Boolean).join(' · ') || undefined,
        defaultRole: startingRole,
      })),
    [events, startingRole],
  );
  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);

  /**
   * Read the events from the server when the form opens: an event added, or a link made from the Events tab, is then
   * what the picker offers, and, while the admin has not changed the events yet, the form shows the links this sponsor
   * holds now.
   */
  async function refreshEvents(sponsorId: string | null) {
    let fresh: Event[] | null = null;
    try {
      const res = await adminFetch('/api/admin/events');
      const data = res.ok ? ((await res.json()) as { events?: Event[] }) : null;
      fresh = Array.isArray(data?.events) ? data.events : null;
    } catch {
      fresh = null;
    }
    if (!fresh) return;
    setEvents(fresh);
    if (sponsorId && !eventLinksTouchedRef.current && editingIdRef.current === sponsorId) {
      setEventChoices(eventLinksOfSponsor(fresh, sponsorId).map((link) => ({ id: link.eventId, role: link.role })));
    }
  }

  function changeEventChoices(next: LinkChoice[]) {
    setEventChoices(next);
    setEventLinksTouched(true);
    eventLinksTouchedRef.current = true;
    setFormError('');
  }

  function resetEventChoices(choices: LinkChoice[], sponsorId: string | null) {
    setEventChoices(choices);
    setEventLinksTouched(false);
    eventLinksTouchedRef.current = false;
    editingIdRef.current = sponsorId;
    setFormError('');
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(false);
    resetEventChoices([], null);
  }

  function startCreate() {
    resetForm();
    setMessage('');
    setCreating(true);
    void refreshEvents(null);
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
      tier: sponsor.tier ?? '',
      category: sponsor.category ?? '',
      description: sponsor.description || '',
      revenue: sponsor.revenue != null ? String(sponsor.revenue) : '',
      contractValue: sponsor.contractValue != null ? String(sponsor.contractValue) : '',
      visible: isVisible(sponsor),
    });
    resetEventChoices(
      eventLinksOfSponsor(events, sponsor.id).map((link) => ({ id: link.eventId, role: link.role })),
      sponsor.id,
    );
    void refreshEvents(sponsor.id);
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

    // The events go with the request when this is a new sponsor that has some, or when the admin changed them in this
    // form: an edit that left them alone must not overwrite what the Events tab saved in the meantime.
    const sendLinks = creating ? eventChoices.length > 0 : eventLinksTouched;
    if (sendLinks) {
      const linkProblems = choiceProblems(eventChoices, eventOptions, EVENT_NOUN, MAX_EVENTS_PER_SPONSOR);
      if (linkProblems.length > 0) {
        setFormError(linkProblems.join('; '));
        return;
      }
    }

    setSaving(true);
    setMessage('');
    setFormError('');

    try {
      const method = creating ? 'POST' : 'PUT';
      const amount = (value: string): number | null | undefined =>
        value !== '' ? Number(value) : creating ? undefined : null;
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        companyName: form.companyName.trim(),
        logo: form.logo.trim(),
        url: form.url.trim(),
        tier: form.tier.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        visible: form.visible,
        revenue: amount(form.revenue),
        contractValue: amount(form.contractValue),
      };
      if (!creating) {
        payload.id = editing!.id;
      }
      if (sendLinks) {
        payload.eventLinks = eventChoices.map((choice) => ({ eventId: choice.id, role: choice.role.trim() }));
      }

      const res = await adminFetch('/api/admin/sponsors', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const failed = await res.json().catch(() => ({})) as { error?: string; sponsor?: Sponsor };
        if (failed.sponsor) {
          // Saved, but its events could not be updated: keep the form open on the saved sponsor, so saving again retries
          // the events and never creates the sponsor a second time.
          const saved = failed.sponsor;
          setSponsors((prev) => (prev.some((s) => s.id === saved.id) ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved]).sort(byDisplayOrder));
          setCreating(false);
          setEditing(saved);
          editingIdRef.current = saved.id;
        } else if (sendLinks && res.status === 400 && failed.error) {
          setFormError(failed.error);
        }
        throw new Error(failed.error || 'Failed to save sponsor');
      }

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
      flash(`${created ? 'Sponsor created' : 'Sponsor updated'}${sendLinks ? '. Its events show it within about 5 minutes.' : ''}`, sendLinks ? 8000 : 3000);
      if (sendLinks) void refreshEvents(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sponsor: Sponsor) {
    if (!confirm(`Delete "${sponsor.name}"? It will be removed from the website carousel, the Sponsors page and every event it is attached to.`)) return;

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
      void refreshEvents(null);
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
    const header = 'id,name,tier,revenue,contractValue,url,companyName,visible,category';
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
        escape(s.tier ?? ''),
        s.revenue != null ? String(s.revenue) : '',
        s.contractValue != null ? String(s.contractValue) : '',
        escape(s.url),
        escape(companyNameOf(s)),
        isVisible(s) ? 'true' : 'false',
        escape(s.category ?? ''),
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
              {summary.tiers.length === 0 ? (
                <span className="text-xs text-white/30">None set</span>
              ) : (
                summary.tiers.map((group) => (
                  <span
                    key={group.label.toLowerCase()}
                    className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-sm ${tierStyle(group.label)}`}
                  >
                    {group.label} {group.count}
                  </span>
                ))
              )}
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
              <label htmlFor="sponsor-category" className="block text-xs text-white/40 mb-1">Category</label>
              <input
                id="sponsor-category"
                type="text"
                list="sponsor-category-options"
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                placeholder="Sponsor, Partner or Sponsor & Partner"
                maxLength={MAX_LABEL_LENGTH}
                autoComplete="off"
                className={inputClasses}
              />
              {/* Suggestions only: the category stays free text; the website shows it in the carousel only. */}
              <datalist id="sponsor-category-options">
                {CATEGORY_SUGGESTIONS.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="sponsor-tier" className="block text-xs text-white/40 mb-1">Tier</label>
              <input
                id="sponsor-tier"
                type="text"
                list="sponsor-tier-options"
                value={form.tier}
                onChange={(e) => setField('tier', e.target.value)}
                placeholder="e.g. Platinum, Gold, Media Partner"
                maxLength={MAX_LABEL_LENGTH}
                autoComplete="off"
                className={inputClasses}
              />
              {/* Suggestions only: the tier stays free text. */}
              <datalist id="sponsor-tier-options">
                {summary.tiers.map((group) => (
                  <option key={group.label.toLowerCase()} value={group.label} />
                ))}
              </datalist>
            </div>
            <div className="md:col-span-2">
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
            <div className="md:col-span-2 border-t border-[#C9A84C]/15 pt-4">
              <LinkPicker
                idPrefix="sponsor-events"
                label="Events"
                noun={EVENT_NOUN}
                options={eventOptions}
                value={eventChoices}
                onChange={changeEventChoices}
                ordered={false}
                publicNote={EVENTS_PUBLIC_NOTE}
                notice={!form.visible && eventChoices.length > 0 ? 'This sponsor is hidden, so it stays off these event pages until it is shown on the website.' : undefined}
                disabled={saving}
                labelClassName="block text-xs text-white/40"
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
            {formError && (
              <p role="alert" className="md:col-span-2 border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-400">
                {formError}
              </p>
            )}
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
                    {(sponsor.category ?? '').trim() && (
                      <p className="text-[#C9A84C]/70 text-xs mt-0.5 break-words">
                        <span className="text-white/30">Category </span>
                        {sponsor.category?.trim()}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {(sponsor.tier ?? '').trim() && (
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-sm ${tierStyle(sponsor.tier)}`}
                        >
                          {sponsor.tier.trim()}
                        </span>
                      )}
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
                {/* Linked Events: the same links the Events tab shows, with the role this sponsor holds at each */}
                {eventLinksOfSponsor(events, sponsor.id).filter((link) => eventsById.has(link.eventId)).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <p className="text-[9px] text-white/50 mb-1">LINKED EVENTS</p>
                    <div className="flex flex-wrap gap-1">
                      {eventLinksOfSponsor(events, sponsor.id).filter((link) => eventsById.has(link.eventId)).map((link) => (
                        <span key={link.eventId} className="text-[10px] px-1.5 py-0.5 bg-white/5 text-white/60 rounded-sm">
                          {eventsById.get(link.eventId)?.title}
                          {link.role && <span className="text-[#C9A84C]/80"> · {link.role}</span>}
                        </span>
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
