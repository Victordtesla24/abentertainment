import * as React from 'react';

export interface OrnamentDividerProps {
  /** Length of each hairline arm in px. */
  width?: number;
  style?: React.CSSProperties;
}

/** Line–diamond–line ornament that sits under section headings. */
export declare function OrnamentDivider(props: OrnamentDividerProps): JSX.Element;
