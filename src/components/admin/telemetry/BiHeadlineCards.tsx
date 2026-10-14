'use client';

import { describeCoverage, formatCount, formatMoney, formatPercent, type AdminBi } from '@/lib/admin-bi';
import { SourceLink, StatCard, TEAL, Unit, moneyFigure } from './biParts';

/**
 * The headline figures of the scope: what is recorded, with the number of records it stands on, or "Not recorded".
 * Ticket revenue and tickets sold are only what admins entered; revenue worked out from tickets sold x price is a separate line.
 */
export function BiHeadlineCards({ bi }: { bi: AdminBi }) {
  const { summary, sponsors } = bi;
  const derived = summary.derivedRevenue;
  const priced = summary.price;
  const sellThrough = summary.sellThrough;

  return (
    <div data-testid="bi-headline" className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <StatCard
        testId="bi-card-ticket-revenue"
        label="Ticket revenue (recorded)"
        figure={moneyFigure(summary.ticketRevenue)}
        figureColor={TEAL}
        coverage={
          summary.ticketRevenue.amounts.length === 0
            ? `${describeCoverage(summary.ticketRevenue.coverage)}. Enter Ticket Revenue on each event (Events tab)`
            : describeCoverage(summary.ticketRevenue.coverage)
        }
      >
        {derived.amounts.length > 0 ? (
          <p data-testid="bi-derived-revenue" className="text-[9px] font-body text-white/25 mt-0.5">
            plus {derived.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' and ')} worked out from tickets sold × price for{' '}
            {derived.coverage.recorded} {derived.coverage.recorded === 1 ? 'event' : 'events'} (not a recorded figure)
          </p>
        ) : null}
      </StatCard>

      <StatCard
        testId="bi-card-tickets-sold"
        label="Tickets sold (recorded)"
        figure={summary.ticketsSold.value === null ? null : formatCount(summary.ticketsSold.value)}
        coverage={
          summary.ticketsSold.value === null
            ? `${describeCoverage(summary.ticketsSold.coverage)}. Enter Tickets Sold on each event (Events tab)`
            : describeCoverage(summary.ticketsSold.coverage)
        }
      >
        {sellThrough.ratio !== null ? (
          <p data-testid="bi-sell-through" className="text-[9px] font-body text-white/25 mt-0.5">
            sell-through {formatPercent(sellThrough.ratio)}: {formatCount(sellThrough.sold)} sold of {formatCount(sellThrough.capacity)} seats, for the{' '}
            {sellThrough.coverage.recorded} {sellThrough.coverage.recorded === 1 ? 'event' : 'events'} with both recorded
          </p>
        ) : null}
      </StatCard>

      <StatCard
        testId="bi-card-average-price"
        label="Average ticket price"
        figureClass="text-accent"
        figure={
          priced.ranges.length === 0
            ? null
            : priced.ranges.map((range) => (
                <p key={range.currency} className={priced.ranges.length > 1 ? 'text-lg' : undefined}>
                  {formatMoney(range.average, range.currency)}
                  {priced.ranges.length > 1 ? <Unit small>{range.currency}</Unit> : null}
                </p>
              ))
        }
        coverage={
          priced.ranges.length === 0
            ? `${describeCoverage(priced.coverage)}. Enter Price on each event (Events tab)`
            : describeCoverage(priced.coverage)
        }
      >
        {priced.ranges.length > 0 ? (
          <p data-testid="bi-price-range" className="text-[9px] font-body text-white/25 mt-0.5">
            {priced.ranges.map((range) => `range ${formatMoney(range.min, range.currency)} to ${formatMoney(range.max, range.currency)}`).join(' · ')}
          </p>
        ) : null}
        {priced.ranges.length > 0 && bi.nationalAveragePrice ? (
          <p data-testid="bi-national-average" className="text-[9px] font-body text-white/25 mt-0.5">
            national average, all categories, {bi.nationalAveragePrice.year} (paid tickets): {formatMoney(bi.nationalAveragePrice.value, bi.nationalAveragePrice.currency)} (
            <SourceLink url={bi.nationalAveragePrice.source.url} title={bi.nationalAveragePrice.source.title}>
              source
            </SourceLink>
            )
          </p>
        ) : null}
      </StatCard>

      <StatCard
        testId="bi-card-potential-gross"
        label="Potential gross if sold out"
        figure={moneyFigure(summary.potentialGross)}
        coverage={
          summary.potentialGross.amounts.length === 0
            ? `${describeCoverage(summary.potentialGross.coverage)} with both a price and a capacity. Enter both on the same event (Events tab)`
            : `${describeCoverage(summary.potentialGross.coverage)} with both a price and a capacity`
        }
      >
        {summary.potentialGross.amounts.length > 0 ? <p className="text-[9px] font-body text-white/25 mt-0.5">if every seat sold at the listed price</p> : null}
      </StatCard>

      <StatCard
        testId="bi-card-sponsor-revenue"
        label="Sponsor revenue (recorded)"
        figure={moneyFigure(sponsors.revenue)}
        figureColor={TEAL}
        coverage={
          sponsors.revenue.amounts.length === 0
            ? `${describeCoverage(sponsors.revenue.coverage, 'sponsor')}. Enter Revenue on each sponsor (Sponsors tab)`
            : describeCoverage(sponsors.revenue.coverage, 'sponsor')
        }
      />

      <StatCard
        testId="bi-card-sponsor-contract"
        label="Sponsor contract value (recorded)"
        figure={moneyFigure(sponsors.contractValue)}
        figureClass="text-accent"
        coverage={
          sponsors.contractValue.amounts.length === 0
            ? `${describeCoverage(sponsors.contractValue.coverage, 'sponsor')}. Enter Contract Value on each sponsor (Sponsors tab)`
            : describeCoverage(sponsors.contractValue.coverage, 'sponsor')
        }
      />
    </div>
  );
}
