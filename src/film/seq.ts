/**
 * The frame sets, shared by the renderer, the page's <link rel=preload>s and the cache.
 *
 *   lg  1920×1080 WebP   desktop
 *   pt  1094×1080 WebP   phones (portrait crop, native pixels), scrubbed while the finger moves
 *   pt2 1.5× AVIF        phones, the sharp frame swapped in when the film rests
 *   sm  960×540 WebP     slow connections (Save-Data, 2G/3G)
 *
 * SEQ_VERSION is part of every frame URL. It makes the frames immutable for the browser's
 * HTTP cache and for the on-device Cache API store — bump it whenever the frames in
 * public/seq are regenerated, and every visitor fetches the new ones exactly once.
 */
import { VIDEO } from "./timeline";

export type SetName = "lg" | "pt" | "pt2" | "sm";

export const SEQ_VERSION = 3;

/* The reel: 191 real frames plus an optical-flow in-between after each (381 total) for the
   full-quality sets — a real picture every ~22–48 px of scroll. The slow-connection set keeps
   the 191 originals. Positions everywhere else stay in real-frame units (the face analysis). */
export const SUB: Record<SetName, number> = { lg: 2, pt: 2, pt2: 2, sm: 1 };
/** pixel width of a frame in each set (what one drawn frame covers on screen: see FilmCanvas) */
export const FRAME_W: Record<SetName, number> = { lg: 1920, pt: 1094, pt2: 1641, sm: 960 };

export const countOf = (set: SetName | "") => (set ? (VIDEO.count - 1) * SUB[set] + 1 : VIDEO.count);

export const frameUrl = (set: SetName, i: number) =>
  `/seq/${set}/${String(i + 1).padStart(3, "0")}.${set === "pt2" ? "avif" : "webp"}?v=${SEQ_VERSION}`;

/** Fetch order for a whole set: coarse coverage first (every 32nd frame), then finer. */
export function coverageOrder(n: number) {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const step of [32, 16, 8, 4, 2, 1])
    for (let i = 0; i < n; i += step)
      if (!seen.has(i)) {
        seen.add(i);
        out.push(i);
      }
  if (!seen.has(n - 1)) out.push(n - 1);
  return out;
}
