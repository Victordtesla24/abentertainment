/**
 * The picture in the Export PDF is drawn by html2canvas, a library that draws a page the way a browser does but not in every detail.
 * Three differences show on the Dashboard, and each is put right here, for the picture only (what is on the screen is never touched):
 *
 *  - It finds where the baseline of a font is with a 1 px image next to a line of sample text. This site's base styles make every image
 *    a block, which puts that image on a line of its own, so every line of text in the picture sits several pixels low and the foot of
 *    its letters is cut by the box that clips a title. `withBaselineFix` has that image drawn inline while the picture is taken.
 *  - It draws no "...", it cuts a title that its box clips where the box ends. `fitTitles` shortens such a title, in the copy that is
 *    drawn, to what fits and ends it with the same mark the screen shows.
 *  - It does not draw a repeating gradient, which is how an estimate is hatched on a marker, a swatch or a chip. `hatchAsPicture` draws
 *    the same lines (the same angle, width and gap, in the same colours) as a small picture instead, so an estimate is hatched in the
 *    report too.
 */

/** The 1 px image html2canvas measures fonts with (its address starts like this). */
const BASELINE_PROBE = 'img[src^="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP"] { display: inline !important; vertical-align: baseline !important; }';

/** Runs `capture` while the measuring image of html2canvas is drawn inline, so each line of text is drawn on its own baseline. */
export async function withBaselineFix<T>(capture: () => Promise<T>): Promise<T> {
  const style = document.createElement('style');
  style.textContent = BASELINE_PROBE;
  document.head.appendChild(style);
  try {
    return await capture();
  } finally {
    style.remove();
  }
}

const REPEATING_GRADIENT = /^repeating-linear-gradient\(\s*(-?[\d.]+)deg\s*,(.*)\)$/;
const COLOR_STOP = /(rgba?\([^)]*\))\s+(-?[\d.]+)px/g;
const TEXT_NODE = 3;

/** An svg paint for a computed colour, "rgb(201, 168, 76)" or "rgba(201, 168, 76, 0.1)". */
function paintOf(color: string): string {
  const [red = 0, green = 0, blue = 0, alpha = 1] = (color.match(/[\d.]+/g) ?? []).map(Number);
  return `fill="rgb(${red},${green},${blue})" fill-opacity="${alpha}"`;
}

/** The hatch on `node`, a repeating gradient, as the same lines in an svg picture of the size of the node. */
function hatchAsPicture(node: HTMLElement, gradient: string): void {
  const parsed = REPEATING_GRADIENT.exec(gradient.trim());
  if (!parsed) return;
  const angle = Number(parsed[1]);
  const stops = Array.from(parsed[2].matchAll(COLOR_STOP), (stop) => ({ color: stop[1], at: Number(stop[2]) }));
  const period = stops.length > 0 ? stops[stops.length - 1].at : 0;
  const box = node.getBoundingClientRect();
  const width = Math.round(box.width);
  const height = Math.round(box.height);
  if (period <= 0 || width < 1 || height < 1) return;
  let bands = '';
  for (let index = 1; index < stops.length; index += 1) {
    const from = stops[index - 1];
    const to = stops[index];
    if (from.color === to.color && to.at > from.at) bands += `<rect x="${from.at}" width="${to.at - from.at}" height="${period}" ${paintOf(to.color)}/>`;
  }
  if (bands === '') return;
  // the same rotation the dials' own hatch (an svg pattern) uses: the colours change along the gradient's direction, which is `angle` clockwise from up
  const picture =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><pattern id="hatch" width="${period}" height="${period}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle - 90})">${bands}</pattern></defs>` +
    `<rect width="${width}" height="${height}" fill="url(#hatch)"/></svg>`;
  node.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(picture)}")`;
  node.style.backgroundSize = '100% 100%';
  node.style.backgroundRepeat = 'no-repeat';
}

/** A title that its box clips with an ellipsis, shortened to what fits and ended with "…", and its box no longer clips (so no letter loses its foot). */
function fitTitle(node: HTMLElement): void {
  const only = node.childNodes.length === 1 ? node.firstChild : null;
  if (!only || only.nodeType !== TEXT_NODE || node.scrollWidth <= node.clientWidth + 1) return;
  const text = only.textContent ?? '';
  let fits = 0;
  let over = text.length;
  while (fits < over) {
    const middle = Math.ceil((fits + over) / 2);
    only.textContent = `${text.slice(0, middle).trimEnd()}…`;
    if (node.scrollWidth <= node.clientWidth + 1) fits = middle;
    else over = middle - 1;
  }
  only.textContent = `${text.slice(0, fits).trimEnd()}…`;
  node.style.overflow = 'visible';
  node.style.textOverflow = 'clip';
}

/** html2canvas's `onclone`: puts right, in the copy of the page that is drawn, what the library would otherwise draw differently from the screen. */
export function prepareCapture(copy: Document): void {
  const view = copy.defaultView;
  const root = copy.getElementById('health-dashboard-content');
  if (!view || !root) return;
  for (const node of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    const style = view.getComputedStyle(node);
    if (style.backgroundImage.startsWith('repeating-linear-gradient(')) hatchAsPicture(node, style.backgroundImage);
    if (style.textOverflow === 'ellipsis' && style.overflowX !== 'visible') fitTitle(node);
  }
}
