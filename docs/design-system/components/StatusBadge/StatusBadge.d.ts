import * as React from 'react';

export interface StatusBadgeProps {
  /** Ticket state. `category` renders a gold badge with a custom `label`. */
  status?: 'available' | 'selling_fast' | 'sold_out' | 'new_date' | 'category';
  /** Overrides the status's default text. Required for `category`. */
  label?: string;
  style?: React.CSSProperties;
}

/** Sharp-edged ticket-status / category badge used on event cards. */
export declare function StatusBadge(props: StatusBadgeProps): JSX.Element | null;
