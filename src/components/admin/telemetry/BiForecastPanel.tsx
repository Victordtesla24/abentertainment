'use client';

import { formatEstimate, type AdminBi, type ForecastStat } from '@/lib/admin-bi';
import { CARD, EmptyNote, EstimateLegend, EstimateTag, Panel, describeLeftOut, scenarioLabels } from './biParts';

function ForecastBlock({ title, testId, stat, labels }: { title: string; testId: string; stat: ForecastStat; labels: [string, string, string] }) {
  return (
    <div data-testid={testId}>
      <p className="text-[9px] font-body uppercase tracking-[0.15em] text-white/30 mb-2">{title}</p>
      {stat.events === 0 ? (
        <p className="text-xs font-body text-white/30">No such events in this view.</p>
      ) : stat.forecast === 0 ? (
        <p className="text-xs font-body text-white/30">
          No estimate yet for these {stat.events} {stat.events === 1 ? 'event' : 'events'}. {describeLeftOut(stat)}.
        </p>
      ) : (
        <div className="space-y-2">
          {stat.totals.map((total) => (
            <div key={total.currency} className="grid grid-cols-3 gap-2 text-center">
              {([total.revenue.low, total.revenue.expected, total.revenue.high] as const).map((amount, index) => (
                <div key={labels[index]} className="border border-white/5 p-3" style={{ backgroundColor: CARD }}>
                  <p className="text-[9px] font-body uppercase tracking-[0.15em] text-white/30">{labels[index]}</p>
                  <p className={`font-display font-bold text-purple-500 mt-1 ${index === 1 ? 'text-base' : 'text-sm'}`}>
                    {formatEstimate(amount, total.currency)}
                  </p>
                  {stat.totals.length > 1 ? <p className="text-[9px] font-body text-white/25 mt-0.5">{total.currency}</p> : null}
                </div>
              ))}
            </div>
          ))}
          <p className="text-[9px] font-body text-white/25">
            Estimated for {stat.forecast} of {stat.events} {stat.events === 1 ? 'event' : 'events'}
            {stat.referenceCapacity > 0 ? `, ${stat.referenceCapacity} of them on the public capacity of their venue` : ''}
            {describeLeftOut(stat) ? `. Not estimated: ${describeLeftOut(stat)}` : ''}.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * What the events without recorded sales could take: price x capacity x three sell-through values. Every figure is an
 * estimate and is marked so; none is added to anything recorded.
 */
export function BiForecastPanel({ bi }: { bi: AdminBi }) {
  const { assumptions, upcoming, past } = bi.forecast;
  const labels = scenarioLabels(assumptions);

  return (
    <Panel title={assumptions.kind === 'scenario' ? 'Revenue scenarios' : 'Revenue forecast'} testId="bi-forecast" tag={<EstimateTag />}>
      {assumptions.usable ? (
        <div className="space-y-4">
          <ForecastBlock title="Upcoming and live events" testId="bi-forecast-upcoming" stat={upcoming} labels={labels} />
          <div className="pt-4 border-t border-white/5">
            <ForecastBlock title="Past events with no sales recorded" testId="bi-forecast-past" stat={past} labels={labels} />
          </div>
        </div>
      ) : (
        <EmptyNote>No estimate can be made while the sell-through values in the reference data are not valid.</EmptyNote>
      )}
      <EstimateLegend assumptions={assumptions} />
    </Panel>
  );
}
