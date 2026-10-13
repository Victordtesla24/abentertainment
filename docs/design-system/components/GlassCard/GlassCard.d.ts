import * as React from 'react';

export interface GlassCardProps {
  children?: React.ReactNode;
  /** Inner padding in px. */
  padding?: number;
  /** Corner radius in px — 0 keeps the sharp-edge brand identity. */
  radius?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/** Glass-morphism surface with the brand's gold hairline border and hover lift. */
export declare function GlassCard(props: GlassCardProps): JSX.Element;
