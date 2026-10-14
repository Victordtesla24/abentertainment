'use client';
import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import type { SendingStatus } from '@/lib/email/sender';
import type { BrandGuidelines, EmailSettings } from '@/lib/email/types';
import { Flash, JSON_HEADERS, buttonClasses, cardClasses, errorText, fieldClasses, formatDate, goldButtonClasses, labelClasses, useFlash, useLatestRequest } from './shared';

/**
 * The written brand voice every email is judged against, and the rules of the quality gate (how many times the AI may
 * reword, the pass mark, the hourly sending cap, the domains a link may point to, the review model).
 * Saving changed guidelines raises their version, which voids every template approval until it is reviewed again.
 */

const MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Default: Claude Opus 5.5, then Claude Sonnet 5.5, then OpenAI' },
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 (Anthropic)' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (Anthropic)' },
  { value: 'gpt-4.1', label: 'GPT-4.1 (OpenAI)' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini (OpenAI)' },
];
const CUSTOM = '__custom__';

interface GuidelinesResponse {
  guidelines: BrandGuidelines;
  limits: { min: number; max: number };
}

export default function GuidelinesPanel() {
  const { flash, show } = useFlash();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [guidelines, setGuidelines] = useState<BrandGuidelines | null>(null);
  const [limits, setLimits] = useState({ min: 200, max: 20000 });
  const [text, setText] = useState('');
  const [savingText, setSavingText] = useState(false);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [form, setForm] = useState({ maxFixRounds: '3', qualityThreshold: '85', hourlyCap: '30', allowedLinkDomains: '', reviewModel: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [reviewer, setReviewer] = useState<SendingStatus['reviewer'] | null>(null);
  const [aiProviders, setAiProviders] = useState<string[]>([]);
  const [customModel, setCustomModel] = useState(false);
  const begin = useLatestRequest();

  const applySettings = useCallback((next: EmailSettings) => {
    setSettings(next);
    setCustomModel(!MODEL_OPTIONS.some((option) => option.value === next.reviewModel));
    setForm({
      maxFixRounds: String(next.maxFixRounds),
      qualityThreshold: String(next.qualityThreshold),
      hourlyCap: String(next.hourlyCap),
      allowedLinkDomains: next.allowedLinkDomains.join('\n'),
      reviewModel: next.reviewModel,
    });
  }, []);

  const load = useCallback(async () => {
    const isLatest = begin();
    setLoading(true);
    setLoadError('');
    try {
      const [g, s, st] = await Promise.all([adminFetch('/api/admin/newsletter/guidelines'), adminFetch('/api/admin/newsletter/settings'), adminFetch('/api/admin/newsletter/status')]);
      if (!g.ok) throw new Error(await errorText(g, 'Could not load the brand guidelines.'));
      if (!s.ok) throw new Error(await errorText(s, 'Could not load the email settings.'));
      const gBody = (await g.json()) as GuidelinesResponse;
      const sBody = (await s.json()) as { settings: EmailSettings };
      const status = st.ok ? ((await st.json()) as SendingStatus) : null;
      if (!isLatest()) return;
      setGuidelines(gBody.guidelines);
      setLimits(gBody.limits);
      setText(gBody.guidelines.text);
      applySettings(sBody.settings);
      if (status) {
        setReviewer(status.reviewer);
        setAiProviders(status.ai.providers);
      }
    } catch (err) {
      if (isLatest()) setLoadError(err instanceof Error ? err.message : 'Could not load the guidelines.');
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [applySettings, begin]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveText() {
    if (!guidelines) return;
    if (text === guidelines.text) return;
    if (!confirm('Saving changed guidelines means every email template must pass the quality review again before it can be sent. Continue?')) return;
    setSavingText(true);
    try {
      const res = await adminFetch('/api/admin/newsletter/guidelines', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ text }) });
      if (!res.ok) throw new Error(await errorText(res, 'Could not save the guidelines.'));
      const body = (await res.json()) as { guidelines: BrandGuidelines };
      setGuidelines(body.guidelines);
      setText(body.guidelines.text);
      show(`Guidelines saved as version ${body.guidelines.version}. Templates need a new quality review.`);
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not save the guidelines.', true);
    } finally {
      setSavingText(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const domains = form.allowedLinkDomains.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean);
      const payload = {
        maxFixRounds: Number(form.maxFixRounds),
        qualityThreshold: Number(form.qualityThreshold),
        hourlyCap: Number(form.hourlyCap),
        allowedLinkDomains: domains,
        reviewModel: form.reviewModel.trim(),
      };
      const res = await adminFetch('/api/admin/newsletter/settings', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await errorText(res, 'Could not save the settings.'));
      const body = (await res.json()) as { settings: EmailSettings };
      applySettings(body.settings);
      show('Settings saved.');
      // the order the reviewer will now try its models in
      const st = await adminFetch('/api/admin/newsletter/status');
      if (st.ok) setReviewer(((await st.json()) as SendingStatus).reviewer);
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not save the settings.', true);
    } finally {
      setSavingSettings(false);
    }
  }

  const textTooShort = text.trim().length < limits.min;
  const textTooLong = text.length > limits.max;

  return (
    <div data-testid="brand-guidelines">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Brand guidelines</h2>
          <p className="text-white/30 text-[11px] mt-0.5">The voice every email is reviewed against, and the rules of the quality check</p>
        </div>
        <button onClick={load} className={buttonClasses}>
          Reload
        </button>
      </div>
      <Flash flash={flash} />

      {loading && !guidelines ? (
        <div className={`${cardClasses} p-8 text-center`}>
          <p className="text-white/25 text-sm font-body">Loading...</p>
        </div>
      ) : loadError ? (
        <div role="alert" className="bg-[#0A0A0A] border border-red-400/20 rounded-sm p-8 text-center">
          <p className="text-red-400 text-sm font-body">{loadError}</p>
        </div>
      ) : guidelines && settings ? (
        <div className="space-y-6">
          <section className={`${cardClasses} p-5`} aria-labelledby="guidelines-heading">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 id="guidelines-heading" className="text-base font-display font-bold text-white">
                Voice and tone guidelines
              </h3>
              <p className="text-[11px] text-white/35 font-body">
                Version {guidelines.version}, saved {formatDate(guidelines.updatedAt)} by {guidelines.updatedBy}
              </p>
            </div>
            <label htmlFor="guidelines-text" className="sr-only">
              Brand guidelines
            </label>
            <textarea
              id="guidelines-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={18}
              spellCheck
              className={`${fieldClasses} font-mono text-[12px] leading-relaxed`}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className={`text-[11px] font-body ${textTooShort || textTooLong ? 'text-red-400' : 'text-white/35'}`}>
                {text.length.toLocaleString('en-AU')} of {limits.max.toLocaleString('en-AU')} characters (at least {limits.min})
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setText(guidelines.text)} disabled={text === guidelines.text} className={buttonClasses}>
                  Discard changes
                </button>
                <button onClick={saveText} disabled={savingText || text === guidelines.text || textTooShort || textTooLong} className={goldButtonClasses}>
                  {savingText ? 'Saving...' : 'Save guidelines'}
                </button>
              </div>
            </div>
          </section>

          <section className={`${cardClasses} p-5`} aria-labelledby="settings-heading">
            <h3 id="settings-heading" className="text-base font-display font-bold text-white mb-3">
              Quality check and sending rules
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="setting-rounds" className={labelClasses}>
                  Fix rounds (1 to 6)
                </label>
                <input id="setting-rounds" type="number" min={1} max={6} value={form.maxFixRounds} onChange={(e) => setForm({ ...form, maxFixRounds: e.target.value })} className={fieldClasses} />
                <p className="text-[11px] text-white/30 mt-1">How many times the AI may reword a failing email before the review gives up.</p>
              </div>
              <div>
                <label htmlFor="setting-threshold" className={labelClasses}>
                  Pass mark (60 to 100)
                </label>
                <input id="setting-threshold" type="number" min={60} max={100} value={form.qualityThreshold} onChange={(e) => setForm({ ...form, qualityThreshold: e.target.value })} className={fieldClasses} />
                <p className="text-[11px] text-white/30 mt-1">Every score (content, brand, tone, language, quality) must reach this.</p>
              </div>
              <div>
                <label htmlFor="setting-cap" className={labelClasses}>
                  Emails per hour (1 to 500)
                </label>
                <input id="setting-cap" type="number" min={1} max={500} value={form.hourlyCap} onChange={(e) => setForm({ ...form, hourlyCap: e.target.value })} className={fieldClasses} />
                <p className="text-[11px] text-white/30 mt-1">The most emails the site sends in any hour (welcome and test emails together).</p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="setting-model" className={labelClasses}>
                  Reviewer model
                </label>
                <select
                  id="setting-model"
                  value={customModel ? CUSTOM : form.reviewModel}
                  onChange={(e) => {
                    if (e.target.value === CUSTOM) {
                      setCustomModel(true);
                      setForm({ ...form, reviewModel: '' });
                    } else {
                      setCustomModel(false);
                      setForm({ ...form, reviewModel: e.target.value });
                    }
                  }}
                  className={fieldClasses}
                >
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value || 'default'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value={CUSTOM}>Another model id…</option>
                </select>
                {customModel && (
                  <div className="mt-2">
                    <label htmlFor="setting-model-custom" className="sr-only">
                      Model id
                    </label>
                    <input id="setting-model-custom" type="text" value={form.reviewModel} onChange={(e) => setForm({ ...form, reviewModel: e.target.value })} placeholder="For example claude-haiku-4-5" className={fieldClasses} maxLength={80} />
                  </div>
                )}
                <p className="text-[11px] text-white/30 mt-1">
                  The model that judges every email. The provider that serves it is tried first and the others follow as fallbacks, so one provider being down never stops a review.
                  Changing it does not void any approval: each approved version records which model approved it, and a version can be reviewed again to have the new model judge it.
                </p>
                <p className="text-[11px] text-white/45 mt-1" data-testid="reviewer-chain">
                  {aiProviders.length === 0
                    ? 'No AI provider key is configured on the server, so no review can run.'
                    : reviewer && reviewer.chain.length > 0
                      ? `Tried in order: ${reviewer.chain.map((attempt) => `${attempt.provider} ${attempt.model}`).join(', then ')}.`
                      : ''}
                </p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="setting-domains" className={labelClasses}>
                  Domains a link may point to (one per line)
                </label>
                <textarea id="setting-domains" rows={4} value={form.allowedLinkDomains} onChange={(e) => setForm({ ...form, allowedLinkDomains: e.target.value })} className={`${fieldClasses} font-mono text-[12px]`} />
                <p className="text-[11px] text-white/30 mt-1">A domain also allows its subdomains. Links in an email to any other domain fail the quality check.</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[11px] text-white/30 font-body">Settings saved {formatDate(settings.updatedAt)}</p>
              <button onClick={saveSettings} disabled={savingSettings} className={goldButtonClasses}>
                {savingSettings ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
