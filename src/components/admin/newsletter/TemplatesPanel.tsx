'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { GATE_LIMITS } from '@/lib/email/gate-rules';
import type { ApprovalState } from '@/lib/email/gate';
import { EMAIL_FIELDS, type EmailFieldName, type EmailFields, type EmailTemplate, type GateIssue, type GateResult, type GateRound, type TemplateVersion } from '@/lib/email/types';
import { RoundView, STOP_TEXT, IssueList } from './ReviewView';
import { Badge, Flash, JSON_HEADERS, buttonClasses, cardClasses, dangerButtonClasses, errorText, explainReason, fieldClasses, formatDate, goldButtonClasses, labelClasses, useFlash, useLatestRequest } from './shared';

/**
 * Email templates: add, alter and remove them in the portal. Every edit is saved as a new version; a version can only
 * be used for sending once it has passed the quality review (the automatic checks, then the AI review with fixes,
 * round by round) and been activated. The preview is the real brand layout, rendered by the server as you type.
 */

interface TemplatesResponse {
  templates: EmailTemplate[];
  states: Record<string, Record<string, ApprovalState>>;
  guidelinesVersion: number;
  layout: { id: string; version: string; installed: boolean };
  welcomeKey: string;
  limits: { fields: Record<EmailFieldName, number>; maxTemplates: number };
}

interface PreviewResponse {
  layout: { id: string; version: string; installed: boolean };
  html: string | null;
  text: string | null;
  issues: GateIssue[];
}

interface ReviewBody {
  status: 'running' | 'done' | 'error' | 'idle';
  rounds?: GateRound[];
  result?: GateResult | null;
  approvedVersion?: number | null;
  error?: string | null;
}

interface ReviewState {
  status: 'idle' | 'running' | 'done' | 'error';
  version: number | null;
  rounds: GateRound[];
  result: GateResult | null;
  approvedVersion: number | null;
  error: string;
}

const IDLE_REVIEW: ReviewState = { status: 'idle', version: null, rounds: [], result: null, approvedVersion: null, error: '' };

const FIELD_META: Array<{ name: EmailFieldName; label: string; hint: string; multiline?: boolean }> = [
  { name: 'subject', label: 'Subject', hint: `About 30 to 60 characters; inboxes cut it off after ${GATE_LIMITS.subject.max}. No exclamation mark.` },
  { name: 'preheader', label: 'Preheader', hint: `The preview text beside the subject: one sentence of ${GATE_LIMITS.preheader.min} to ${GATE_LIMITS.preheader.max} characters that continues it.` },
  { name: 'eyebrow', label: 'Eyebrow (optional)', hint: 'One to four words above the heading, such as “Welcome to”. Shown in gold capitals.' },
  { name: 'heading', label: 'Heading', hint: 'Title Case (or all capitals for a display heading).' },
  { name: 'body', label: 'Body', multiline: true, hint: `${GATE_LIMITS.body.min} to ${GATE_LIMITS.body.max} characters. A blank line starts a paragraph, “- ” starts a bullet; **bold**, *italic* and [label](https://link) work. No HTML.` },
  { name: 'ctaLabel', label: 'Button label', hint: 'A short, verb-led label such as “View All Events”. Shown in capitals.' },
  { name: 'ctaUrl', label: 'Button link', hint: 'An https link on an allowed domain.' },
];

const CREATED_BY: Record<string, string> = { seed: 'Original copy', admin: 'Edited by an admin', 'ai-fix': 'Reworded by the quality review' };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sameFields(a: EmailFields, b: EmailFields): boolean {
  return EMAIL_FIELDS.every((name) => (a[name] ?? '') === (b[name] ?? ''));
}

function latestVersion(template: EmailTemplate): TemplateVersion {
  return template.versions.reduce((best, v) => (v.version > best.version ? v : best), template.versions[0]);
}

export default function TemplatesPanel() {
  const { flash, show } = useFlash();
  const [data, setData] = useState<TemplatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [draft, setDraft] = useState<EmailFields | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewMode, setPreviewMode] = useState<'html' | 'text'>('html');
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');
  const [review, setReview] = useState<ReviewState>(IDLE_REVIEW);
  const [testTo, setTestTo] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const runToken = useRef(0);
  const mounted = useRef(true);
  const begin = useLatestRequest();

  // (set on mount as well as cleared on unmount: React's strict mode mounts, unmounts and mounts again in development)
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const template = useMemo(() => data?.templates.find((t) => t.id === selectedId) ?? null, [data, selectedId]);
  const version = useMemo(() => template?.versions.find((v) => v.version === selectedVersion) ?? null, [template, selectedVersion]);
  const dirty = Boolean(draft && version && !sameFields(draft, version.fields));
  const stateOf = useCallback((t: EmailTemplate, v: TemplateVersion): ApprovalState => data?.states[t.id]?.[String(v.version)] ?? { state: 'unapproved' }, [data]);

  /** Load the templates; select `pick` (or keep the selection, or the first template) and put its version's words in the editor. */
  const load = useCallback(async (pick?: { id?: string; version?: number | 'latest'; resetReview?: boolean }) => {
    const isLatest = begin();
    setLoadError('');
    try {
      const res = await adminFetch('/api/admin/newsletter/templates');
      if (!res.ok) throw new Error(await errorText(res, 'Could not load the email templates.'));
      const body = (await res.json()) as TemplatesResponse;
      if (!isLatest()) return;
      setData(body);
      setSelectedId((currentId) => {
        const wanted = pick?.id ?? currentId ?? body.templates.find((t) => t.key === body.welcomeKey)?.id ?? body.templates[0]?.id ?? null;
        const found = body.templates.find((t) => t.id === wanted) ?? body.templates[0];
        if (!found) {
          setSelectedVersion(null);
          setDraft(null);
          setName('');
          return null;
        }
        setSelectedVersion((currentVersion) => {
          const target =
            pick?.version === 'latest' || (pick?.id && pick.id !== currentId) || currentVersion === null || !found.versions.some((v) => v.version === currentVersion)
              ? latestVersion(found).version
              : typeof pick?.version === 'number'
                ? pick.version
                : currentVersion;
          const chosen = found.versions.find((v) => v.version === target) ?? latestVersion(found);
          setDraft({ ...chosen.fields });
          return chosen.version;
        });
        setName(found.name);
        return found.id;
      });
      if (pick?.resetReview) setReview(IDLE_REVIEW);
    } catch (err) {
      if (isLatest()) setLoadError(err instanceof Error ? err.message : 'Could not load the email templates.');
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [begin]);

  useEffect(() => {
    load();
  }, [load]);

  // Live preview of the draft in the real brand layout, with the automatic checks that apply to it.
  useEffect(() => {
    if (!draft) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await adminFetch('/api/admin/newsletter/preview', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ fields: draft }), signal: controller.signal });
        if (!res.ok) {
          setPreviewError(await errorText(res, 'Could not render the preview.'));
          return;
        }
        setPreview((await res.json()) as PreviewResponse);
        setPreviewError('');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setPreviewError('Could not render the preview.');
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft]);

  function confirmDiscard(): boolean {
    return !dirty || confirm('You have unsaved changes to this version. Discard them?');
  }

  function selectTemplate(next: EmailTemplate) {
    if (next.id === selectedId || !confirmDiscard()) return;
    runToken.current += 1;
    setReview(IDLE_REVIEW);
    setTestResult(null);
    const latest = latestVersion(next);
    setSelectedId(next.id);
    setSelectedVersion(latest.version);
    setDraft({ ...latest.fields });
    setName(next.name);
  }

  function selectVersion(next: TemplateVersion) {
    if (next.version === selectedVersion || !confirmDiscard()) return;
    runToken.current += 1;
    setReview(IDLE_REVIEW);
    setTestResult(null);
    setSelectedVersion(next.version);
    setDraft({ ...next.fields });
  }

  async function send(method: 'PUT' | 'POST' | 'DELETE', body: Record<string, unknown>, failure: string): Promise<Response | null> {
    const res = await adminFetch('/api/admin/newsletter/templates', { method, headers: JSON_HEADERS, body: JSON.stringify(body) });
    if (!res.ok) {
      show(await errorText(res, failure), true);
      return null;
    }
    return res;
  }

  async function saveVersion() {
    if (!template || !draft || !dirty) return;
    setBusy('save');
    try {
      const res = await send('PUT', { id: template.id, fields: draft }, 'Could not save the changes.');
      if (!res) return;
      const saved = ((await res.json()) as { template: EmailTemplate }).template;
      const latest = latestVersion(saved);
      await load({ id: saved.id, version: latest.version });
      show(`Saved as version ${latest.version}. It must pass the quality review before it can be sent.`);
    } finally {
      setBusy('');
    }
  }

  async function saveName() {
    if (!template || !name.trim() || name.trim() === template.name) return;
    setBusy('name');
    try {
      const res = await send('PUT', { id: template.id, name: name.trim() }, 'Could not rename the template.');
      if (res) {
        await load({ id: template.id });
        show('Template renamed.');
      }
    } finally {
      setBusy('');
    }
  }

  async function toggleEnabled() {
    if (!template) return;
    const next = !template.enabled;
    if (!next && template.key === data?.welcomeKey && !confirm('Switching off the welcome template means new subscribers will not be sent a welcome email. Continue?')) return;
    setBusy('enabled');
    try {
      const res = await send('PUT', { id: template.id, enabled: next }, 'Could not change the template.');
      if (res) {
        await load({ id: template.id });
        show(next ? 'Template switched on.' : 'Template switched off: it sends nothing.');
      }
    } finally {
      setBusy('');
    }
  }

  async function setActive(number: number | null) {
    if (!template) return;
    setBusy('activate');
    try {
      const res = await send('PUT', { id: template.id, activeVersion: number }, 'Could not change the active version.');
      if (res) {
        await load({ id: template.id, version: selectedVersion ?? undefined });
        show(number === null ? 'Deactivated: this template sends nothing until a version is activated.' : `Version ${number} is now the version used for sending.`);
      }
    } finally {
      setBusy('');
    }
  }

  async function createTemplate() {
    setBusy('create');
    try {
      const res = await send('POST', { key: newKey.trim(), name: newName.trim() }, 'Could not create the template.');
      if (!res) return;
      const created = ((await res.json()) as { template: EmailTemplate }).template;
      setNewKey('');
      setNewName('');
      await load({ id: created.id, version: 'latest', resetReview: true });
      show(`Template “${created.name}” created. Write its content, then run the quality review.`);
    } finally {
      setBusy('');
    }
  }

  async function duplicateTemplate() {
    if (!template) return;
    setBusy('duplicate');
    try {
      const res = await send('POST', { action: 'duplicate', id: template.id }, 'Could not duplicate the template.');
      if (!res) return;
      const copy = ((await res.json()) as { template: EmailTemplate }).template;
      await load({ id: copy.id, version: 'latest', resetReview: true });
      show(`Duplicated as “${copy.name}”. The copy starts unapproved.`);
    } finally {
      setBusy('');
    }
  }

  async function deleteTemplate() {
    if (!template) return;
    const welcome = template.key === data?.welcomeKey;
    const message = welcome
      ? `Delete the welcome template “${template.name}” and all its versions? New subscribers will not be sent a welcome email until it is created again. This cannot be undone.`
      : `Delete “${template.name}” and all its versions? This cannot be undone.`;
    if (!confirm(message)) return;
    setBusy('delete');
    try {
      const res = await send('DELETE', { id: template.id }, 'Could not delete the template.');
      if (res) {
        runToken.current += 1;
        setReview(IDLE_REVIEW);
        setSelectedId(null);
        await load();
        show('Template deleted.');
      }
    } finally {
      setBusy('');
    }
  }

  async function runReview() {
    if (!template || !version || dirty) return;
    const token = ++runToken.current;
    const id = template.id;
    const number = version.version;
    setReview({ status: 'running', version: number, rounds: [], result: null, approvedVersion: null, error: '' });
    try {
      let res = await adminFetch('/api/admin/newsletter/review', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id, version: number }) });
      if (!res.ok) throw new Error(await errorText(res, 'Could not start the quality review.'));
      let body = (await res.json()) as ReviewBody;
      for (;;) {
        if (!mounted.current || runToken.current !== token) return;
        setReview({
          status: body.status === 'running' ? 'running' : body.status === 'done' ? 'done' : 'error',
          version: number,
          rounds: body.rounds ?? [],
          result: body.result ?? null,
          approvedVersion: body.approvedVersion ?? null,
          error: body.status === 'error' ? 'The review stopped because of an unexpected error. Try again.' : '',
        });
        if (body.status !== 'running') break;
        await sleep(2000);
        res = await adminFetch(`/api/admin/newsletter/review?id=${encodeURIComponent(id)}&version=${number}`);
        if (!res.ok) throw new Error(await errorText(res, 'Could not read the progress of the review.'));
        body = (await res.json()) as ReviewBody;
      }
      if (body.status === 'done') {
        await load({ id, version: body.approvedVersion ?? number });
        if (body.approvedVersion) show(`Approved: version ${body.approvedVersion} passed the quality review.`);
        else show('The quality review blocked this version. The rounds below say why.', true);
      }
    } catch (err) {
      if (mounted.current && runToken.current === token) setReview((current) => ({ ...current, status: 'error', error: err instanceof Error ? err.message : 'The quality review failed.' }));
    }
  }

  async function sendTest() {
    if (!template || !version) return;
    setBusy('test');
    setTestResult(null);
    try {
      const res = await adminFetch('/api/admin/newsletter/send', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ mode: 'test', to: testTo.trim(), templateKey: template.key, version: version.version }) });
      if (res.ok) {
        const body = (await res.json()) as { messageId?: string };
        setTestResult({ ok: true, text: `Test email sent${body.messageId ? ` (message id ${body.messageId})` : ''}. Check the inbox, and the send log.` });
      } else {
        let reason = '';
        let message = '';
        try {
          const body = (await res.json()) as { error?: string; reason?: string };
          reason = body.reason ?? '';
          message = body.error ?? '';
        } catch {
          /* not JSON */
        }
        setTestResult({ ok: false, text: res.status === 401 ? 'Your session has expired. Please sign in again.' : explainReason(reason, message || 'The test email could not be sent.') });
      }
    } finally {
      setBusy('');
    }
  }

  const welcomeKey = data?.welcomeKey;
  const versionState = template && version ? stateOf(template, version) : null;
  const isActive = Boolean(template && version && template.activeVersion === version.version);
  const reviewVersionMatches = review.version === version?.version || (review.approvedVersion !== null && review.approvedVersion === version?.version);
  const threshold = review.result?.threshold ?? 85;

  return (
    <div data-testid="email-templates">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Email templates</h2>
          <p className="text-white/30 text-[11px] mt-0.5">Write, review, approve and test the emails the site sends. Nothing is sent that has not passed the quality review.</p>
        </div>
        <button onClick={() => load()} className={buttonClasses}>
          Refresh
        </button>
      </div>
      <Flash flash={flash} />

      {loading && !data ? (
        <div className={`${cardClasses} p-8 text-center`}>
          <p className="text-white/25 text-sm font-body">Loading templates...</p>
        </div>
      ) : loadError ? (
        <div role="alert" className="bg-[#0A0A0A] border border-red-400/20 rounded-sm p-8 text-center">
          <p className="text-red-400 text-sm font-body">{loadError}</p>
        </div>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Template list and the form to add one */}
          <aside className="space-y-4" aria-label="Templates">
            <ul className="space-y-2" aria-label="Email templates">
              {data.templates.map((t) => {
                const active = t.activeVersion !== null;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => selectTemplate(t)}
                      data-template-key={t.key}
                      aria-current={t.id === selectedId ? 'true' : undefined}
                      className={`w-full text-left px-3 py-2.5 rounded-sm border transition-colors ${t.id === selectedId ? 'border-[#C9A84C]/60 bg-[#C9A84C]/[0.06]' : 'border-white/[0.08] bg-[#0A0A0A] hover:border-[#C9A84C]/30'}`}
                    >
                      <span className="block text-sm text-white font-body">{t.name}</span>
                      <span className="block text-[11px] text-white/30 font-body">{t.key}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {t.key === welcomeKey && <Badge tone="info">Welcome email</Badge>}
                        {!t.enabled && <Badge tone="muted">Off</Badge>}
                        {t.enabled && active && <Badge tone="good">Active v{t.activeVersion}</Badge>}
                        {t.enabled && !active && <Badge tone="gold">Not active</Badge>}
                      </span>
                    </button>
                  </li>
                );
              })}
              {data.templates.length === 0 && <li className="text-[12px] text-white/30 font-body">No templates yet.</li>}
            </ul>

            <form
              className={`${cardClasses} p-3 space-y-2`}
              onSubmit={(e) => {
                e.preventDefault();
                createTemplate();
              }}
              aria-label="Add a template"
            >
              <p className="text-[11px] uppercase tracking-wider text-white/40 font-body">Add a template</p>
              <div>
                <label htmlFor="new-template-name" className="sr-only">
                  Template name
                </label>
                <input id="new-template-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name, for example Spring note" className={fieldClasses} maxLength={80} />
              </div>
              <div>
                <label htmlFor="new-template-key" className="sr-only">
                  Template key
                </label>
                <input id="new-template-key" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Key, for example spring_note" className={fieldClasses} maxLength={49} autoCapitalize="none" spellCheck={false} />
              </div>
              <p className="text-[11px] text-white/25 font-body">The key is lower-case letters, numbers and underscores. The key newsletter_welcome is the email new subscribers receive.</p>
              <button type="submit" disabled={busy === 'create' || !newName.trim() || !newKey.trim() || data.templates.length >= data.limits.maxTemplates} className={`${goldButtonClasses} w-full`}>
                {busy === 'create' ? 'Adding...' : 'Add template'}
              </button>
            </form>
          </aside>

          {/* The selected template */}
          {template && version && draft ? (
            <div className="space-y-6 min-w-0" data-template-id={template.id}>
              <section className={`${cardClasses} p-5`} aria-label="Template details">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[220px]">
                    <label htmlFor="template-name" className={labelClasses}>
                      Name
                    </label>
                    <input id="template-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClasses} maxLength={80} />
                  </div>
                  <button onClick={saveName} disabled={busy === 'name' || !name.trim() || name.trim() === template.name} className={buttonClasses}>
                    Rename
                  </button>
                  <button onClick={toggleEnabled} disabled={busy === 'enabled'} className={buttonClasses} aria-pressed={template.enabled}>
                    {template.enabled ? 'Switch off' : 'Switch on'}
                  </button>
                  <button onClick={duplicateTemplate} disabled={busy === 'duplicate'} className={buttonClasses}>
                    Duplicate
                  </button>
                  <button onClick={deleteTemplate} disabled={busy === 'delete'} className={dangerButtonClasses}>
                    Delete template
                  </button>
                </div>
                <p className="text-[11px] text-white/30 font-body mt-2">
                  Key <code className="text-white/45">{template.key}</code>.{' '}
                  {template.key === welcomeKey ? 'This is the welcome email sent automatically to each new subscriber once a version is approved and active.' : 'This template is sent only when something is set up to send it.'}{' '}
                  {template.enabled ? '' : 'It is switched off: it sends nothing.'}
                </p>
              </section>

              {/* Versions */}
              <section className={`${cardClasses} p-5`} aria-label="Versions">
                <h3 className="text-base font-display font-bold text-white mb-3">Versions</h3>
                <ul className="space-y-2" aria-label="Template versions">
                  {[...template.versions].sort((a, b) => b.version - a.version).map((v) => {
                    const state = stateOf(template, v);
                    const selected = v.version === version.version;
                    return (
                      <li key={v.version}>
                        <button
                          onClick={() => selectVersion(v)}
                          data-version={v.version}
                          aria-current={selected ? 'true' : undefined}
                          className={`w-full text-left px-3 py-2 rounded-sm border transition-colors ${selected ? 'border-[#C9A84C]/60 bg-[#C9A84C]/[0.06]' : 'border-white/[0.08] hover:border-[#C9A84C]/30'}`}
                        >
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-sm text-white font-body">Version {v.version}</span>
                            <span className="text-[11px] text-white/35 font-body">{CREATED_BY[v.createdBy] ?? v.createdBy}, {formatDate(v.createdAt)}</span>
                            <span className="flex flex-wrap gap-1.5 ml-auto">
                              {template.activeVersion === v.version && <Badge tone="good">Active</Badge>}
                              {state.state === 'approved' && <Badge tone="good" title={v.approval ? `Approved by ${v.approval.provider} ${v.approval.model}` : undefined}>Approved</Badge>}
                              {state.state === 'stale' && <Badge tone="gold" title={`${state.reasons.join(' and ')} changed`}>Approval out of date</Badge>}
                              {state.state === 'unapproved' && <Badge tone="muted">Not approved</Badge>}
                              {v.review?.resultVersion && v.review.resultVersion !== v.version && <Badge tone="info" title="The quality review reworded this version; the reworded copy is the one that was approved">Reworded as version {v.review.resultVersion}</Badge>}
                              {v.review && !v.approval && !v.review.passed && <Badge tone="bad">Review blocked</Badge>}
                            </span>
                          </span>
                          {v.note && <span className="block text-[11px] text-white/30 font-body mt-1">{v.note}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Editor and live preview */}
              <div className="grid gap-6 2xl:grid-cols-2">
                <section className={`${cardClasses} p-5 min-w-0`} aria-label="Edit version">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="text-base font-display font-bold text-white">Content of version {version.version}</h3>
                    {dirty ? <Badge tone="gold">Unsaved changes</Badge> : <Badge tone="muted">Saved</Badge>}
                  </div>
                  <div className="space-y-4">
                    {FIELD_META.map((meta) => {
                      const value = draft[meta.name] ?? '';
                      const max = data.limits.fields[meta.name];
                      const id = `field-${meta.name}`;
                      return (
                        <div key={meta.name}>
                          <label htmlFor={id} className={labelClasses}>
                            {meta.label}
                          </label>
                          {meta.multiline ? (
                            <textarea id={id} value={value} onChange={(e) => setDraft({ ...draft, [meta.name]: e.target.value })} rows={12} maxLength={max} className={`${fieldClasses} leading-relaxed`} />
                          ) : (
                            <input id={id} type="text" value={value} onChange={(e) => setDraft({ ...draft, [meta.name]: e.target.value.replace(/[\r\n]+/g, ' ') })} maxLength={max} className={fieldClasses} autoCapitalize="none" />
                          )}
                          <p className="text-[11px] text-white/30 font-body mt-1">
                            {meta.hint} <span className="text-white/20">({value.length} characters)</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button onClick={saveVersion} disabled={!dirty || busy === 'save'} className={goldButtonClasses}>
                      {busy === 'save' ? 'Saving...' : 'Save as new version'}
                    </button>
                    <button onClick={() => setDraft({ ...version.fields })} disabled={!dirty} className={buttonClasses}>
                      Reset changes
                    </button>
                    <p className="text-[11px] text-white/30 font-body">A saved edit is a new version and starts unapproved.</p>
                  </div>
                </section>

                <section className={`${cardClasses} p-5 min-w-0`} aria-label="Preview">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="text-base font-display font-bold text-white">Preview</h3>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Preview options">
                      <button onClick={() => setPreviewMode('html')} aria-pressed={previewMode === 'html'} className={`${buttonClasses} !px-3 !py-1 text-[12px] ${previewMode === 'html' ? '!text-[#C9A84C] !border-[#C9A84C]/40' : ''}`}>
                        Email
                      </button>
                      <button onClick={() => setPreviewMode('text')} aria-pressed={previewMode === 'text'} className={`${buttonClasses} !px-3 !py-1 text-[12px] ${previewMode === 'text' ? '!text-[#C9A84C] !border-[#C9A84C]/40' : ''}`}>
                        Plain text
                      </button>
                      {previewMode === 'html' && (
                        <>
                          <button onClick={() => setPreviewWidth('desktop')} aria-pressed={previewWidth === 'desktop'} className={`${buttonClasses} !px-3 !py-1 text-[12px] ${previewWidth === 'desktop' ? '!text-[#C9A84C] !border-[#C9A84C]/40' : ''}`}>
                            Desktop
                          </button>
                          <button onClick={() => setPreviewWidth('mobile')} aria-pressed={previewWidth === 'mobile'} className={`${buttonClasses} !px-3 !py-1 text-[12px] ${previewWidth === 'mobile' ? '!text-[#C9A84C] !border-[#C9A84C]/40' : ''}`}>
                            Phone
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {previewError ? (
                    <p role="alert" className="text-[12px] text-red-400 font-body">{previewError}</p>
                  ) : !preview ? (
                    <p className="text-[12px] text-white/30 font-body">Rendering the preview...</p>
                  ) : previewMode === 'html' ? (
                    preview.html ? (
                      <div className="overflow-auto bg-[#050505] border border-white/[0.06] rounded-sm" style={{ maxHeight: 640 }}>
                        <iframe
                          title="Email preview"
                          sandbox=""
                          srcDoc={preview.html}
                          style={{ width: previewWidth === 'mobile' ? 390 : 680, height: 900, border: 0, display: 'block', margin: '0 auto', background: '#0A0A0A' }}
                        />
                      </div>
                    ) : (
                      <p className="text-[12px] text-red-400 font-body">The email could not be rendered. The checks below say why.</p>
                    )
                  ) : (
                    <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/65 font-mono bg-[#050505] border border-white/[0.06] rounded-sm p-3 overflow-auto" style={{ maxHeight: 640 }}>
                      {preview.text ?? ''}
                    </pre>
                  )}
                  <div className="mt-4">
                    <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1 font-body">Automatic checks on this draft</p>
                    {preview && preview.issues.length === 0 ? (
                      <p data-testid="preview-clean" className="text-[12px] text-[#1BBFA1] font-body">No problems found by the automatic checks.</p>
                    ) : preview ? (
                      <IssueList issues={preview.issues} label="Automatic check problems on this draft" />
                    ) : null}
                  </div>
                </section>
              </div>

              {/* Quality review, approval and activation */}
              <section className={`${cardClasses} p-5`} aria-label="Quality review">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-base font-display font-bold text-white">Quality review of version {version.version}</h3>
                    <p className="text-[11px] text-white/30 font-body mt-0.5">
                      The automatic checks, then an AI review of content, brand, tone, language and quality. Anything that falls short is reworded and reviewed again, up to the limit in the guidelines settings.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {versionState?.state === 'approved' && <Badge tone="good">Approved</Badge>}
                    {versionState?.state === 'stale' && <Badge tone="gold">Approval out of date ({versionState.reasons.join(' and ')} changed)</Badge>}
                    {versionState?.state === 'unapproved' && <Badge tone="muted">Not approved</Badge>}
                    <button onClick={runReview} disabled={dirty || review.status === 'running'} className={goldButtonClasses} title={dirty ? 'Save your changes first' : undefined}>
                      {review.status === 'running' ? 'Reviewing...' : 'Run quality review'}
                    </button>
                  </div>
                </div>
                {dirty && <p className="text-[12px] text-[#C9A84C] font-body mb-3">Save your changes as a new version before running the review: the review is of a saved version.</p>}
                {version.approval && (
                  <p data-testid="approved-by" className="text-[12px] text-white/55 font-body mb-3">
                    Approved {formatDate(version.approval.at)} by <span className="text-white/80">{version.approval.provider} {version.approval.model}</span> after {version.approval.rounds} round{version.approval.rounds === 1 ? '' : 's'}; scores{' '}
                    {Object.entries(version.approval.scores).map(([k, v2]) => `${k} ${Math.round(v2)}`).join(', ')}.
                    {versionState?.state === 'stale' ? ' This approval no longer applies.' : ''}
                  </p>
                )}

                {review.status === 'error' && (
                  <p role="alert" className="text-sm text-red-400 font-body mb-3">
                    {review.error}
                  </p>
                )}
                {review.status !== 'idle' && reviewVersionMatches && (
                  <div data-testid="review-progress" className="space-y-3">
                    {review.status === 'running' && <p role="status" className="text-sm text-white/55 font-body">Review in progress: {review.rounds.length === 0 ? 'starting' : `${review.rounds.length} round${review.rounds.length === 1 ? '' : 's'} so far`}...</p>}
                    {review.rounds.length > 0 && (
                      <ol className="space-y-3" aria-label="Review rounds">
                        {review.rounds.map((round) => (
                          <RoundView key={round.round} round={round} threshold={threshold} />
                        ))}
                      </ol>
                    )}
                    {review.status === 'done' && review.result && (
                      <p role="status" data-testid="review-outcome" className={`text-sm font-body ${review.result.passed ? 'text-[#1BBFA1]' : 'text-red-400'}`}>
                        {STOP_TEXT[review.result.stopReason]}
                        {review.result.passed && review.approvedVersion ? ` Version ${review.approvedVersion} is approved.` : ''}
                      </p>
                    )}
                  </div>
                )}
                {review.status === 'idle' && version.review && (
                  <div className="space-y-2" data-testid="last-review">
                    <p className="text-[12px] text-white/40 font-body">
                      Last review {formatDate(version.review.at)}: {version.review.passed ? 'passed' : STOP_TEXT[version.review.stopReason]}
                    </p>
                    {version.review.rounds.length > 0 && (
                      <details data-testid="last-review-rounds">
                        <summary className="cursor-pointer text-[12px] text-white/50 font-body hover:text-white/70">Show the rounds of the last review, and which AI models were asked</summary>
                        <ol className="space-y-3 mt-3" aria-label="Rounds of the last review">
                          {version.review.rounds.map((round) => (
                            <RoundView key={round.round} round={round} threshold={threshold} />
                          ))}
                        </ol>
                      </details>
                    )}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
                  <button onClick={() => setActive(version.version)} disabled={busy === 'activate' || versionState?.state !== 'approved' || isActive || dirty} className={goldButtonClasses}>
                    Activate for sending
                  </button>
                  <button onClick={() => setActive(null)} disabled={busy === 'activate' || template.activeVersion === null} className={buttonClasses}>
                    Deactivate (send nothing)
                  </button>
                  <p className="text-[11px] text-white/30 font-body">
                    {template.activeVersion === null ? 'No version is active: this template sends nothing.' : `Version ${template.activeVersion} is the version used for sending.`}
                    {versionState?.state !== 'approved' ? ' Only an approved version can be activated.' : ''}
                  </p>
                </div>
              </section>

              {/* Test send */}
              <section className={`${cardClasses} p-5`} aria-label="Send a test email">
                <h3 className="text-base font-display font-bold text-white mb-1">Send a test email</h3>
                <p className="text-[11px] text-white/30 font-body mb-3">
                  Sends version {version.version} to one address, through the same checks and the same email provider as a real send. Only an approved version can be sent. The unsubscribe link in a test email works but changes nothing.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[240px]">
                    <label htmlFor="test-to" className={labelClasses}>
                      Send to
                    </label>
                    <input id="test-to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="name@example.com" autoComplete="off" className={fieldClasses} />
                  </div>
                  <button onClick={sendTest} disabled={busy === 'test' || !testTo.trim() || dirty || versionState?.state !== 'approved'} className={goldButtonClasses}>
                    {busy === 'test' ? 'Sending...' : 'Send test email'}
                  </button>
                </div>
                {versionState?.state !== 'approved' && <p className="text-[11px] text-[#C9A84C] font-body mt-2">This version is not approved yet: run the quality review first.</p>}
                {testResult && (
                  <p role={testResult.ok ? 'status' : 'alert'} data-testid="test-send-result" className={`text-sm font-body mt-3 ${testResult.ok ? 'text-[#1BBFA1]' : 'text-red-400'}`}>
                    {testResult.text}
                  </p>
                )}
              </section>
            </div>
          ) : (
            <div className={`${cardClasses} p-8 text-center self-start`}>
              <p className="text-white/25 text-sm font-body">{data.templates.length === 0 ? 'There are no templates. Add one to begin.' : 'Choose a template.'}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
