/**
 * Fixed full-viewport backdrop behind every public page.
 *
 * This component used to boot a three.js engine (bloom + bokeh + film-grain post-processing
 * at up to 2x device pixel ratio, a pointer/scroll camera rig and a watchdog) on every page.
 * Its scene held lights but no geometry, so every frame it produced was a flat rgb(1,1,1)
 * field: the film grain multiplies a base of about 0.003 linear light and never leaves 8-bit
 * value 1. It cost a WebGL context, a render loop and ~300 KB of script for a solid colour.
 *
 * The layers below paint the same colour with CSS only: no JavaScript beyond hydration, no
 * GPU context, no animation loop. Visitors who prefer reduced motion keep the navy gradient
 * the old reduced-motion fallback always gave them. The file keeps its name so the shared
 * ClientProviders import does not change.
 */
export default function ThreeCanvas() {
  return (
    <>
      <div
        className="fixed inset-0 -z-10 pointer-events-none bg-[#010101] motion-reduce:hidden"
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 -z-10 pointer-events-none hidden motion-reduce:block bg-[radial-gradient(ellipse_at_50%_20%,#1a1a2e_0%,#0a0a0c_60%,#000000_100%)]"
        aria-hidden="true"
      />
    </>
  );
}
