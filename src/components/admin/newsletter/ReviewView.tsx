'use client';
import { AI_DIMENSIONS, type GateIssue, type GateRound, type GateStopReason } from '@/lib/email/types';
import { Badge } from './shared';

/**
 * One quality review, round by round: what was checked, what the AI scored and said, what the AI changed to fix it,
 * and why the review stopped. Everything the gate did is shown, so an administrator can see exactly why an email
 * passed or was blocked.
 */

export const STOP_TEXT: Record<GateStopReason, string> = {
  passed: 'Passed: every check is clean and the AI review reached the pass mark in every area.',
  max_rounds: 'Blocked: the limit on fix rounds was reached and the email still does not meet the standard.',
  ai_unavailable: 'Blocked: the AI reviewer could not be used, so nothing can be approved. An email is never approved without a review.',
  unfixable: 'Blocked: the remaining problems cannot be fixed by rewording (they are in the layout or the configuration).',
  no_progress: 'Blocked: the AI could not produce a usable fix.',
  layout_not_installed: 'Blocked: no brand layout is installed.',
};

const DIMENSION_LABEL: Record<string, string> = { content: 'Content', brand: 'Brand', tone: 'Tone', language: 'Language', quality: 'Quality' };
const FIELD_LABEL: Record<string, string> = { subject: 'Subject', preheader: 'Preheader', eyebrow: 'Eyebrow', heading: 'Heading', body: 'Body', cta: 'Button', layout: 'Layout', global: 'Whole email', ctaLabel: 'Button label', ctaUrl: 'Button link' };

export function IssueList({ issues, label }: { issues: GateIssue[]; label: string }) {
  if (issues.length === 0) return null;
  return (
    <ul aria-label={label} className="space-y-1.5">
      {issues.map((issue, index) => (
        <li key={`${issue.code}-${index}`} className="text-[12px] font-body leading-relaxed">
          <span className="inline-block mr-2 align-middle">
            <Badge tone={issue.severity === 'minor' ? 'muted' : 'bad'}>{FIELD_LABEL[issue.field] ?? issue.field}</Badge>
          </span>
          <span className="text-white/75">{issue.message}</span>
          {issue.suggestion && <span className="block text-white/35 pl-0 mt-0.5">Suggestion: {issue.suggestion}</span>}
        </li>
      ))}
    </ul>
  );
}

function ScoreBar({ label, value, threshold }: { label: string; value: number; threshold: number }) {
  const pass = value >= threshold;
  return (
    <div className="flex items-center gap-2 text-[12px] font-body" data-testid={`score-${label.toLowerCase()}`}>
      <span className="w-20 text-white/50">{label}</span>
      <span className="flex-1 h-1.5 bg-white/[0.06] rounded-sm overflow-hidden" aria-hidden="true">
        <span className={`block h-full ${pass ? 'bg-[#1BBFA1]' : 'bg-red-400'}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <span className={`w-8 text-right ${pass ? 'text-[#1BBFA1]' : 'text-red-400'}`}>{Math.round(value)}</span>
    </div>
  );
}

export function RoundView({ round, threshold }: { round: GateRound; threshold: number }) {
  const ai = round.ai;
  return (
    <li data-testid={`review-round-${round.round}`} className="border border-white/[0.08] rounded-sm p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-display font-bold text-white">Round {round.round}</h4>
        {round.passed ? <Badge tone="good">Passed</Badge> : <Badge tone="gold">Needs changes</Badge>}
        {round.round > 1 && <span className="text-[11px] text-white/30 font-body">after the AI’s changes</span>}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-white/35 mb-1 font-body">Automatic checks</p>
        {round.deterministic.length === 0 ? (
          <p className="text-[12px] text-[#1BBFA1] font-body">All automatic checks passed (wording, links, layout, brand colours and fonts).</p>
        ) : (
          <IssueList issues={round.deterministic} label={`Automatic check problems, round ${round.round}`} />
        )}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-white/35 mb-1 font-body">AI review</p>
        {ai ? (
          <div className="space-y-2">
            <p className="text-[11px] text-white/30 font-body">
              {ai.provider} {ai.model}. Verdict: <span className={ai.verdict === 'pass' ? 'text-[#1BBFA1]' : 'text-red-400'}>{ai.verdict}</span>. Pass mark {threshold}.
            </p>
            <div className="space-y-1">
              {AI_DIMENSIONS.map((dimension) => (
                <ScoreBar key={dimension} label={DIMENSION_LABEL[dimension]} value={ai.scores[dimension]} threshold={threshold} />
              ))}
            </div>
            {ai.summary && <p className="text-[12px] text-white/60 font-body">{ai.summary}</p>}
            <IssueList issues={ai.issues} label={`AI review notes, round ${round.round}`} />
          </div>
        ) : round.aiError === 'skipped' ? (
          <p className="text-[12px] text-white/40 font-body">Not reviewed by the AI in this round, because the automatic checks found problems to fix first.</p>
        ) : round.aiError ? (
          <p role="alert" className="text-[12px] text-red-400 font-body">
            {round.aiError === 'invalid_response' ? 'The AI reviewer’s answer could not be used.' : 'The AI reviewer could not be used.'} {round.aiErrorDetail ?? ''}
          </p>
        ) : (
          <p className="text-[12px] text-white/40 font-body">Not run.</p>
        )}
      </div>

      {(round.fixedFields?.length || round.fixError) && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/35 mb-1 font-body">AI fix</p>
          {round.fixedFields?.length ? (
            <p className="text-[12px] text-white/70 font-body">
              Reworded: {round.fixedFields.map((f) => FIELD_LABEL[f] ?? f).join(', ')}.{round.fixRationale ? ` ${round.fixRationale}` : ''}
            </p>
          ) : null}
          {round.fixError && <p className="text-[12px] text-red-400 font-body">{round.fixError}</p>}
        </div>
      )}
    </li>
  );
}
