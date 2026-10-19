import type { ReactNode } from 'react';
import { formatCount, formatEstimate, formatMoney, formatPercent, type ForecastAssumptions, type ForecastStat } from '@/lib/admin-bi';
import { describeLeftOut, describeSellThrough, noEstimateReason } from '../biText';
import { TipBody } from '../tooltip';
import type { EventMark, ForecastPoint } from './series';

/**
 * What the marks of the forecast charts say: to a screen reader (a label), and in their tooltip. The words are the ones the dials' tooltips used,
 * so what a reader could learn by pointing at a dial is what pointing at the mark of an event says now, and every figure here is a figure of the
 * model (an event's own forecast, its recorded revenue) or a sum of them, labelled as such. Nothing here is drawn: it is only text.
 */

const noun = (count: number): string => (count === 1 ? 'event' : 'events');

/** What a point of a forecast line says to a screen reader. */
export function forecastPointLabel(point: ForecastPoint, currency: string): string {
  return `${point.title}, ${point.dateLabel}, ${point.daysLabel}; expected ${formatEstimate(point.expected, currency)}, an estimate from ${formatEstimate(point.low, currency)} to ${formatEstimate(point.high, currency)}; the events up to here add up to an expected ${formatEstimate(point.runExpected, currency)}`;
}

/** The tooltip of a point of a forecast line: the event's own estimate, what the events up to it add up to, and how the estimate was made. */
export function forecastPointTip(point: ForecastPoint, currency: string, labels: readonly [string, string, string], stat: ForecastStat): ReactNode {
  const leftOut = describeLeftOut(stat);
  return (
    <TipBody
      title={point.title}
      subtitle={`${point.dateLabel} · ${point.daysLabel}`}
      rows={[
        { label: labels[0], value: formatEstimate(point.low, currency), swatch: 'hatch' },
        { label: labels[1], value: formatEstimate(point.expected, currency), swatch: 'hatch' },
        { label: labels[2], value: formatEstimate(point.high, currency), swatch: 'hatch' },
        { label: 'Running total, expected', value: formatEstimate(point.runExpected, currency), swatch: 'hatch' },
      ]}
      note={`An estimate, not a record. Estimated for ${stat.forecast} of ${stat.events} ${noun(stat.events)}${stat.referenceCapacity > 0 ? `, ${stat.referenceCapacity} of them on the public capacity of their venue` : ''}${leftOut ? `. Not estimated: ${leftOut}` : ''}.`}
    />
  );
}

/** What an event of the chart of events says to a screen reader. */
export function eventMarkLabel(mark: EventMark): string {
  const { row, kind } = mark;
  if (kind === 'estimate' && row.forecast) {
    return `${row.title}: expected ${formatEstimate(row.forecast.revenue.expected, row.forecast.currency)}, an estimate from ${formatEstimate(row.forecast.revenue.low, row.forecast.currency)} to ${formatEstimate(row.forecast.revenue.high, row.forecast.currency)}; revenue not recorded`;
  }
  if (kind === 'recorded' && row.revenue) return `${row.title}: recorded revenue ${formatMoney(row.revenue.amount, row.revenue.currency)}`;
  return `${row.title}: no estimate`;
}

/** The tooltip of an event of the chart of events: its dates, its estimate or its record, and why there is none. */
export function eventMarkTip(mark: EventMark, assumptions: ForecastAssumptions): ReactNode {
  const { row, kind } = mark;
  const forecast = row.forecast;
  const rows = (() => {
    if (kind === 'estimate' && forecast) {
      return [
        { label: 'Low', value: formatEstimate(forecast.revenue.low, forecast.currency), swatch: 'hatch' as const },
        { label: 'Expected', value: formatEstimate(forecast.revenue.expected, forecast.currency), swatch: 'hatch' as const },
        { label: 'High', value: formatEstimate(forecast.revenue.high, forecast.currency), swatch: 'hatch' as const },
        { label: 'Capacity', value: `${formatCount(forecast.capacity.value)} (${forecast.capacity.kind === 'reference' ? 'public' : 'recorded'})` },
        { label: 'Ticket price', value: formatMoney(forecast.price, forecast.currency) },
        { label: 'Recorded revenue', value: 'Not recorded' },
      ];
    }
    if (kind === 'recorded' && row.revenue) {
      return [
        { label: 'Recorded revenue', value: formatMoney(row.revenue.amount, row.revenue.currency), swatch: 'gold' as const },
        ...(row.sold !== null ? [{ label: 'Tickets sold', value: formatCount(row.sold) }] : []),
        ...(row.sellThrough !== null ? [{ label: 'Sell-through', value: formatPercent(row.sellThrough) }] : []),
      ];
    }
    return [{ label: 'Estimate', value: 'None' }, { label: 'Recorded revenue', value: row.revenue ? formatMoney(row.revenue.amount, row.revenue.currency) : 'Not recorded' }];
  })();
  const note =
    kind === 'estimate' && forecast
      ? `An estimate, not a record. At ${describeSellThrough(forecast.sellThrough, assumptions)}.`
      : kind === 'recorded'
        ? 'A recorded figure: it is never estimated.'
        : `No estimate: ${noEstimateReason(row)}.`;
  return <TipBody title={row.title} subtitle={`${row.dateLabel} · ${row.daysLabel}`} rows={rows} note={note} />;
}
