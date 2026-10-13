'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useEffect, useRef, useState, FormEvent } from 'react';
import type { SiteMetric, SiteMetricSuffix } from '@/lib/data';
import {
  MAX_METRIC_LABEL_LENGTH,
  MAX_SITE_METRICS,
  formatMetricValue,
  sortMetrics,
  toPublicSiteMetrics,
  validateNewMetric,
  type MetricField,
} from '@/lib/site-metrics';

interface SiteMetricsManagerProps {
  initialMetrics: SiteMetric[];
}

interface FormState {
  label: string;
  value: string;
  suffix: SiteMetricSuffix;
  visible: boolean;
}

const EMPTY_FORM: FormState = { label: '', value: '', suffix: '', visible: true };

const SUFFIX_OPTIONS: { value: SiteMetricSuffix; label: string }[] = [
  { value: '', label: 'None' },
  { value: '+', label: '+ (and more)' },
  { value: 'K', label: 'K (thousand)' },
  { value: 'M', label: 'M (million)' },
  { value: '%', label: '% (percent)' },
];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** "25,000+" is the longest figure the site's tiles are designed around; anything longer risks being clipped on phones. */
const LONG_FIGURE_LENGTH = 7;

/** The most useful explanation of a failed admin request. */
async function readError(res: Response): Promise<string> {
  if (res.status === 401) return 'Your session has expired. Please sign in again.';
  try {
    const data = await res.json();
    if (data && typeof data.error === 'string') return data.error;
  } catch {
    // The body was not JSON; fall through to the status line.
  }
  return `Request failed (${res.status})`;
}

function formToPayload(form: FormState): Record<string, unknown> {
  const valueText = form.value.trim();
  return {
    label: form.label,
    value: valueText === '' ? undefined : Number(valueText),
    suffix: form.suffix,
    visible: form.visible,
  };
}

export default function SiteMetricsManager({ initialMetrics }: SiteMetricsManagerProps) {
  const [metrics, setMetrics] = useState<SiteMetric[]>(() => sortMetrics(initialMetrics));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SiteMetric | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<{ field: MetricField; error: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showMessage(text: string) {
    if (messageTimer.current) clearTimeout(messageTimer.current);
    setMessage(text);
    messageTimer.current = setTimeout(() => setMessage(''), text.startsWith('Error') ? 6000 : 3000);
  }

  // Pick up changes made elsewhere (another session, the AI agent) since the
  // dashboard loaded its copy.
  useEffect(() => {
    let cancelled = false;
    adminFetch('/api/admin/metrics', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res));
        const data = await res.json();
        if (!cancelled && Array.isArray(data.metrics)) setMetrics(sortMetrics(data.metrics));
      })
      .catch((err) => {
        if (!cancelled) showMessage(`Error: ${err instanceof Error ? err.message : 'Could not refresh the metrics'}`);
      });
    return () => {
      cancelled = true;
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditing(null);
    setCreating(false);
  }

  function startCreate() {
    resetForm();
    setCreating(true);
  }

  function startEdit(metric: SiteMetric) {
    setCreating(false);
    setFormError(null);
    setEditing(metric);
    setForm({ label: metric.label, value: String(metric.value), suffix: metric.suffix, visible: metric.visible });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    const payload = formToPayload(form);
    // The form always carries every field, so create and edit share the same completeness check.
    const checked = validateNewMetric(payload);
    if (!checked.ok) {
      setFormError({ field: checked.field, error: checked.error });
      return;
    }
    setFormError(null);
    setSaving(true);

    try {
      const res = await adminFetch('/api/admin/metrics', {
        method: creating ? 'POST' : 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(creating ? payload : { ...payload, id: editing!.id }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      setMetrics((prev) =>
        sortMetrics(creating ? [...prev, data.metric] : prev.map((m) => (m.id === data.metric.id ? data.metric : m))),
      );
      showMessage(creating ? 'Metric added — live on the site now' : 'Metric updated — live on the site now');
      resetForm();
    } catch (err) {
      showMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleVisible(metric: SiteMetric) {
    setBusy(true);
    try {
      const res = await adminFetch('/api/admin/metrics', {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ id: metric.id, visible: !metric.visible }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      setMetrics((prev) => prev.map((m) => (m.id === data.metric.id ? data.metric : m)));
      showMessage(data.metric.visible ? `"${metric.label}" is now shown on the site` : `"${metric.label}" is now hidden from the site`);
    } catch (err) {
      showMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(metric: SiteMetric) {
    if (!confirm(`Delete the "${metric.label}" metric? It will disappear from every page that shows it.`)) return;

    setBusy(true);
    try {
      const res = await adminFetch('/api/admin/metrics', {
        method: 'DELETE',
        headers: JSON_HEADERS,
        body: JSON.stringify({ id: metric.id }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setMetrics((prev) => prev.filter((m) => m.id !== metric.id).map((m, i) => ({ ...m, displayOrder: i })));
      if (editing?.id === metric.id) resetForm();
      showMessage('Metric deleted');
    } catch (err) {
      showMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= metrics.length) return;

    const previous = metrics;
    const reordered = [...metrics];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    setMetrics(reordered.map((m, i) => ({ ...m, displayOrder: i })));

    setBusy(true);
    try {
      const res = await adminFetch('/api/admin/metrics', {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ order: reordered.map((m) => m.id) }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      setMetrics(sortMetrics(data.metrics));
    } catch (err) {
      setMetrics(previous);
      showMessage(`Error: ${err instanceof Error ? err.message : 'Failed to save the new order'}`);
    } finally {
      setBusy(false);
    }
  }

  const visibleMetrics = toPublicSiteMetrics(metrics);
  const atLimit = metrics.length >= MAX_SITE_METRICS;
  const showForm = creating || editing;
  const draftValue = form.value.trim() === '' ? NaN : Number(form.value);
  const draftPreview = Number.isFinite(draftValue) && draftValue >= 0 ? formatMetricValue(draftValue, form.suffix) : '—';

  const inputClasses =
    'w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]';
  const errorFor = (field: MetricField) =>
    formError?.field === field ? (
      <p role="alert" className="mt-1 text-xs text-red-400">
        {formError.error}
      </p>
    ) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Site Metrics</h2>
          <p className="text-xs font-body text-white/30 mt-1">
            {metrics.length} metric{metrics.length !== 1 ? 's' : ''}, {visibleMetrics.length} visible. These numbers appear on the
            landing page, the About page, the hero slideshow and the site chatbot, and changes go live immediately.
          </p>
        </div>
        <button
          onClick={startCreate}
          disabled={atLimit}
          title={atLimit ? `At most ${MAX_SITE_METRICS} metrics are allowed` : undefined}
          className="px-4 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          + New Metric
        </button>
      </div>

      {/* Visitor preview */}
      <div className="mb-6 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
        <p className="text-xs text-white/40 mb-3">What visitors see</p>
        {visibleMetrics.length > 0 ? (
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {visibleMetrics.map((metric) => (
              <div key={metric.id} className="text-center">
                <p className="text-xl font-display font-bold text-[#C9A84C]">{formatMetricValue(metric.value, metric.suffix)}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-body">{metric.label}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/40">No metrics are visible, so the metrics blocks are hidden on the site.</p>
        )}
      </div>

      {message && (
        <div
          role="status"
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
            {creating ? 'Add Metric' : `Edit: ${editing!.label}`}
          </h3>
          <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="metric-label" className="block text-xs text-white/40 mb-1">Label</label>
              <input
                id="metric-label"
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                maxLength={MAX_METRIC_LABEL_LENGTH}
                placeholder="e.g. Events"
                required
                className={inputClasses}
              />
              {errorFor('label')}
            </div>
            <div>
              <label htmlFor="metric-value" className="block text-xs text-white/40 mb-1">Value</label>
              <input
                id="metric-value"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0"
                required
                className={inputClasses}
              />
              {errorFor('value')}
            </div>
            <div>
              <label htmlFor="metric-suffix" className="block text-xs text-white/40 mb-1">Suffix</label>
              <select
                id="metric-suffix"
                value={form.suffix}
                onChange={(e) => setForm({ ...form, suffix: e.target.value as SiteMetricSuffix })}
                className={inputClasses}
              >
                {SUFFIX_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {errorFor('suffix')}
            </div>
            <div>
              <p className="block text-xs text-white/40 mb-1">Shows on the site as</p>
              <p className="px-3 py-2 text-lg font-display font-bold text-[#C9A84C]">
                {draftPreview}
              </p>
              {draftPreview.length > LONG_FIGURE_LENGTH && (
                <p className="px-3 text-[11px] text-white/40">
                  Long figures can be cut off on small screens. Use the K or M suffix for big numbers (for example 250 with K).
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="metric-visible" className="inline-flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input
                  id="metric-visible"
                  type="checkbox"
                  checked={form.visible}
                  onChange={(e) => setForm({ ...form, visible: e.target.checked })}
                  className="accent-[#C9A84C]"
                />
                Show this metric on the site
              </label>
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] disabled:opacity-50"
              >
                {saving ? 'Saving...' : creating ? 'Add Metric' : 'Update'}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, idx) => (
          <div
            key={metric.id}
            className={`bg-[#0A0A0A] border rounded-sm p-4 ${metric.visible ? 'border-[#C9A84C]/20' : 'border-white/10'}`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className={`min-w-0 ${metric.visible ? '' : 'opacity-50'}`}>
                <p className="text-3xl font-display font-bold text-[#C9A84C] break-words">
                  {formatMetricValue(metric.value, metric.suffix)}
                </p>
                <h3 className="text-white font-semibold text-sm mt-1 break-words">{metric.label}</h3>
              </div>
              <span
                className={`flex-shrink-0 inline-block px-2 py-0.5 text-xs font-semibold rounded-sm ${
                  metric.visible ? 'bg-[#1BBFA1]/20 text-[#1BBFA1]' : 'bg-gray-400/20 text-gray-300'
                }`}
              >
                {metric.visible ? 'Visible' : 'Hidden'}
              </span>
            </div>
            <div className="flex gap-3 items-center pt-3 border-t border-white/5">
              <button
                onClick={() => handleMove(idx, 'up')}
                disabled={busy || idx === 0}
                className="text-xs text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                title="Move up"
                aria-label={`Move ${metric.label} up`}
              >
                &#9650;
              </button>
              <button
                onClick={() => handleMove(idx, 'down')}
                disabled={busy || idx === metrics.length - 1}
                className="text-xs text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                title="Move down"
                aria-label={`Move ${metric.label} down`}
              >
                &#9660;
              </button>
              <button
                onClick={() => startEdit(metric)}
                className="text-xs text-[#1BBFA1] hover:text-[#1BBFA1]/80"
              >
                Edit
              </button>
              <button
                onClick={() => handleToggleVisible(metric)}
                disabled={busy}
                className="text-xs text-[#C9A84C] hover:text-[#D4B65C] disabled:opacity-40"
              >
                {metric.visible ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={() => handleDelete(metric)}
                disabled={busy}
                className="ml-auto text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {metrics.length === 0 && (
          <p className="text-white/40 text-sm col-span-full text-center py-8">
            No metrics yet. Click &quot;+ New Metric&quot; to add one.
          </p>
        )}
      </div>
    </div>
  );
}
