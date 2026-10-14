'use client';

import type { ActionItem, AdminTab } from '@/lib/admin-bi';
import { buttonClasses } from '../newsletter/shared';
import { CARD, Chip, EmptyNote, Panel } from './biParts';

const TAB_NAME: Record<AdminTab, string> = { events: 'Events', sponsors: 'Sponsors' };

/** "3 high, 5 medium and 2 low" for the line under the title. */
function summaryOf(items: readonly ActionItem[]): string {
  const parts = (['high', 'medium', 'low'] as const).flatMap((severity) => {
    const count = items.filter((item) => item.severity === severity).length;
    return count > 0 ? [`${count} ${severity}`] : [];
  });
  return `${items.length} ${items.length === 1 ? 'action' : 'actions'}: ${parts.join(', ')}`;
}

/**
 * What an admin should do next, most urgent first: each action says what is missing or wrong, which events or sponsors it
 * affects, and opens the tab where it is fixed.
 */
export function BiActionItems({ items, onNavigate }: { items: readonly ActionItem[]; onNavigate?: (tab: AdminTab) => void }) {
  const open = (tab: AdminTab) => {
    onNavigate?.(tab);
    window.scrollTo({ top: 0 });
  };

  return (
    <Panel title="Action items" testId="bi-actions">
      {items.length === 0 ? (
        <EmptyNote>Nothing to do: everything this view checks is recorded.</EmptyNote>
      ) : (
        <>
          <p data-testid="bi-actions-summary" className="text-[11px] font-body text-white/50 mb-3">
            {summaryOf(items)}
          </p>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} data-testid={`bi-action-${item.id}`} data-severity={item.severity} className="border border-white/5 p-3" style={{ backgroundColor: CARD }}>
                <div className="flex items-start gap-2">
                  <Chip tone={item.severity}>{item.severity}</Chip>
                  <p className="min-w-0 flex-1 text-xs font-body text-white [overflow-wrap:anywhere]">{item.title}</p>
                </div>
                <p className="text-[11px] font-body text-white/50 mt-1.5">{item.instruction}</p>
                <p className="text-[10px] font-body text-white/40 mt-1.5 [overflow-wrap:anywhere]">
                  Affects {item.count} {item.target === 'sponsors' ? (item.count === 1 ? 'sponsor' : 'sponsors') : item.count === 1 ? 'event' : 'events'}: {item.names.join(', ')}
                  {item.moreCount > 0 ? ` and ${item.moreCount} more` : ''}
                </p>
                {item.notes.map((note) => (
                  <p key={note} className="text-[10px] font-body text-white/35 mt-1 [overflow-wrap:anywhere]">
                    {note}
                  </p>
                ))}
                {onNavigate ? (
                  <button type="button" onClick={() => open(item.target)} data-testid={`bi-action-${item.id}-open`} className={`${buttonClasses} mt-3`}>
                    Open {TAB_NAME[item.target]}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
