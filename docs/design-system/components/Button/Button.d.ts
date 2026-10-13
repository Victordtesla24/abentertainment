import * as React from 'react';

export interface ButtonProps {
  /** Visual treatment. `primary` is the gold gradient CTA. */
  variant?: 'primary' | 'outline' | 'ghost';
  /** Padding scale. */
  size?: 'sm' | 'md' | 'lg';
  /** Button label. */
  children?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/** AB Entertainment call-to-action button — sharp edges, uppercase, gold gradient. */
export declare function Button(props: ButtonProps): JSX.Element;
