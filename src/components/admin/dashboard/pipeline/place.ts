/**
 * Where the floating panel of an event goes: next to its marker and never on it, kept inside the screen. Pure geometry in the pixels of the
 * screen (what getBoundingClientRect gives), so the rules are tested on their own.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Placement {
  left: number;
  top: number;
  /** Set when the panel is taller than the room it has: it is held to this height and scrolls inside it. */
  maxHeight: number | null;
  side: 'above' | 'below' | 'right' | 'left';
  /** Where the marker's middle is along the panel's width, so a pointer can be drawn at it. */
  pointerX: number;
}

/** The room kept clear at every edge of the screen, and the gap between the marker and the panel. */
export const EDGE = 8;
export const GAP = 14;
/** The least height a panel that has to scroll is given. */
const LEAST = 120;

const hold = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

/**
 * Above the marker when the whole panel fits there, otherwise below it, otherwise beside it, and on a screen too small for any of those on
 * the larger of the spaces above and below, held to that height. Across, it is centred on the marker and held inside the screen.
 */
export function placePanel(anchor: Box, panel: { width: number; height: number }, screen: { width: number; height: number }): Placement {
  const middle = (anchor.left + anchor.right) / 2;
  const across = hold(middle - panel.width / 2, EDGE, Math.max(EDGE, screen.width - panel.width - EDGE));
  const pointerX = hold(middle - across, 14, Math.max(14, panel.width - 14));
  const height = Math.min(panel.height, screen.height - 2 * EDGE);
  const above = anchor.top - GAP - EDGE;
  const below = screen.height - (anchor.bottom + GAP) - EDGE;
  if (height <= above) return { left: across, top: anchor.top - GAP - height, maxHeight: null, side: 'above', pointerX };
  if (height <= below) return { left: across, top: anchor.bottom + GAP, maxHeight: null, side: 'below', pointerX };
  const keep = (top: number) => hold(top, EDGE, screen.height - height - EDGE);
  const centred = keep((anchor.top + anchor.bottom) / 2 - height / 2);
  if (screen.width - EDGE - (anchor.right + GAP) >= panel.width) return { left: anchor.right + GAP, top: centred, maxHeight: null, side: 'right', pointerX: 14 };
  if (anchor.left - GAP - EDGE >= panel.width) return { left: anchor.left - GAP - panel.width, top: centred, maxHeight: null, side: 'left', pointerX: panel.width - 14 };
  if (below >= above) return { left: across, top: anchor.bottom + GAP, maxHeight: Math.max(below, LEAST), side: 'below', pointerX };
  const room = Math.max(above, LEAST);
  return { left: across, top: Math.max(EDGE, anchor.top - GAP - room), maxHeight: room, side: 'above', pointerX };
}
