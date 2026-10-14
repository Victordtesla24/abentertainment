'use client';

import { describeCoverage, formatMoney, type AdminBi } from '@/lib/admin-bi';
import { BarRow, Cell, EmptyNote, MoneyInline, Panel, Unit } from './biParts';

/** Sponsors by tier, what their contracts and revenue add up to where it is recorded, and how many events they are linked to. */
export function BiSponsorPanel({ bi }: { bi: AdminBi }) {
  const { sponsors } = bi;
  const largest = Math.max(...sponsors.tiers.map((tier) => tier.sponsors.length), 1);

  return (
    <Panel title="Sponsorship" testId="bi-sponsors">
      {sponsors.total === 0 ? (
        <EmptyNote>No sponsors yet. Add them in the Sponsors tab.</EmptyNote>
      ) : (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-3">
            <Cell label="Sponsors" note={`${sponsors.visible} shown on the website · ${sponsors.hidden} hidden`}>
              {sponsors.total}
            </Cell>
            <Cell label="Revenue (recorded)" note={describeCoverage(sponsors.revenue.coverage, 'sponsor')}>
              <MoneyInline stat={sponsors.revenue} />
            </Cell>
            <Cell label="Contract value (recorded)" note={describeCoverage(sponsors.contractValue.coverage, 'sponsor')}>
              <MoneyInline stat={sponsors.contractValue} />
            </Cell>
            <Cell
              label="Events with sponsors"
              note={sponsors.eventsWithSponsors.total === 0 ? 'no events in this view' : `${sponsors.eventsWithSponsors.total - sponsors.eventsWithSponsors.recorded} in this view have none`}
            >
              {sponsors.eventsWithSponsors.recorded} of {sponsors.eventsWithSponsors.total}
            </Cell>
            <Cell label="Not linked to any event" note="any event, past or upcoming">
              {sponsors.unlinked.count}
            </Cell>
          </dl>
          <ul className="space-y-3 mt-4 pt-3 border-t border-white/5">
            {sponsors.tiers.map((tier) => (
              <li key={tier.key || 'none'} data-testid={`bi-tier-${tier.key || 'none'}`}>
                <BarRow
                  label={tier.label}
                  percent={(tier.sponsors.length / largest) * 100}
                  value={
                    <>
                      {tier.sponsors.length}
                      <Unit>{tier.sponsors.length === 1 ? 'sponsor' : 'sponsors'}</Unit>
                    </>
                  }
                />
                <p className="text-[10px] font-body text-white/40 mt-1">
                  {tier.visible} shown · {tier.hidden} hidden · revenue{' '}
                  {tier.revenue.amounts.length === 0 ? 'not recorded' : tier.revenue.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' and ')} (
                  {tier.revenue.coverage.recorded} of {tier.revenue.coverage.total}) · contract value{' '}
                  {tier.contractValue.amounts.length === 0 ? 'not recorded' : tier.contractValue.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' and ')} (
                  {tier.contractValue.coverage.recorded} of {tier.contractValue.coverage.total})
                </p>
              </li>
            ))}
          </ul>
          <p className="text-[9px] font-body text-white/25 mt-3">
            Sponsors have no status, so the Past / Live / Future view does not filter their amounts; &ldquo;Events with sponsors&rdquo; follows the view. Sponsor amounts are in AUD.
          </p>
        </>
      )}
    </Panel>
  );
}
