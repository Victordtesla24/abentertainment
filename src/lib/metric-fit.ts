import type { CSSProperties } from 'react';

/**
 * Fitting a metric figure ("25,000+") into its tile.
 *
 * The figures are set in the display font at a size chosen per breakpoint, which is right while the widest
 * figure is narrower than a tile. Below that (a phone, a tablet in portrait) or for a larger value an admin
 * enters, the figure ran out of its tile and, being painted with a text-clipped gradient, was cut off.
 *
 * Each tile is a size container and its figure takes `min(<size for the breakpoint>, <size that fits>)`.
 * "Fits" needs the width of the text in em, which CSS cannot measure, so it is computed here from the
 * advance widths of the characters a formatted figure can hold (digits are proportional in Playfair
 * Display, so a plain character count would be wrong by 20 %). One number per grid, the widest figure's,
 * goes to every tile, so all tiles of a grid get the same size.
 */

export type FigureWeight = 'bold' | 'black';

/**
 * Advance widths in em of Playfair Display at weight 700 (`bold`) and 900 (`black`), the two weights the
 * metric figures use, for every character `formatMetricValue` can produce (digits, the thousands comma, a
 * decimal point and the suffixes "+", "K", "M", "%"). Measured with canvas `measureText` on the loaded font;
 * a whole figure measures the same as the sum of its characters, so no kerning is lost.
 */
const ADVANCE_EM: Readonly<Record<FigureWeight, Readonly<Record<string, number>>>> = {
  bold: {
    '0': 0.645, '1': 0.383, '2': 0.523, '3': 0.488, '4': 0.528, '5': 0.459, '6': 0.561, '7': 0.455, '8': 0.561, '9': 0.553,
    ',': 0.271, '.': 0.27, '+': 0.574, K: 0.714, M: 0.927, '%': 0.728,
  },
  black: {
    '0': 0.675, '1': 0.392, '2': 0.553, '3': 0.512, '4': 0.55, '5': 0.489, '6': 0.591, '7': 0.488, '8': 0.588, '9': 0.582,
    ',': 0.278, '.': 0.282, '+': 0.565, K: 0.754, M: 0.965, '%': 0.719,
  },
};

/** A character outside the table is assumed to be as wide as the widest one ("M"). */
const WIDEST_EM: Readonly<Record<FigureWeight, number>> = { bold: 0.927, black: 0.965 };

/** Allowance for rounding and hinting, so a figure that fits on paper never touches the tile's edge. */
const ALLOWANCE = 1.01;

/** Width of `figure` in em. */
export function figureWidthEm(figure: string, weight: FigureWeight): number {
  const table = ADVANCE_EM[weight];
  let width = 0;
  for (const character of figure) width += table[character] ?? WIDEST_EM[weight];
  return width;
}

/** Width in em of the widest of `figures`, with the allowance; the one number every tile of a grid shares. */
export function widestFigureEm(figures: readonly string[], weight: FigureWeight): number {
  const widest = figures.reduce((max, figure) => Math.max(max, figureWidthEm(figure, weight)), 0);
  return Math.round(widest * ALLOWANCE * 1000) / 1000;
}

/** Style for the grid element: the shared width. */
export function figureGridStyle(widestEm: number): CSSProperties {
  return { '--figure-em': String(widestEm) } as CSSProperties;
}

/**
 * Style for a figure: the smaller of the breakpoint's size (`--figure-size`, set by classes next to the
 * figure) and the size at which the widest figure fills the tile, `100cqi` being the tile's width.
 * Without a width (a grid that did not set one) the fit assumes a figure 8 em wide.
 */
export const FIGURE_FIT_STYLE: CSSProperties = {
  fontSize: 'min(var(--figure-size), calc(100cqi / var(--figure-em, 8)))',
};

/** Makes a grid item the size container its figure measures itself against. */
export const FIGURE_TILE_CLASS = '[container-type:inline-size]';
