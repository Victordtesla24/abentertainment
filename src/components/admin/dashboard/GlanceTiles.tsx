'use client';

import { memo, useId, useState, type ReactNode } from 'react';
import { describeCoverage, formatCount, formatEstimate, formatMoney, formatPercent, type AdminBi, type CompletenessPartId, type DataCompleteness, type TimeScope } from '@/lib/admin-bi';
import { COLOR, WHITE } from './brand';
import { describeLeftOut, EstimateLegend, SourceLink, theseEvents } from './biText';
import { niceScale } from './chartMath';
import { Dial, FIGURE, Ring, type DialMark } from './dial';
import { dotLanes, laneOffset } from './radial';
import { MirrorHotspot } from './hotspots';
import { Icon } from './icons';
import { CountUp, Reveal, staggerDelay } from './motion';
import { InfoButton, PopoverText } from './popover';
import { nextEvent, primaryCurrency } from './selectors';
import { scoreChip, scoreLabel } from './systemStatus';
import { TipBody, useChartTip } from './tooltip';
import { Chip, DataTable, EmptyNote, Eyebrow, EstimateChip, GlassPanel, NotRecorded, SectionHeader, ViewToggle, buttonClass } from './ui';

/**
 * AT A GLANCE: five floating tiles, each a dial or a ring with one big number, a word or three, and a unit. Every figure is the model's
 * (computeBusinessIntelligence, dataCompleteness) or the system's own health score; the tiles only lay them out, count them up and
 * draw them on a scale. What used to be written under a figure (how it is worked out, where it comes from, how many events stand
 * behind it) is in the tile's tooltip and behind its "i".
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

interface TileProps {
  testId: string;
  eyebrow: string;
  tag?: ReactNode;
  info?: { label: string; content: ReactNode; width?: number };
  index: number;
  className?: string;
  children: ReactNode;
}

function Tile({ testId, eyebrow, tag, info, index, className = '', children }: TileProps) {
  return (
    <Reveal delay={staggerDelay(index)} className={`h-full ${className}`}>
      <GlassPanel testId={testId} className="h-full" innerClassName="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Eyebrow>{eyebrow}</Eyebrow>
            {tag}
          </div>
          {info ? (
            <InfoButton label={info.label} testId={`${testId}-info`} width={info.width}>
              {info.content}
            </InfoButton>
          ) : null}
        </div>
        {children}
      </GlassPanel>
    </Reveal>
  );
}

/** The line under a big number: what it is in a word or three, in the muted ink. */
function Caption({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p data-testid={testId} className="font-body text-xs" style={{ color: WHITE.a65 }}>
      {children}
    </p>
  );
}

// ─── 1. Upcoming events on a scale of days ───────────────────────────────────

const UpcomingTile = memo(function UpcomingTile({ bi, index }: { bi: AdminBi; index: number }) {
  const rows = bi.pipeline;
  const next = nextEvent(rows);
  const ahead = rows.flatMap((row) => (row.daysToGo !== null && row.daysToGo >= 0 ? [{ row, days: row.daysToGo }] : []));
  const horizon = Math.max(0, ...ahead.map((entry) => entry.days));
  const tip = useChartTip();
  // events whose days are close would touch on the arc: each goes to the nearest free lane, so every one can be pointed at
  const ratios = ahead.map(({ days }) => (horizon === 0 ? 0 : days / horizon));
  const lanes = dotLanes(ratios, 0.09);
  const marks: DialMark[] = ahead.map(({ row }, place) => {
    const isNext = next !== null && row.id === next.id;
    const id = row.id || row.title;
    return {
      id,
      ratio: ratios[place],
      offset: laneOffset(lanes[place]),
      label: `${row.title}, ${row.dateLabel}, ${row.daysLabel}`,
      shape: 'dot',
      emphasis: isNext,
      tip: tip.bind(`horizon-${id}`, () => <TipBody title={row.title} subtitle={`${row.dateLabel} · ${row.daysLabel}`} />),
    };
  });
  const scale: readonly [string, string] = ['Today', horizon === 0 ? 'Today' : `in ${horizon} days`];

  return (
    <Tile testId="tile-upcoming" eyebrow="Upcoming events" index={index} className="lg:col-span-2">
      {/* the tile is the shortest of its row: its picture and its next event sit in the middle of what the row gives it, not in its top with a blank under them */}
      <div className="flex flex-1 flex-col justify-center gap-3">
        <div data-testid="tile-upcoming-horizon" className="min-w-0">
          <Dial
            ratio={null}
            state="recorded"
            marks={marks}
            divisions={4}
            scale={scale}
            width={236}
            label="Upcoming and live events on a scale of days from today"
            valueText={`${rows.length} ${rows.length === 1 ? 'event' : 'events'}${ahead.length > 0 ? `, the last in ${horizon} days` : ''}`}
          >
            <CountUp value={rows.length} format={(value) => formatCount(Math.round(value))} className={`block text-5xl ${FIGURE}`} testId="tile-upcoming-value" />
            <span className="mt-1.5 font-body text-xs" style={{ color: WHITE.a65 }}>
              upcoming or live
            </span>
          </Dial>
        </div>
        {rows.length === 0 ? (
          <EmptyNote>No events in this view.</EmptyNote>
        ) : next ? (
          <div data-testid="tile-upcoming-next" className="min-w-0 text-center">
            <p className="truncate font-body text-sm font-bold leading-snug text-white" title={next.title}>
              {next.title}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2 font-body text-xs" style={{ color: WHITE.a65 }}>
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
      </div>
    </Tile>
  );
});

// ─── 2. Forecast revenue: a needle on a scale, the range hatched ─────────────

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
  const tip = useChartTip();
  const scale = total ? niceScale(total.revenue.high, 5).max : 1;

  return (
    <Tile
      testId="tile-forecast"
      eyebrow="Forecast revenue"
      tag={<EstimateChip />}
      info={{ label: 'the forecast', content: <PopoverText title="How the forecast is made"><EstimateLegend assumptions={assumptions} testId="tile-forecast-legend" /></PopoverText>, width: 380 }}
      index={index}
      className="lg:col-span-2"
    >
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
          <Dial
            ratio={total.revenue.expected / scale}
            band={{ from: total.revenue.low / scale, to: total.revenue.high / scale }}
            needle
            hatched
            divisions={4}
            scale={[formatMoney(0, currency), formatMoney(scale, currency)]}
            width={236}
            testId="tile-forecast-range"
            label="Estimated revenue from low to high, with the expected value marked"
            valueText={`expected ${formatEstimate(total.revenue.expected, currency)}, from ${formatEstimate(total.revenue.low, currency)} to ${formatEstimate(total.revenue.high, currency)}`}
            tip={tip.bind('tile-forecast-range', () => (
              <TipBody
                title="Estimated revenue"
                subtitle={subject}
                rows={[
                  { label: 'Low', value: formatEstimate(total.revenue.low, currency), swatch: 'hatch' },
                  { label: 'Expected', value: formatEstimate(total.revenue.expected, currency), swatch: 'hatch' },
                  { label: 'High', value: formatEstimate(total.revenue.high, currency), swatch: 'hatch' },
                ]}
                note={
                  <>
                    Estimated for {stat.forecast} of {stat.events} {stat.events === 1 ? 'event' : 'events'}
                    {others > 0 ? `; ${others} other ${others === 1 ? 'currency is' : 'currencies are'} listed in the table` : ''}. An estimate, not a record. Low and high are the lowest and highest genre averages: a range across genres.
                  </>
                }
              />
            ))}
          >
            <CountUp value={total.revenue.expected} format={(value) => formatEstimate(value, currency)} className={`block text-4xl ${FIGURE}`} testId="tile-forecast-value" />
            <span className="mt-1.5 font-body text-xs" style={{ color: WHITE.a65 }}>
              expected{stat.totals.length > 1 ? ` (${currency})` : ''}
            </span>
          </Dial>
          <div className="flex justify-between gap-3 font-body text-xs" style={{ color: WHITE.a65 }}>
            <span data-testid="tile-forecast-low">
              Low <span className="font-bold text-white">{formatEstimate(total.revenue.low, currency)}</span>
            </span>
            <span data-testid="tile-forecast-high" className="text-right">
              High <span className="font-bold text-white">{formatEstimate(total.revenue.high, currency)}</span>
            </span>
          </div>
          <Caption testId="tile-forecast-coverage">
            {stat.forecast} of {stat.events} {stat.events === 1 ? 'event' : 'events'}
          </Caption>
        </>
      )}
    </Tile>
  );
});

// ─── 3. Average ticket price: an arc against the national average ────────────

const PriceTile = memo(function PriceTile({ bi, index }: { bi: AdminBi; index: number }) {
  const { summary, nationalAveragePrice: national } = bi;
  const tip = useChartTip();
  const currency = primaryCurrency(summary.price.ranges.map((range) => range.currency));
  const range = summary.price.ranges.find((entry) => entry.currency === currency);
  const comparable = national !== null && range !== undefined && national.currency === currency;
  const largest = range ? Math.max(range.average, comparable && national ? national.value : 0) : 0;
  const scale = niceScale(largest, 5).max;
  const marks: DialMark[] =
    comparable && national
      ? [
          {
            id: 'national',
            ratio: national.value / scale,
            label: `National average, all categories, ${national.year}: ${formatMoney(national.value, national.currency)}`,
            testId: 'tile-price-mark-national',
            tip: tip.bind('price-national', <TipBody title={`National average, all categories, ${national.year}`} subtitle="paid tickets, Live Performance Australia" rows={[{ label: 'Average', value: formatMoney(national.value, national.currency), swatch: 'ivory' }]} note="Context only: it is never part of a figure." />),
          },
        ]
      : [];

  return (
    <Tile
      testId="tile-price"
      eyebrow="Average ticket price"
      info={
        range && comparable && national
          ? {
              label: 'the average ticket price',
              content: (
                <PopoverText title="Where the comparison comes from">
                  <p data-testid="tile-price-source">
                    National average, all categories, {national.year} (paid tickets) (
                    <SourceLink url={national.source.url} title={national.source.title}>
                      source
                    </SourceLink>
                    ). It is context only: it is never part of a figure.
                  </p>
                </PopoverText>
              ),
            }
          : undefined
      }
      index={index}
      className="lg:col-span-2"
    >
      {!range || !currency ? (
        <>
          <Dial ratio={null} width={236} label="Average ticket price" valueText="Not recorded" divisions={4} testId="tile-price-dial" />
          {summary.price.coverage.total === 0 ? (
            <EmptyNote testId="tile-price-empty">No events in this view.</EmptyNote>
          ) : (
            <NotRecorded className="block text-center">
              for {summary.price.coverage.total === 1 ? 'the event' : `any of the ${summary.price.coverage.total} events`}. Enter Price on each event (Events tab)
            </NotRecorded>
          )}
        </>
      ) : (
        <>
          <Dial
            ratio={range.average / scale}
            marks={marks}
            divisions={4}
            width={236}
            readout="below"
            scale={[formatMoney(0, currency), formatMoney(scale, currency)]}
            testId="tile-price-dial"
            label="Average ticket price of your events"
            valueText={`${formatMoney(range.average, currency)}${comparable && national ? `, the national average is ${formatMoney(national.value, national.currency)}` : ''}`}
            tip={tip.bind('price-own', () => (
              <TipBody
                title="Average ticket price of your events"
                rows={[
                  { label: 'Average', value: formatMoney(range.average, currency), swatch: 'gold' },
                  { label: 'Lowest', value: formatMoney(range.min, currency) },
                  { label: 'Highest', value: formatMoney(range.max, currency) },
                  { label: 'Priced events', value: `${range.count} of ${summary.price.coverage.total}` },
                ]}
                note={`${describeCoverage(summary.price.coverage)}${summary.price.ranges.length > 1 ? ` (${currency}; ${summary.price.ranges.length - 1} other ${summary.price.ranges.length === 2 ? 'currency is' : 'currencies are'} in the table)` : ''}`}
              />
            ))}
          >
            <CountUp value={range.average} format={(value) => formatMoney(value, currency)} className={`block text-4xl ${FIGURE}`} testId="tile-price-value" />
            <span className="mt-1.5 font-body text-xs" style={{ color: WHITE.a65 }}>
              <span data-testid="tile-price-coverage">
                {range.count} of {summary.price.coverage.total} {summary.price.coverage.total === 1 ? 'event' : 'events'}
              </span>
            </span>
          </Dial>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-body text-xs" style={{ color: WHITE.a65 }}>
            <span data-testid="tile-price-range">
              range {formatMoney(range.min, currency)} to {formatMoney(range.max, currency)}
            </span>
            {comparable && national ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-3 w-0.5 rounded-full" style={{ background: COLOR.cream }} />
                National {national.year}{' '}
                <span data-testid="tile-price-national-value" className="font-bold tabular-nums text-white">
                  {formatMoney(national.value, national.currency)}
                </span>
              </span>
            ) : null}
          </div>
        </>
      )}
    </Tile>
  );
});

// ─── 4. Data completeness: one ring, and a small ring for each part ──────────

/** The short name each part of the completeness is drawn under: a word or two (the full name is in its tooltip). */
const PART_NAME: Record<CompletenessPartId, string> = {
  'past-sales': 'Past sales',
  'upcoming-price': 'Prices',
  'upcoming-capacity': 'Capacity',
  'upcoming-ticket-link': 'Ticket links',
  'sponsor-contract': 'Contracts',
};

/** The actions that concern each part (the beacon is on the visual that shows the same measure; here it is drawn small beside the part). */
const PART_ACTIONS: Record<CompletenessPartId, readonly string[]> = {
  'past-sales': ['record-ticket-sales'],
  'upcoming-price': ['add-prices'],
  'upcoming-capacity': ['add-capacity'],
  'upcoming-ticket-link': ['add-ticket-links', 'fix-ticket-links'],
  'sponsor-contract': ['record-contract-values'],
};

const TAB_OF: Record<DataCompleteness['parts'][number]['target'], string> = { events: 'Events', sponsors: 'Sponsors' };

const CompletenessTile = memo(function CompletenessTile({ completeness, index }: { completeness: DataCompleteness; index: number }) {
  const { ratio, recorded, total, parts } = completeness;
  const tip = useChartTip();
  return (
    <Tile
      testId="tile-completeness"
      eyebrow="Data completeness"
      info={{
        label: 'data completeness',
        content: (
          <PopoverText title="How data completeness is worked out">
            <p data-testid="tile-completeness-formula">
              Completeness is the fields recorded divided by the fields required. Every past event needs its ticket sales (tickets sold or ticket revenue). Every upcoming or live event needs a price, a capacity recorded on the
              event itself (the public capacity of its venue is a reference, not a record) and a ticket link that is one clean web address. Every sponsor needs a contract value; sponsors are always counted in full, whichever
              events are shown. A blank, 0, text or a negative number is not recorded.
            </p>
          </PopoverText>
        ),
        width: 380,
      }}
      index={index}
      className="lg:col-span-3"
    >
      {ratio === null ? (
        <EmptyNote>Nothing is required in this view, so there is nothing to measure.</EmptyNote>
      ) : (
        <div className="@container">
          {/* the overall ring and a small ring for each part in one grid: three columns (the overall ring first) while the tile is narrow, and the overall ring beside a block of the parts when it is wide */}
          <ul
            data-testid="tile-completeness-parts"
            className="grid grid-cols-3 items-start gap-x-2 gap-y-4 @[27rem]:grid-cols-[auto_repeat(3,minmax(0,1fr))] @[27rem]:gap-x-3 @[42rem]:grid-cols-[auto_repeat(5,minmax(0,1fr))]"
          >
            <li data-testid="tile-completeness-overall" className="flex flex-col items-center gap-2 @[27rem]:row-span-2 @[27rem]:self-center @[27rem]:pr-3 @[42rem]:row-span-1">
              <Ring
                ratio={ratio}
                size={96}
                ticks
                glow
                label="Data completeness"
                valueText={`${formatPercent(ratio)}: ${recorded} of ${total} required fields recorded`}
                testId="tile-completeness-ring"
                tip={tip.bind('completeness-ring', () => (
                  <TipBody
                    title="Data completeness"
                    rows={[{ label: 'Fields recorded', value: `${recorded} of ${total}` }]}
                    note={`${recorded} of ${total} required fields are recorded, for real revenue figures instead of estimates.`}
                  />
                ))}
              >
                <CountUp value={ratio} format={(value) => formatPercent(value)} className={`text-2xl ${FIGURE}`} testId="tile-completeness-value" />
              </Ring>
              <p className="font-body text-xs" style={{ color: WHITE.a65 }}>
                <span data-testid="tile-completeness-fields" className="font-bold text-white">
                  {recorded} of {total}
                </span>{' '}
                fields
              </p>
            </li>
            {parts.map((part) => (
              <li key={part.id} data-testid={`tile-completeness-${part.id}`} className="mx-auto flex w-[5.25rem] flex-col items-center gap-1 text-center">
                <Ring
                  ratio={part.ratio}
                  size={64}
                  thickness={10}
                  label={part.label}
                  valueText={part.total === 0 ? 'none in this view' : `${part.recorded} of ${part.total} ${part.noun}s`}
                  testId={`tile-completeness-${part.id}-ring`}
                  tip={tip.bind(`completeness-${part.id}`, () => (
                    <TipBody
                      title={part.label}
                      rows={[{ label: 'Recorded', value: part.total === 0 ? 'none in view' : `${part.recorded} of ${part.total} ${part.noun}s` }]}
                      note={part.total > 0 && part.recorded < part.total ? `Enter it on each ${part.noun} (${TAB_OF[part.target]} tab).` : undefined}
                    />
                  ))}
                >
                  <span className="font-display text-sm font-bold leading-none text-white [font-variant-numeric:lining-nums]">{part.ratio === null ? '–' : formatPercent(part.ratio)}</span>
                </Ring>
                <p className="font-body text-xs font-bold leading-tight text-white">{PART_NAME[part.id]}</p>
                <p className="font-body text-[11px] tabular-nums" style={{ color: WHITE.a65 }}>
                  {part.total === 0 ? 'none in view' : `${part.recorded} of ${part.total}`}
                </p>
                {/* the action that concerns this part, on the line under its words: never on the ring, so no part of the arc is hidden and the two have nothing in common to press */}
                <MirrorHotspot ids={PART_ACTIONS[part.id]} testId={`tile-completeness-${part.id}-action`} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Tile>
  );
});

// ─── 5. System health ────────────────────────────────────────────────────────

function HealthTile({ system, onOpenSystem, index }: { system: SystemGlance; onOpenSystem: () => void; index: number }) {
  const chip = scoreChip(system.score);
  const tip = useChartTip();
  return (
    <Tile testId="tile-health" eyebrow="System health" index={index} className="sm:col-span-2 lg:col-span-3">
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:justify-start">
        {system.checking ? (
          <Ring ratio={null} indeterminate size={124} label="System health score" valueText="Checking the systems" testId="tile-health-ring">
            <span className="font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: WHITE.a65 }}>
              Checking
            </span>
          </Ring>
        ) : (
          <Ring
            ratio={system.score / 100}
            size={124}
            ticks
            glow
            label="System health score"
            valueText={`${system.score} out of 100`}
            testId="tile-health-ring"
            tip={tip.bind('health-ring', () => (
              <TipBody
                title="System health"
                rows={[
                  { label: 'Score', value: `${system.score} out of 100 (${scoreLabel(system.score)})` },
                  { label: 'Pages answering', value: `${system.passedPages} of ${system.totalPages}` },
                  { label: 'Agent', value: system.hasAgentData ? 'Reachable' : 'Not reachable from here' },
                ]}
                note="The score is made from the agent's version, workspace, API keys, models and whether it is running, and how many of the pages answer."
              />
            ))}
          >
            <CountUp value={system.score} format={(value) => `${Math.round(value)}%`} className={`text-3xl ${FIGURE}`} testId="tile-health-value" />
          </Ring>
        )}
        <div className="min-w-[10rem] flex-1 space-y-3">
          {system.checking ? (
            <Chip tone="neutral" icon="clock" testId="tile-health-status">
              Checking
            </Chip>
          ) : (
            <Chip {...chip} testId="tile-health-status" />
          )}
          <dl className="space-y-1.5 font-body text-xs">
            <div className="flex justify-between gap-3">
              <dt style={{ color: WHITE.a65 }}>Pages</dt>
              <dd data-testid="tile-health-pages" className="font-bold tabular-nums text-white">
                {system.checking ? 'Checking...' : `${system.passedPages} of ${system.totalPages}`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: WHITE.a65 }}>Agent</dt>
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
