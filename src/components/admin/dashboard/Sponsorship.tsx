'use client';

import { memo, useState } from 'react';
import { SPONSOR_CURRENCY, describeCoverage, formatMoney, type AdminBi, type MoneyStat, type SponsorTierGroup } from '@/lib/admin-bi';
import { clipName } from './biText';
import { COLOR, GOLD_A, WHITE, tierFill } from './brand';
import { moneyFigure, StatBox } from './chartParts';
import { Icon } from './icons';
import { Grow } from './motion';
import { TipBody, useChartTip } from './tooltip';
import { ChartSection, DataTable, EmptyNote, Meter, buttonClass, type TableColumn } from './ui';

/**
 * SPONSORSHIP: the tiers as one composition bar, how many events have sponsors, the sponsors that no event links to, and how much
 * contract value and revenue is recorded (never $0 for what is not). Sponsors have no status, so the Past / Live / Future / All view
 * does not filter their amounts; only "Events with sponsors" follows the view.
 */

const label11 = 'font-body text-[11px] font-bold uppercase tracking-[0.12em]';
const NAMES_SHOWN = 6;
const AMOUNT_ROWS = 8;

function moneyText(stat: MoneyStat): string {
  return stat.amounts.length === 0 ? 'not recorded' : stat.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' and ');
}

function tierSummary(tier: SponsorTierGroup): string {
  return `${tier.visible} shown · ${tier.hidden} hidden · revenue ${moneyText(tier.revenue)} (${tier.revenue.coverage.recorded} of ${tier.revenue.coverage.total}) · contract value ${moneyText(tier.contractValue)} (${tier.contractValue.coverage.recorded} of ${tier.contractValue.coverage.total})`;
}

// ─── The composition bar ─────────────────────────────────────────────────────

function TierBar({ tiers, total }: { tiers: readonly SponsorTierGroup[]; total: number }) {
  const tip = useChartTip();
  return (
    <div data-testid="bi-tier-bar">
      <p className={label11} style={{ color: WHITE.a65 }}>
        Sponsors by tier
      </p>
      <Grow className="mt-3">
        <div className="flex h-7 gap-0.5" role="group" aria-label={`${total} sponsors by tier`}>
          {tiers.map((tier, index) => (
            <div
              key={tier.key || 'none'}
              role="img"
              tabIndex={0}
              aria-label={`${tier.label}: ${tier.sponsors.length} ${tier.sponsors.length === 1 ? 'sponsor' : 'sponsors'}`}
              data-testid={`bi-tier-segment-${tier.key || 'none'}`}
              className="min-w-[6px]"
              style={{ flex: `${tier.sponsors.length} 1 0%`, background: tierFill(tier.key), borderRadius: index === tiers.length - 1 ? '0 4px 4px 0' : 0 }}
              {...tip.bind(`tier-${tier.key || 'none'}`, () => (
                <TipBody
                  title={tier.label}
                  subtitle={`${tier.sponsors.length} ${tier.sponsors.length === 1 ? 'sponsor' : 'sponsors'} of ${total}`}
                  rows={[
                    { label: 'Shown on the website', value: String(tier.visible) },
                    { label: 'Hidden', value: String(tier.hidden) },
                    { label: 'Revenue (recorded)', value: `${moneyText(tier.revenue)} (${tier.revenue.coverage.recorded} of ${tier.revenue.coverage.total})` },
                    { label: 'Contract value (recorded)', value: `${moneyText(tier.contractValue)} (${tier.contractValue.coverage.recorded} of ${tier.contractValue.coverage.total})` },
                  ]}
                />
              ))}
            />
          ))}
        </div>
      </Grow>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {tiers.map((tier) => (
          <li key={tier.key || 'none'} className="inline-flex items-center gap-2 font-body text-xs" style={{ color: WHITE.a65 }}>
            <span aria-hidden="true" className="block h-2.5 w-5" style={{ background: tierFill(tier.key), borderRadius: '0 3px 3px 0' }} />
            <span className="capitalize">{tier.label}</span>
            <span className="font-bold tabular-nums text-white">{tier.sponsors.length}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── What is recorded, per sponsor ───────────────────────────────────────────

interface AmountRow {
  key: string;
  name: string;
  tier: string;
  amount: number;
}

function AmountBars({ title, rows, testId, pointer }: { title: string; rows: readonly AmountRow[]; testId: string; pointer: string }) {
  const [expanded, setExpanded] = useState(false);
  const tip = useChartTip();
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  const shown = expanded ? sorted : sorted.slice(0, AMOUNT_ROWS);
  const max = Math.max(0, ...sorted.map((row) => row.amount));
  return (
    <div data-testid={testId} className="min-w-0">
      <p className={label11} style={{ color: WHITE.a65 }}>
        {title}
      </p>
      {rows.length === 0 ? (
        <EmptyNote>Not recorded. {pointer}</EmptyNote>
      ) : (
        <>
          <ul className="mt-2">
            {shown.map((row) => (
              <li
                key={row.key}
                tabIndex={0}
                role="group"
                aria-label={`${row.name}: ${formatMoney(row.amount, SPONSOR_CURRENCY)}`}
                className="grid grid-cols-[minmax(5.5rem,9rem)_minmax(0,1fr)] items-center gap-x-3 py-1.5"
                {...tip.bind(`${testId}-${row.key}`, () => <TipBody title={row.name} subtitle={row.tier} rows={[{ label: title, value: formatMoney(row.amount, SPONSOR_CURRENCY), swatch: 'gold' }]} />)}
              >
                <p className="truncate font-body text-xs text-white" title={row.name}>
                  {row.name}
                </p>
                <div className="relative h-5">
                  <Grow className="absolute inset-y-0.5 left-0" style={{ width: `calc((100% - 5.5rem) * ${max > 0 ? row.amount / max : 0})`, minWidth: 3, background: COLOR.gold, borderRadius: '0 4px 4px 0' }} />
                  <span className="absolute top-1/2 whitespace-nowrap font-body text-xs font-bold tabular-nums text-white" style={{ left: `calc((100% - 5.5rem) * ${max > 0 ? row.amount / max : 0} + 8px)`, transform: 'translateY(-50%)' }}>
                    {formatMoney(row.amount, SPONSOR_CURRENCY)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {rows.length > AMOUNT_ROWS ? (
            <button type="button" onClick={() => setExpanded((previous) => !previous)} aria-expanded={expanded} className={`${buttonClass('ghost', 'sm')} mt-2`}>
              <Icon name="chevronDown" className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? 'Show fewer' : `Show all ${rows.length}`}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

// ─── The section ─────────────────────────────────────────────────────────────

const TIER_COLUMNS: readonly TableColumn[] = [
  { label: 'Tier' },
  { label: 'Sponsors', align: 'right' },
  { label: 'Shown', align: 'right' },
  { label: 'Hidden', align: 'right' },
  { label: 'Revenue (recorded)' },
  { label: 'Contract value (recorded)' },
];

const SPONSOR_COLUMNS: readonly TableColumn[] = [{ label: 'Sponsor' }, { label: 'Tier' }, { label: 'On the website' }, { label: 'Revenue (recorded)' }, { label: 'Contract value (recorded)' }];

function SponsorTables({ bi }: { bi: AdminBi }) {
  const { sponsors } = bi;
  return (
    <div className="space-y-6">
      <DataTable
        testId="bi-sponsors-table-tiers"
        caption="Sponsors by tier. Amounts are in AUD and only what is recorded; coverage is recorded of all sponsors in the tier."
        columns={TIER_COLUMNS}
        minWidth="40rem"
        rows={sponsors.tiers.map((tier) => ({
          key: tier.key || 'none',
          cells: [
            tier.label,
            String(tier.sponsors.length),
            String(tier.visible),
            String(tier.hidden),
            `${moneyText(tier.revenue)} (${tier.revenue.coverage.recorded} of ${tier.revenue.coverage.total})`,
            `${moneyText(tier.contractValue)} (${tier.contractValue.coverage.recorded} of ${tier.contractValue.coverage.total})`,
          ],
        }))}
      />
      <DataTable
        testId="bi-sponsors-table-sponsors"
        caption="Every sponsor, with the amounts recorded for it."
        columns={SPONSOR_COLUMNS}
        minWidth="40rem"
        rows={sponsors.tiers.flatMap((tier) =>
          tier.sponsors.map((sponsor, index) => ({
            key: sponsor.id || `${tier.key}-${sponsor.name}-${index}`,
            cells: [
              sponsor.name,
              tier.label,
              sponsor.visible ? 'Shown' : 'Hidden',
              sponsor.revenue === null ? 'Not recorded' : formatMoney(sponsor.revenue, SPONSOR_CURRENCY),
              sponsor.contractValue === null ? 'Not recorded' : formatMoney(sponsor.contractValue, SPONSOR_CURRENCY),
            ],
          })),
        )}
      />
    </div>
  );
}

function SponsorChart({ bi }: { bi: AdminBi }) {
  const { sponsors } = bi;
  const [allNames, setAllNames] = useState(false);
  if (sponsors.total === 0) return <EmptyNote testId="bi-sponsors-empty">No sponsors yet. Add them in the Sponsors tab.</EmptyNote>;

  const names = allNames ? sponsors.unlinked.names : sponsors.unlinked.names.slice(0, NAMES_SHOWN);
  const entries = sponsors.tiers.flatMap((tier) => tier.sponsors.map((sponsor) => ({ sponsor, tier })));
  const revenueRows: AmountRow[] = entries.flatMap(({ sponsor, tier }, index) => (sponsor.revenue === null ? [] : [{ key: sponsor.id || `r-${index}`, name: sponsor.name, tier: tier.label, amount: sponsor.revenue }]));
  const contractRows: AmountRow[] = entries.flatMap(({ sponsor, tier }, index) => (sponsor.contractValue === null ? [] : [{ key: sponsor.id || `c-${index}`, name: sponsor.name, tier: tier.label, amount: sponsor.contractValue }]));
  const withSponsors = sponsors.eventsWithSponsors;

  return (
    <div className="space-y-6">
      <TierBar tiers={sponsors.tiers} total={sponsors.total} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatBox testId="bi-card-sponsors" label="Sponsors" figure={sponsors.total} coverage={`${sponsors.visible} shown on the website · ${sponsors.hidden} hidden`} />
        <StatBox
          testId="bi-card-events-with-sponsors"
          label="Events with sponsors"
          figure={`${withSponsors.recorded} of ${withSponsors.total}`}
          coverage={withSponsors.total === 0 ? 'no events in this view' : `${withSponsors.total - withSponsors.recorded} in this view have none`}
        >
          <Meter ratio={withSponsors.total === 0 ? null : withSponsors.recorded / withSponsors.total} label="Events with sponsors" valueText={`${withSponsors.recorded} of ${withSponsors.total} events`} className="mt-2" />
        </StatBox>
        <StatBox testId="bi-card-unlinked-sponsors" label="Not linked to any event" figure={sponsors.unlinked.count} coverage="any event, past or upcoming" />
        <StatBox
          testId="bi-card-sponsor-contract"
          label="Sponsor contract value (recorded)"
          figure={moneyFigure(sponsors.contractValue)}
          coverage={`${describeCoverage(sponsors.contractValue.coverage, 'sponsor')}${sponsors.contractValue.amounts.length === 0 ? '. Enter Contract Value on each sponsor (Sponsors tab)' : ''}`}
        />
        <StatBox
          testId="bi-card-sponsor-revenue"
          label="Sponsor revenue (recorded)"
          figure={moneyFigure(sponsors.revenue)}
          coverage={`${describeCoverage(sponsors.revenue.coverage, 'sponsor')}${sponsors.revenue.amounts.length === 0 ? '. Enter Revenue on each sponsor (Sponsors tab)' : ''}`}
        />
      </div>

      {sponsors.unlinked.count > 0 ? (
        <div data-testid="bi-unlinked-names" className="border p-4" style={{ borderColor: WHITE.a08, background: WHITE.a02 }}>
          <p className={label11} style={{ color: WHITE.a65 }}>
            Sponsors not linked to any event
          </p>
          <p className="mt-2 font-body text-xs leading-relaxed [overflow-wrap:anywhere]" style={{ color: WHITE.a65 }}>
            {names.map((name) => clipName(name)).join(', ')}
            {!allNames && sponsors.unlinked.names.length > NAMES_SHOWN ? ` and ${sponsors.unlinked.names.length - NAMES_SHOWN} more` : ''}
          </p>
          {sponsors.unlinked.names.length > NAMES_SHOWN ? (
            <button type="button" onClick={() => setAllNames((previous) => !previous)} aria-expanded={allNames} className={`${buttonClass('ghost', 'sm')} mt-3`}>
              {allNames ? 'Show fewer names' : `Show all ${sponsors.unlinked.names.length} names`}
            </button>
          ) : null}
        </div>
      ) : null}

      <ul className="space-y-3 border-t pt-4" style={{ borderColor: GOLD_A.a10 }}>
        {sponsors.tiers.map((tier) => (
          <li key={tier.key || 'none'} data-testid={`bi-tier-${tier.key || 'none'}`}>
            <p className="font-body text-xs text-white">
              <span className="font-bold capitalize">{tier.label}</span> · <span className="font-bold tabular-nums">{tier.sponsors.length}</span> {tier.sponsors.length === 1 ? 'sponsor' : 'sponsors'}
            </p>
            <p className="mt-0.5 font-body text-[11px] leading-relaxed" style={{ color: WHITE.a50 }}>
              {tierSummary(tier)}
            </p>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 border-t pt-4 lg:grid-cols-2" style={{ borderColor: GOLD_A.a10 }} data-testid="bi-sponsor-amounts">
        <AmountBars title="Contract value (recorded)" rows={contractRows} testId="bi-amounts-contract" pointer="Enter Contract Value on each sponsor (Sponsors tab)." />
        <AmountBars title="Revenue (recorded)" rows={revenueRows} testId="bi-amounts-revenue" pointer="Enter Revenue on each sponsor (Sponsors tab)." />
      </div>
    </div>
  );
}

export const Sponsorship = memo(function Sponsorship({ bi, delay = 0 }: { bi: AdminBi; delay?: number }) {
  const hasSponsors = bi.sponsors.total > 0;
  return (
    <ChartSection
      testId="bi-sponsors"
      eyebrow="Partners"
      title="Sponsorship"
      description="Who sponsors AB Entertainment, how many events they are linked to, and how much contract value is recorded."
      delay={delay}
      chart={<SponsorChart bi={bi} />}
      table={hasSponsors ? <SponsorTables bi={bi} /> : <EmptyNote>No sponsors yet. Add them in the Sponsors tab.</EmptyNote>}
      footer={
        hasSponsors ? (
          <p className="mt-5 border-t pt-4 font-body text-[11px] leading-relaxed" style={{ borderColor: GOLD_A.a10, color: WHITE.a50 }}>
            Sponsors have no status, so the Past / Live / Future view does not filter their amounts; &ldquo;Events with sponsors&rdquo; follows the view. Sponsor amounts are in AUD.
          </p>
        ) : null
      }
    />
  );
});
