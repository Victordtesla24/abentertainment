'use client';

import { memo, useMemo, useState } from 'react';
import { SPONSOR_CURRENCY, describeCoverage, formatCount, formatMoney, formatPercent, type AdminBi, type MoneyStat, type SponsorTierGroup } from '@/lib/admin-bi';
import { clipName } from './biText';
import { GOLD_A, OTHER_FILL, WHITE, seriesFill, tierFill } from './brand';
import { moneyFigure } from './chartParts';
import { FIGURE } from './dial';
import { Donut, type DonutSegment } from './donut';
import { DonutLegend, type LegendRow } from './donutLegend';
import { HotspotNotes, Hotspots, PanelBeacons } from './hotspots';
import { CountUp } from './motion';
import { InfoButton, PopoverText } from './popover';
import { foldOther } from './radial';
import { StatRing } from './statRing';
import { TipBody, useChartTip } from './tooltip';
import { ChartSection, DataTable, EmptyNote, buttonClass, type TableColumn } from './ui';

/**
 * SPONSORSHIP: the tiers as a donut, how many events have sponsors and how many sponsors no event links to, and how much contract value
 * and revenue is recorded (never $0 for what is not), each as a ring of how many sponsors it stands on. The sponsors who have an amount
 * recorded are a second donut of who it comes from. Sponsors have no status, so the Past / Live / Future / All view does not filter their
 * amounts; only "Events with sponsors" follows the view.
 */

const label11 = 'font-body text-[11px] font-bold uppercase tracking-[0.12em]';
const NAMES_SHOWN = 6;
/** A donut carries about six slices; the rest are folded into "Other". */
const SLICES = 6;

function moneyText(stat: MoneyStat): string {
  return stat.amounts.length === 0 ? 'not recorded' : stat.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' and ');
}

function tierSummary(tier: SponsorTierGroup): string {
  return `${tier.visible} shown · ${tier.hidden} hidden · revenue ${moneyText(tier.revenue)} (${tier.revenue.coverage.recorded} of ${tier.revenue.coverage.total}) · contract value ${moneyText(tier.contractValue)} (${tier.contractValue.coverage.recorded} of ${tier.contractValue.coverage.total})`;
}

const sponsorWord = (count: number): string => (count === 1 ? 'sponsor' : 'sponsors');

// ─── The tiers ───────────────────────────────────────────────────────────────

function TierDonut({ tiers, total }: { tiers: readonly SponsorTierGroup[]; total: number }) {
  const tip = useChartTip();
  const [active, setActive] = useState<string | null>(null);
  const { segments, rows } = useMemo(() => {
    const entries = tiers.map((tier) => ({ key: tier.key || 'none', label: tier.label, value: tier.sponsors.length, tier }));
    const { shown, rest } = foldOther(entries, SLICES);
    const built: Array<{ segment: Omit<DonutSegment, 'tip'>; row: Omit<LegendRow, 'tip'>; content: () => React.ReactNode }> = shown.map((entry) => ({
      segment: { key: entry.key, ariaLabel: `${entry.label}: ${entry.value} ${sponsorWord(entry.value)}`, value: entry.value, fill: tierFill(entry.tier.key), testId: `bi-tier-segment-${entry.key}` },
      row: { key: entry.key, label: entry.label, value: entry.value, fill: tierFill(entry.tier.key), ariaLabel: `${entry.label}: ${entry.value} ${sponsorWord(entry.value)}`, testId: `bi-tier-${entry.key}` },
      content: () => (
        <TipBody
          title={entry.label}
          subtitle={`${entry.value} ${sponsorWord(entry.value)} of ${total}`}
          rows={[
            { label: 'Shown on the website', value: String(entry.tier.visible) },
            { label: 'Hidden', value: String(entry.tier.hidden) },
            { label: 'Revenue (recorded)', value: `${moneyText(entry.tier.revenue)} (${entry.tier.revenue.coverage.recorded} of ${entry.tier.revenue.coverage.total})` },
            { label: 'Contract value (recorded)', value: `${moneyText(entry.tier.contractValue)} (${entry.tier.contractValue.coverage.recorded} of ${entry.tier.contractValue.coverage.total})` },
          ]}
          note={tierSummary(entry.tier)}
        />
      ),
    }));
    if (rest.length > 0) {
      const sum = rest.reduce((count, entry) => count + entry.value, 0);
      built.push({
        segment: { key: 'other', ariaLabel: `Other: ${sum} ${sponsorWord(sum)}`, value: sum, fill: OTHER_FILL, testId: 'bi-tier-segment-other' },
        row: { key: 'other', label: 'Other', value: sum, fill: OTHER_FILL, ariaLabel: `Other: ${sum} ${sponsorWord(sum)}`, testId: 'bi-tier-other' },
        content: () => <TipBody title="Other" subtitle={`${sum} ${sponsorWord(sum)} of ${total}`} rows={rest.map((entry) => ({ label: entry.label, value: String(entry.value) }))} />,
      });
    }
    return { segments: built, rows: built };
  }, [tiers, total]);

  return (
    <div data-testid="bi-tier-donut" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
      <Donut
        segments={segments.map((entry) => ({ ...entry.segment, tip: tip.bind(`tier-${entry.segment.key}`, entry.content) }))}
        label="Sponsors by tier"
        valueText={`${total} ${sponsorWord(total)}`}
        size={168}
        testId="bi-tier-chart"
        activeKey={active}
        onActive={setActive}
      >
        <CountUp value={total} format={(value) => formatCount(Math.round(value))} className={`block text-4xl ${FIGURE}`} testId="bi-tier-total" />
        <span className="mt-1.5 font-body text-xs" style={{ color: WHITE.a65 }}>
          sponsors
        </span>
      </Donut>
      <DonutLegend
        className="min-w-[10rem] max-w-[16rem]"
        capitalise
        activeKey={active}
        onActive={setActive}
        rows={rows.map((entry) => ({ ...entry.row, tip: tip.bind(`tier-row-${entry.row.key}`, entry.content) }))}
      />
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

function AmountDonut({ title, rows, testId, pointer }: { title: string; rows: readonly AmountRow[]; testId: string; pointer: string }) {
  const tip = useChartTip();
  const [active, setActive] = useState<string | null>(null);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const { legend, segments } = useMemo(() => {
    const entries = rows.map((row) => ({ ...row, value: row.amount }));
    const { shown, rest } = foldOther(entries, SLICES);
    const share = (amount: number) => (total > 0 ? formatPercent(amount / total) : '0%');
    const made = shown.map((entry, place) => ({
      key: entry.key,
      label: entry.name,
      fill: seriesFill(place),
      value: entry.amount,
      aria: `${entry.name}: ${formatMoney(entry.amount, SPONSOR_CURRENCY)}, ${share(entry.amount)}`,
      content: () => <TipBody title={entry.name} subtitle={entry.tier} rows={[{ label: title, value: formatMoney(entry.amount, SPONSOR_CURRENCY), swatch: 'gold' as const }, { label: 'Share', value: share(entry.amount) }]} />,
    }));
    if (rest.length > 0) {
      const sum = rest.reduce((count, entry) => count + entry.amount, 0);
      made.push({
        key: 'other',
        label: `Other (${rest.length})`,
        fill: OTHER_FILL,
        value: sum,
        aria: `Other: ${rest.length} sponsors, ${formatMoney(sum, SPONSOR_CURRENCY)}, ${share(sum)}`,
        content: () => <TipBody title={`Other (${rest.length})`} rows={rest.map((entry) => ({ label: entry.name, value: formatMoney(entry.amount, SPONSOR_CURRENCY) }))} />,
      });
    }
    return { legend: made, segments: made };
  }, [rows, title, total]);

  return (
    <div data-testid={testId} className="min-w-0">
      <p className={label11} style={{ color: WHITE.a65 }}>
        {title}
      </p>
      {rows.length === 0 ? (
        <EmptyNote>Not recorded. {pointer}</EmptyNote>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
          <Donut
            segments={segments.map((entry) => ({ key: entry.key, ariaLabel: entry.aria, value: entry.value, fill: entry.fill, tip: tip.bind(`${testId}-${entry.key}`, entry.content), testId: `${testId}-slice-${entry.key}` }))}
            label={title}
            valueText={`${formatMoney(total, SPONSOR_CURRENCY)} from ${rows.length} ${sponsorWord(rows.length)}`}
            size={128}
            thickness={14}
            activeKey={active}
            onActive={setActive}
          >
            <span className="font-display text-sm font-bold leading-none text-white [font-variant-numeric:lining-nums]">{formatMoney(total, SPONSOR_CURRENCY)}</span>
          </Donut>
          <DonutLegend
            className="min-w-[9rem] max-w-[15rem]"
            activeKey={active}
            onActive={setActive}
            rows={legend.map((entry) => ({ key: entry.key, label: entry.label, value: formatMoney(entry.value, SPONSOR_CURRENCY), fill: entry.fill, ariaLabel: entry.aria, testId: `${testId}-${entry.key}`, tip: tip.bind(`${testId}-row-${entry.key}`, entry.content) }))}
          />
        </div>
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

/** The sponsors no event links to: the first six names, the rest on request (it is behind the "Not linked" ring). */
function UnlinkedNames({ names }: { names: readonly string[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? names : names.slice(0, NAMES_SHOWN);
  return (
    <div data-testid="bi-unlinked-names">
      <p className="font-display text-base font-bold leading-snug text-white">Sponsors not linked to any event</p>
      <p className="mt-2 font-body text-xs leading-relaxed [overflow-wrap:anywhere]" style={{ color: WHITE.a65 }}>
        {shown.map((name) => clipName(name)).join(', ')}
        {!all && names.length > NAMES_SHOWN ? ` and ${names.length - NAMES_SHOWN} more` : ''}
      </p>
      {names.length > NAMES_SHOWN ? (
        <button type="button" onClick={() => setAll((previous) => !previous)} aria-expanded={all} className={`${buttonClass('ghost', 'sm')} mt-3`}>
          {all ? 'Show fewer names' : `Show all ${names.length} names`}
        </button>
      ) : null}
    </div>
  );
}

function SponsorChart({ bi }: { bi: AdminBi }) {
  const tip = useChartTip();
  const { sponsors } = bi;
  if (sponsors.total === 0) {
    // no sponsors yet, and the events in view may still have none linked: that action still has its ring to sit on
    const none = sponsors.eventsWithSponsors;
    return (
      <div className="space-y-6">
        <EmptyNote testId="bi-sponsors-empty">No sponsors yet. Add them in the Sponsors tab.</EmptyNote>
        <div className="mx-auto grid max-w-[16rem] grid-cols-1">
          <StatRing
            testId="bi-card-events-with-sponsors"
            label="Events with sponsors"
            figure={`${none.recorded} of ${none.total}`}
            ratio={none.total === 0 ? null : none.recorded / none.total}
            caption={none.total === 0 ? 'none in view' : `${none.total - none.recorded} have none`}
            ringLabel="Events with sponsors"
            valueText={`${none.recorded} of ${none.total} events`}
            tip={tip.bind('sponsors-events', <TipBody title="Events with sponsors" rows={[{ label: 'With sponsors', value: `${none.recorded} of ${none.total}` }]} note={none.total === 0 ? 'no events in this view' : `${none.total - none.recorded} in this view have none`} />)}
            hotspots={<Hotspots ids={['link-sponsors-upcoming']} label="events with sponsors" slug="events-with-sponsors" className="" />}
          />
        </div>
      </div>
    );
  }

  const entries = sponsors.tiers.flatMap((tier) => tier.sponsors.map((sponsor) => ({ sponsor, tier })));
  const revenueRows: AmountRow[] = entries.flatMap(({ sponsor, tier }, index) => (sponsor.revenue === null ? [] : [{ key: sponsor.id || `r-${index}`, name: sponsor.name, tier: tier.label, amount: sponsor.revenue }]));
  const contractRows: AmountRow[] = entries.flatMap(({ sponsor, tier }, index) => (sponsor.contractValue === null ? [] : [{ key: sponsor.id || `c-${index}`, name: sponsor.name, tier: tier.label, amount: sponsor.contractValue }]));
  const withSponsors = sponsors.eventsWithSponsors;
  const share = (recorded: number, total: number): number | null => (total === 0 ? null : recorded / total);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 items-center gap-x-6 gap-y-6 xl:grid-cols-[minmax(18rem,22rem)_1fr]">
        <TierDonut tiers={sponsors.tiers} total={sponsors.total} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatRing
            testId="bi-card-sponsors"
            label="Sponsors"
            figure={String(sponsors.total)}
            ratio={share(sponsors.visible, sponsors.total)}
            caption={`${sponsors.visible} shown, ${sponsors.hidden} hidden`}
            ringLabel="Sponsors shown on the website"
            valueText={`${sponsors.visible} shown on the website, ${sponsors.hidden} hidden`}
            tip={tip.bind('sponsors-count', <TipBody title="Sponsors" rows={[{ label: 'Shown on the website', value: String(sponsors.visible) }, { label: 'Hidden', value: String(sponsors.hidden) }]} note={`${sponsors.visible} shown on the website · ${sponsors.hidden} hidden`} />)}
          />
          <StatRing
            testId="bi-card-events-with-sponsors"
            label="Events with sponsors"
            figure={`${withSponsors.recorded} of ${withSponsors.total}`}
            ratio={share(withSponsors.recorded, withSponsors.total)}
            caption={withSponsors.total === 0 ? 'none in view' : `${withSponsors.total - withSponsors.recorded} have none`}
            ringLabel="Events with sponsors"
            valueText={`${withSponsors.recorded} of ${withSponsors.total} events`}
            tip={tip.bind('sponsors-events', <TipBody title="Events with sponsors" rows={[{ label: 'With sponsors', value: `${withSponsors.recorded} of ${withSponsors.total}` }]} note={withSponsors.total === 0 ? 'no events in this view' : `${withSponsors.total - withSponsors.recorded} in this view have none`} />)}
            hotspots={<Hotspots ids={['link-sponsors-upcoming']} label="events with sponsors" slug="events-with-sponsors" className="" />}
          />
          <StatRing
            testId="bi-card-unlinked-sponsors"
            label="Not linked"
            figure={String(sponsors.unlinked.count)}
            ratio={share(sponsors.unlinked.count, sponsors.total)}
            caption={`of ${sponsors.total} sponsors`}
            ringLabel="Sponsors not linked to any event"
            valueText={`${sponsors.unlinked.count} of ${sponsors.total} sponsors are not linked to any event`}
            tip={tip.bind('sponsors-unlinked', <TipBody title="Not linked to any event" rows={[{ label: 'Sponsors', value: `${sponsors.unlinked.count} of ${sponsors.total}` }]} note="any event, past or upcoming" />)}
            topLeft={
              sponsors.unlinked.count > 0 ? (
                <InfoButton label="the sponsors not linked to any event" buttonLabel="Names of the sponsors not linked to any event" icon="users" testId="bi-unlinked-names-button" width={380}>
                  <UnlinkedNames names={sponsors.unlinked.names} />
                </InfoButton>
              ) : null
            }
            hotspots={<Hotspots ids={['unlinked-sponsors']} label="sponsors not linked to any event" slug="unlinked-sponsors" className="" />}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatRing
            layout="row"
            testId="bi-card-sponsor-contract"
            label="Contract value"
            figure={moneyFigure(sponsors.contractValue)}
            ratio={share(sponsors.contractValue.coverage.recorded, sponsors.contractValue.coverage.total)}
            coverage={sponsors.contractValue.coverage}
            caption={`${sponsors.contractValue.coverage.recorded} of ${sponsors.contractValue.coverage.total} sponsors recorded`}
            ringLabel="Sponsor contract value (recorded)"
            valueText={describeCoverage(sponsors.contractValue.coverage, 'sponsor')}
            tip={tip.bind('sponsors-contract', <TipBody title="Sponsor contract value (recorded)" rows={[{ label: 'Recorded for', value: `${sponsors.contractValue.coverage.recorded} of ${sponsors.contractValue.coverage.total} sponsors` }]} note={`${describeCoverage(sponsors.contractValue.coverage, 'sponsor')}${sponsors.contractValue.amounts.length === 0 ? '. Enter Contract Value on each sponsor (Sponsors tab)' : ''}`} />)}
            hotspots={<Hotspots ids={['record-contract-values']} label="contract value" slug="contract-value" className="" />}
          />
          <StatRing
            layout="row"
            testId="bi-card-sponsor-revenue"
            label="Revenue"
            figure={moneyFigure(sponsors.revenue)}
            ratio={share(sponsors.revenue.coverage.recorded, sponsors.revenue.coverage.total)}
            coverage={sponsors.revenue.coverage}
            caption={`${sponsors.revenue.coverage.recorded} of ${sponsors.revenue.coverage.total} sponsors recorded`}
            ringLabel="Sponsor revenue (recorded)"
            valueText={describeCoverage(sponsors.revenue.coverage, 'sponsor')}
            tip={tip.bind('sponsors-revenue', <TipBody title="Sponsor revenue (recorded)" rows={[{ label: 'Recorded for', value: `${sponsors.revenue.coverage.recorded} of ${sponsors.revenue.coverage.total} sponsors` }]} note={`${describeCoverage(sponsors.revenue.coverage, 'sponsor')}${sponsors.revenue.amounts.length === 0 ? '. Enter Revenue on each sponsor (Sponsors tab)' : ''}`} />)}
          />
      </div>

      {contractRows.length > 0 || revenueRows.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 border-t pt-4 lg:grid-cols-2" style={{ borderColor: GOLD_A.a10 }} data-testid="bi-sponsor-amounts">
          <AmountDonut title="Contract value (recorded)" rows={contractRows} testId="bi-amounts-contract" pointer="Enter Contract Value on each sponsor (Sponsors tab)." />
          <AmountDonut title="Revenue (recorded)" rows={revenueRows} testId="bi-amounts-revenue" pointer="Enter Revenue on each sponsor (Sponsors tab)." />
        </div>
      ) : null}
    </div>
  );
}

/** The actions that concern the sponsors and where they are linked. */
const SPONSOR_ACTIONS = ['link-sponsors-upcoming', 'unlinked-sponsors', 'record-contract-values'] as const;

export const Sponsorship = memo(function Sponsorship({ bi, delay = 0 }: { bi: AdminBi; delay?: number }) {
  const hasSponsors = bi.sponsors.total > 0;
  return (
    <ChartSection
      testId="bi-sponsors"
      eyebrow="Partners"
      title="Sponsorship"
      info={{
        label: 'sponsorship',
        content: (
          <PopoverText title="Sponsorship">
            <p>Who sponsors AB Entertainment, how many events they are linked to, and how much contract value is recorded.</p>
            {hasSponsors ? (
              <p data-testid="bi-sponsors-footnote">
                Sponsors have no status, so the Past / Live / Future view does not filter their amounts; &ldquo;Events with sponsors&rdquo; follows the view. Sponsor amounts are in AUD.
              </p>
            ) : null}
          </PopoverText>
        ),
      }}
      delay={delay}
      chart={<SponsorChart bi={bi} />}
      table={hasSponsors ? <SponsorTables bi={bi} /> : <EmptyNote>No sponsors yet. Add them in the Sponsors tab.</EmptyNote>}
      beaconsOnVisuals
      beacons={<PanelBeacons ids={SPONSOR_ACTIONS} label="sponsorship" slug="sponsorship-panel" />}
      notes={<HotspotNotes ids={SPONSOR_ACTIONS} label="sponsorship" slug="sponsorship" />}
    />
  );
});
