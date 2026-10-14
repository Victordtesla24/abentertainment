'use client';

import { memo, useId, useState } from 'react';
import { describeCoverage, formatCount, formatEstimate, formatMoney, formatPercent, type AdminBi, type DataCompleteness, type TimeScope } from '@/lib/admin-bi';
import { COLOR, WHITE } from './brand';
import { describeLeftOut, SourceLink, theseEvents } from './biText';
import { RangeBar } from './chartParts';
import { Icon } from './icons';
import { CountUp, Grow, Reveal, staggerDelay } from './motion';
import { nextEvent, primaryCurrency } from './selectors';
import { scoreChip, scoreLabel } from './systemStatus';
import { TipBody, useChartTip } from './tooltip';
import { Chip, DataTable, EmptyNote, Eyebrow, EstimateChip, GlassPanel, Meter, NotRecorded, Ring, SectionHeader, ViewToggle, buttonClass } from './ui';

/**
 * AT A GLANCE: five floating tiles. Every figure is the model's (computeBusinessIntelligence, dataCompleteness) or the system's
 * own health score; the tiles only lay them out, count them up, and draw the small chart that goes with each.
 */

export interface SystemGlance {
  score: number;
  passedPages: number;
  totalPages: number;
  /** The health data of the agent server is available (it is not on localhost), so the score is the full one. */
  hasAgentData: boolean;
  /** The first answers (the agent's health or its failure, and the nine page checks) are not in yet, so the score is not a verdict. */
  checking: boolean;
}

interface GlanceTilesProps {
  bi: AdminBi;
  completeness: DataCompleteness;
  scope: TimeScope;
  system: SystemGlance;
  onOpenSystem: () => void;
}

const FIGURE = 'font-display font-bold leading-none text-white [font-variant-numeric:lining-nums] [overflow-wrap:anywhere]';

function Tile({ testId, eyebrow, tag, index, className = '', children }: { testId: string; eyebrow: string; tag?: React.ReactNode; index: number; className?: string; children: React.ReactNode }) {
  return (
    <Reveal delay={staggerDelay(index)} className={`h-full ${className}`}>
      <GlassPanel testId={testId} className="h-full" innerClassName="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Eyebrow>{eyebrow}</Eyebrow>
          {tag}
        </div>
        {children}
      </GlassPanel>
    </Reveal>
  );
}

// ─── 1. Upcoming events and the next one's countdown ─────────────────────────

const UpcomingTile = memo(function UpcomingTile({ bi, index }: { bi: AdminBi; index: number }) {
  const rows = bi.pipeline;
  const next = nextEvent(rows);
  const ahead = rows.flatMap((row) => (row.daysToGo !== null && row.daysToGo >= 0 ? [{ row, days: row.daysToGo }] : []));
  const horizon = Math.max(0, ...ahead.map((entry) => entry.days));
  const tip = useChartTip();

  return (
    <Tile testId="tile-upcoming" eyebrow="Upcoming events" index={index} className="lg:col-span-2">
      <div>
        <CountUp value={rows.length} format={(value) => formatCount(Math.round(value))} className={`block text-5xl ${FIGURE}`} testId="tile-upcoming-value" />
        <p className="mt-1 font-body text-xs" style={{ color: WHITE.a65 }}>
          {rows.length === 1 ? 'event' : 'events'} upcoming or live in this view
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyNote>No events in this view.</EmptyNote>
      ) : next ? (
        <div data-testid="tile-upcoming-next" className="min-w-0">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: WHITE.a50 }}>
            Next event
          </p>
          <p className="mt-1 font-body text-sm font-bold leading-snug text-white [overflow-wrap:anywhere]">{next.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-body text-xs" style={{ color: WHITE.a65 }}>
            <Icon name="calendar" className="h-3.5 w-3.5" />
            {next.dateLabel}
            <span aria-hidden="true">·</span>
            <span data-testid="tile-upcoming-countdown" className="font-bold text-accent">
              {next.daysLabel}
            </span>
          </p>
        </div>
      ) : (
        <p className="font-body text-xs" style={{ color: WHITE.a65 }}>
          None of these events has a date from today onwards. Check the dates in the Events tab.
        </p>
      )}
      {ahead.length > 0 ? (
        <div className="mt-auto" data-testid="tile-upcoming-horizon">
          <div className="relative mx-2 h-6">
            <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px" style={{ background: WHITE.a15 }} />
            {ahead.map(({ row, days }) => {
              const isNext = next !== null && row.id === next.id;
              const size = isNext ? 12 : 8;
              return (
                <span
                  key={row.id || row.title}
                  role="img"
                  tabIndex={0}
                  aria-label={`${row.title}, ${row.dateLabel}, ${row.daysLabel}`}
                  className="absolute top-1/2 block rounded-full"
                  style={{
                    left: `${horizon === 0 ? 0 : (days / horizon) * 100}%`,
                    width: size,
                    height: size,
                    transform: 'translate(-50%, -50%)',
                    background: isNext ? COLOR.gold : COLOR.goldPale,
                    boxShadow: `0 0 0 2px ${COLOR.black}`,
                  }}
                  {...tip.bind(`horizon-${row.id || row.title}`, () => (
                    <TipBody title={row.title} subtitle={`${row.dateLabel} · ${row.daysLabel}`} />
                  ))}
                />
              );
            })}
          </div>
          <div className="mt-1 flex justify-between font-body text-[10px]" style={{ color: WHITE.a50 }}>
            <span>Today</span>
            <span>{horizon === 0 ? 'Today' : `in ${horizon} days`}</span>
          </div>
        </div>
      ) : null}
    </Tile>
  );
});

// ─── 2. Forecast revenue with its low to high range ──────────────────────────

/** Which forecast the tile shows: the upcoming and live events', or (when only past events are in view) the past events' with no sales recorded. */
function forecastView(bi: AdminBi, scope: TimeScope) {
  const stat = scope === 'past' ? bi.forecast.past : bi.forecast.upcoming;
  const subject = scope === 'past' ? 'past events with no sales recorded' : 'upcoming and live events';
  const currency = primaryCurrency(stat.totals.map((total) => total.currency));
  const total = stat.totals.find((entry) => entry.currency === currency) ?? null;
  return { stat, subject, currency, total, others: stat.totals.length - 1 };
}

const ForecastTile = memo(function ForecastTile({ bi, scope, index }: { bi: AdminBi; scope: TimeScope; index: number }) {
  const { assumptions } = bi.forecast;
  const { stat, subject, currency, total, others } = forecastView(bi, scope);

  return (
    <Tile testId="tile-forecast" eyebrow="Forecast revenue" tag={<EstimateChip />} index={index} className="lg:col-span-2">
      {!assumptions.usable ? (
        <EmptyNote>No estimate can be made while the sell-through values in the reference data are not valid.</EmptyNote>
      ) : stat.events === 0 ? (
        <EmptyNote>No events in this view.</EmptyNote>
      ) : !total || !currency ? (
        <EmptyNote testId="tile-forecast-empty">
          No estimate yet for {theseEvents(stat.events)}. {describeLeftOut(stat)}. Enter Price and Capacity on each event (Events tab).
        </EmptyNote>
      ) : (
        <>
          <div>
            <CountUp value={total.revenue.expected} format={(value) => formatEstimate(value, currency)} className={`block text-4xl ${FIGURE}`} testId="tile-forecast-value" />
            <p className="mt-1 font-body text-xs" style={{ color: WHITE.a65 }}>
              expected, {subject}
              {stat.totals.length > 1 ? ` (${currency})` : ''}
            </p>
          </div>
          <RangeBar
            tipId="tile-forecast-range"
            low={total.revenue.low}
            expected={total.revenue.expected}
            high={total.revenue.high}
            testId="tile-forecast-range"
            ariaLabel="Estimated range from low to high, with the expected value marked"
            tipContent={
              <TipBody
                title="Estimated revenue"
                subtitle={subject}
                rows={[
                  { label: 'Low', value: formatEstimate(total.revenue.low, currency), swatch: 'hatch' },
                  { label: 'Expected', value: formatEstimate(total.revenue.expected, currency), swatch: 'hatch' },
                  { label: 'High', value: formatEstimate(total.revenue.high, currency), swatch: 'hatch' },
                ]}
                note="An estimate, not a record. Low and high are the lowest and highest genre averages: a range across genres."
              />
            }
          />
          <div className="flex justify-between gap-3 font-body text-xs" style={{ color: WHITE.a65 }}>
            <span data-testid="tile-forecast-low">
              Low <span className="font-bold text-white">{formatEstimate(total.revenue.low, currency)}</span>
            </span>
            <span data-testid="tile-forecast-high" className="text-right">
              High <span className="font-bold text-white">{formatEstimate(total.revenue.high, currency)}</span>
            </span>
          </div>
          <p className="mt-auto font-body text-[11px] leading-relaxed" style={{ color: WHITE.a50 }}>
            Estimated for {stat.forecast} of {stat.events} {stat.events === 1 ? 'event' : 'events'}
            {others > 0 ? `; ${others} other ${others === 1 ? 'currency is' : 'currencies are'} listed in the table below` : ''}.
          </p>
        </>
      )}
    </Tile>
  );
});

// ─── 3. Average ticket price against the national average ────────────────────

function PriceBar({ label, value, currency, share, fill, testId, tip, id, detail }: { label: string; value: number; currency: string; share: number; fill: string; testId: string; tip: ReturnType<typeof useChartTip>; id: string; detail: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 font-body text-xs">
        <span style={{ color: WHITE.a65 }}>{label}</span>
        <span data-testid={`${testId}-value`} className="font-bold tabular-nums text-white">
          {formatMoney(value, currency)}
        </span>
      </div>
      <div className="mt-1 h-2" style={{ background: WHITE.a08 }} data-testid={testId} role="img" tabIndex={0} aria-label={`${label}: ${formatMoney(value, currency)}`} {...tip.bind(id, detail)}>
        <Grow className="h-full" style={{ width: `${Math.max(2, share * 100)}%`, background: fill, borderRadius: '0 4px 4px 0' }} />
      </div>
    </div>
  );
}

const PriceTile = memo(function PriceTile({ bi, index }: { bi: AdminBi; index: number }) {
  const { summary, nationalAveragePrice: national } = bi;
  const tip = useChartTip();
  const currency = primaryCurrency(summary.price.ranges.map((range) => range.currency));
  const range = summary.price.ranges.find((entry) => entry.currency === currency);
  const comparable = national !== null && range !== undefined && national.currency === currency;
  const largest = range ? Math.max(range.average, comparable && national ? national.value : 0) : 0;

  return (
    <Tile testId="tile-price" eyebrow="Average ticket price" index={index} className="lg:col-span-2">
      {!range || !currency ? (
        <>
          <NotRecorded>
            {describeCoverage(summary.price.coverage)}. Enter Price on each event (Events tab)
          </NotRecorded>
        </>
      ) : (
        <>
          <div>
            <CountUp value={range.average} format={(value) => formatMoney(value, currency)} className={`block text-4xl ${FIGURE}`} testId="tile-price-value" />
            <p className="mt-1 font-body text-xs" style={{ color: WHITE.a65 }}>
              {describeCoverage(summary.price.coverage)}
              {summary.price.ranges.length > 1 ? ` (${currency}; ${summary.price.ranges.length - 1} other ${summary.price.ranges.length === 2 ? 'currency is' : 'currencies are'} in the table)` : ''}
            </p>
          </div>
          <div className="space-y-3">
            <PriceBar
              label="Your events"
              value={range.average}
              currency={currency}
              share={largest > 0 ? range.average / largest : 0}
              fill={COLOR.gold}
              testId="tile-price-bar-own"
              tip={tip}
              id="price-own"
              detail={
                <TipBody
                  title="Average ticket price of your events"
                  rows={[
                    { label: 'Average', value: formatMoney(range.average, currency), swatch: 'gold' },
                    { label: 'Lowest', value: formatMoney(range.min, currency) },
                    { label: 'Highest', value: formatMoney(range.max, currency) },
                    { label: 'Priced events', value: `${range.count} of ${summary.price.coverage.total}` },
                  ]}
                />
              }
            />
            {comparable && national ? (
              <PriceBar
                label={`National average, ${national.year}`}
                value={national.value}
                currency={national.currency}
                share={largest > 0 ? national.value / largest : 0}
                fill={COLOR.ivory}
                testId="tile-price-bar-national"
                tip={tip}
                id="price-national"
                detail={<TipBody title={`National average, all categories, ${national.year}`} subtitle="paid tickets, Live Performance Australia" rows={[{ label: 'Average', value: formatMoney(national.value, national.currency), swatch: 'ivory' }]} note="Context only: it is never part of a figure." />}
              />
            ) : null}
          </div>
          <p className="mt-auto font-body text-[11px] leading-relaxed" style={{ color: WHITE.a50 }}>
            <span data-testid="tile-price-range">
              range {formatMoney(range.min, currency)} to {formatMoney(range.max, currency)}
            </span>
            {comparable && national ? (
              <>
                {' · '}national average, all categories, {national.year} (paid tickets) (
                <SourceLink url={national.source.url} title={national.source.title}>
                  source
                </SourceLink>
                )
              </>
            ) : null}
          </p>
        </>
      )}
    </Tile>
  );
});

// ─── 4. Data completeness ────────────────────────────────────────────────────

const CompletenessTile = memo(function CompletenessTile({ completeness, index }: { completeness: DataCompleteness; index: number }) {
  const { ratio, recorded, total, parts } = completeness;
  const detailsId = useId();
  return (
    <Tile testId="tile-completeness" eyebrow="Data completeness" index={index} className="lg:col-span-3">
      {ratio === null ? (
        <EmptyNote>Nothing is required in this view, so there is nothing to measure.</EmptyNote>
      ) : (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <div className="flex items-center gap-4">
            <Ring ratio={ratio} size={124} label="Data completeness" valueText={`${formatPercent(ratio)}: ${recorded} of ${total} required fields recorded`} testId="tile-completeness-ring">
              <CountUp value={ratio} format={(value) => formatPercent(value)} className={`text-3xl ${FIGURE}`} testId="tile-completeness-value" />
            </Ring>
            <p className="max-w-[11rem] font-body text-xs leading-relaxed" style={{ color: WHITE.a65 }}>
              <span data-testid="tile-completeness-fields" className="font-bold text-white">
                {recorded} of {total}
              </span>{' '}
              required fields are recorded, for real revenue figures instead of estimates.
            </p>
          </div>
          <ul className="min-w-[14rem] flex-1 space-y-2.5" data-testid="tile-completeness-parts">
            {parts.map((part) => (
              <li key={part.id} data-testid={`tile-completeness-${part.id}`}>
                <div className="flex items-baseline justify-between gap-3 font-body text-xs">
                  <span style={{ color: WHITE.a65 }}>{part.label}</span>
                  <span className="shrink-0 font-bold tabular-nums text-white">{part.total === 0 ? 'none in view' : `${part.recorded} of ${part.total}`}</span>
                </div>
                <Meter ratio={part.ratio} label={part.label} valueText={part.total === 0 ? 'none in this view' : `${part.recorded} of ${part.total} ${part.noun}s`} className="mt-1" />
              </li>
            ))}
          </ul>
        </div>
      )}
      <details id={detailsId} className="mt-auto font-body text-[11px] leading-relaxed" style={{ color: WHITE.a50 }}>
        <summary className="inline-flex cursor-pointer items-center gap-1.5 font-bold uppercase tracking-[0.12em] text-accent pointer-coarse:min-h-11">
          <Icon name="info" className="h-3.5 w-3.5" />
          How is this worked out?
        </summary>
        <p className="mt-2" data-testid="tile-completeness-formula">
          Completeness is the fields recorded divided by the fields required. Every past event needs its ticket sales (tickets sold or ticket revenue). Every upcoming or live event needs a price, a capacity recorded
          on the event itself (the public capacity of its venue is a reference, not a record) and a ticket link that is one clean web address. Every sponsor needs a contract value; sponsors are always counted in
          full, whichever events are shown. A blank, 0, text or a negative number is not recorded.
        </p>
      </details>
    </Tile>
  );
});

// ─── 5. System health ────────────────────────────────────────────────────────

function HealthTile({ system, onOpenSystem, index }: { system: SystemGlance; onOpenSystem: () => void; index: number }) {
  const chip = scoreChip(system.score);
  return (
    <Tile testId="tile-health" eyebrow="System health" index={index} className="sm:col-span-2 lg:col-span-3">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
        {system.checking ? (
          <Ring ratio={null} indeterminate size={124} label="System health score" valueText="Checking the systems" testId="tile-health-ring">
            <span className="font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: WHITE.a65 }}>
              Checking
            </span>
          </Ring>
        ) : (
          <Ring ratio={system.score / 100} size={124} label="System health score" valueText={`${system.score} out of 100`} testId="tile-health-ring">
            <CountUp value={system.score} format={(value) => `${Math.round(value)}%`} className={`text-3xl ${FIGURE}`} testId="tile-health-value" />
          </Ring>
        )}
        <div className="min-w-[12rem] flex-1 space-y-3">
          {system.checking ? (
            <Chip tone="neutral" icon="clock" testId="tile-health-status">
              Checking
            </Chip>
          ) : (
            <Chip {...chip} testId="tile-health-status" />
          )}
          <dl className="space-y-1.5 font-body text-xs">
            <div className="flex justify-between gap-3">
              <dt style={{ color: WHITE.a65 }}>Pages healthy</dt>
              <dd data-testid="tile-health-pages" className="font-bold tabular-nums text-white">
                {system.checking ? 'Checking...' : `${system.passedPages} of ${system.totalPages}`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: WHITE.a65 }}>Agent server</dt>
              <dd data-testid="tile-health-agent" className="font-bold text-white">
                {system.checking ? 'Checking...' : system.hasAgentData ? 'Reachable' : 'Not reachable from here'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <button type="button" onClick={onOpenSystem} data-testid="tile-health-open" className={`${buttonClass('outline', 'sm')} mt-auto self-start`}>
        System & operations
        <Icon name="arrowRight" className="h-3.5 w-3.5" />
      </button>
    </Tile>
  );
}

/** The five tiles as one table: what each tile shows, in words and numbers. */
function GlanceTable({ bi, completeness, scope, system }: Omit<GlanceTilesProps, 'onOpenSystem'>) {
  const next = nextEvent(bi.pipeline);
  const { stat, subject, currency, total } = forecastView(bi, scope);
  const { summary, nationalAveragePrice: national } = bi;
  const priceCurrency = primaryCurrency(summary.price.ranges.map((entry) => entry.currency));
  const range = summary.price.ranges.find((entry) => entry.currency === priceCurrency);
  const rows = [
    {
      key: 'upcoming',
      cells: [
        'Upcoming events',
        formatCount(bi.pipeline.length),
        bi.pipeline.length === 0 ? 'No events in this view.' : next ? `Next event: ${next.title}, ${next.dateLabel}, ${next.daysLabel}` : 'None of these events has a date from today onwards.',
      ],
    },
    {
      key: 'forecast',
      cells: [
        'Forecast revenue (estimate)',
        total && currency ? formatEstimate(total.revenue.expected, currency) : 'No estimate',
        total && currency
          ? `Low ${formatEstimate(total.revenue.low, currency)}, high ${formatEstimate(total.revenue.high, currency)}; ${subject}; estimated for ${stat.forecast} of ${stat.events} events`
          : stat.events === 0
            ? 'No events in this view.'
            : `${stat.events} ${stat.events === 1 ? 'event' : 'events'} ${subject}: ${describeLeftOut(stat)}`,
      ],
    },
    {
      key: 'price',
      cells: [
        'Average ticket price',
        range && priceCurrency ? formatMoney(range.average, priceCurrency) : 'Not recorded',
        range && priceCurrency
          ? `${describeCoverage(summary.price.coverage)}; range ${formatMoney(range.min, priceCurrency)} to ${formatMoney(range.max, priceCurrency)}${national && national.currency === priceCurrency ? `; national average, all categories, ${national.year} (paid tickets): ${formatMoney(national.value, national.currency)}` : ''}`
          : `${describeCoverage(summary.price.coverage)}. Enter Price on each event (Events tab)`,
      ],
    },
    {
      key: 'completeness',
      cells: [
        'Data completeness',
        completeness.ratio === null ? 'Nothing required' : formatPercent(completeness.ratio),
        `${completeness.recorded} of ${completeness.total} required fields recorded: ${completeness.parts.map((part) => `${part.label} ${part.total === 0 ? 'none in view' : `${part.recorded} of ${part.total}`}`).join('; ')}`,
      ],
    },
    {
      key: 'health',
      cells: system.checking
        ? ['System health', 'Checking', 'The systems are being checked: the score follows when the answers are in.']
        : ['System health', `${system.score}%`, `${scoreLabel(system.score)}; pages healthy ${system.passedPages} of ${system.totalPages}; agent server ${system.hasAgentData ? 'reachable' : 'not reachable from here'}`],
    },
  ];
  return (
    <DataTable
      testId="glance-table-grid"
      caption="The five tiles of this section, as figures. The forecast is an estimate, not a record."
      columns={[{ label: 'Measure' }, { label: 'Value', align: 'right' }, { label: 'Detail' }]}
      rows={rows}
      minWidth="36rem"
    />
  );
}

export const GlanceTiles = memo(function GlanceTiles({ bi, completeness, scope, system, onOpenSystem }: GlanceTilesProps) {
  const titleId = useId();
  const [asTable, setAsTable] = useState(false);
  return (
    <section aria-labelledby={titleId} data-testid="glance">
      <Reveal>
        <SectionHeader eyebrow="Overview" title="At a glance" titleId={titleId} className="mb-4" actions={<ViewToggle pressed={asTable} onToggle={() => setAsTable((previous) => !previous)} testId="glance-view-toggle" />} />
      </Reveal>
      {asTable ? (
        <GlassPanel testId="glance-table">
          <GlanceTable bi={bi} completeness={completeness} scope={scope} system={system} />
        </GlassPanel>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <UpcomingTile bi={bi} index={0} />
          <ForecastTile bi={bi} scope={scope} index={1} />
          <PriceTile bi={bi} index={2} />
          <CompletenessTile completeness={completeness} index={3} />
          <HealthTile system={system} onOpenSystem={onOpenSystem} index={4} />
        </div>
      )}
    </section>
  );
});
