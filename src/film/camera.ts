/**
 * Camera + layout zones.
 *
 * The film ALWAYS fills the screen (object-fit: cover). The camera only pans
 * inside whatever overflow the viewport's aspect ratio leaves, pushing the
 * subject away from the side a chapter's UI lives on.
 *
 * Zones are the clear screen space around the subject for a chapter's frames:
 *   - "band":   the full-width strip under the chin (the hero composition)
 *   - "column": the tall space beside the head, when it's wide enough
 */
import { CHAPTERS, Chapter, ChapterId, VIDEO, clamp, faceCenterAt, lerp } from "./timeline";

export type Rect = { x: number; y: number; w: number; h: number };
export type CamRect = { dw: number; dh: number; ox: number; oy: number };
export type Mode = "wide" | "stack";
export type Viewport = { w: number; h: number; mode: Mode };
export type Shape = "band" | "column";

export const TOP_SAFE = 104; // nav
export const EDGE = (vp: Viewport) => clamp(vp.w * 0.06, 20, 110);

export function modeFor(w: number, h: number): Mode {
  return w < 820 || w / h < 1.05 ? "stack" : "wide";
}

const cover = (vp: Viewport) => Math.max(vp.w / VIDEO.width, vp.h / VIDEO.height);

/** Full-bleed framing. ax: -1 push subject left, 0 centre, 1 push right (only matters when the frame overflows). */
export function camRect(vp: Viewport, ax: number, fy = 0.4): CamRect {
  const k = cover(vp);
  const dw = VIDEO.width * k;
  const dh = VIDEO.height * k;
  const ox = lerp(vp.w - dw, 0, (ax + 1) / 2);
  const oy = dh > vp.h ? clamp(vp.h * 0.42 - fy * dh, vp.h - dh, 0) : 0;
  return { dw, dh, ox, oy };
}

/**
 * Portrait frames ("pt" set) are native-resolution crops of the 1080p source
 * covering x ∈ [PT_X0, PT_X0 + PT_W] — every position the face-tracking camera
 * can reach on a portrait screen — so phones draw real pixels instead of an
 * upscaled slice of a downsized frame.
 */
export const PT_X0 = 288 / 1920;
export const PT_W = 1094 / 1920;
export const portraitCropFits = (vp: Viewport) => vp.w <= PT_W * VIDEO.width * cover(vp);

/** Portrait: still full-bleed, panned so the face stays centred as he moves. */
export function faceCam(vp: Viewport, frame: number): CamRect {
  const k = cover(vp);
  const dw = VIDEO.width * k;
  const dh = VIDEO.height * k;
  const [fcx] = faceCenterAt(frame);
  // stay inside the portrait crop when it covers the screen, else inside the full frame
  const [lo, hi] = portraitCropFits(vp) ? [vp.w - (PT_X0 + PT_W) * dw, -PT_X0 * dw] : [vp.w - dw, 0];
  const ox = clamp(vp.w * 0.5 - fcx * dw, lo, hi);
  return { dw, dh, ox, oy: 0 };
}

export function blendCam(a: CamRect, b: CamRect, t: number): CamRect {
  return { dw: lerp(a.dw, b.dw, t), dh: lerp(a.dh, b.dh, t), ox: lerp(a.ox, b.ox, t), oy: lerp(a.oy, b.oy, t) };
}

export function toScreen(c: CamRect, box: [number, number, number, number], pad = 0): Rect {
  const [x0, y0, x1, y1] = box;
  return { x: c.ox + x0 * c.dw - pad, y: c.oy + y0 * c.dh - pad, w: (x1 - x0) * c.dw + pad * 2, h: (y1 - y0) * c.dh + pad * 2 };
}

/** Lowest point of the protected head (chin) across a frame range, in screen px. */
function chinLine(frames: [number, number], camAt: (f: number) => CamRect) {
  let y = 0;
  for (let f = Math.max(0, frames[0] - 3); f <= Math.min(VIDEO.count - 1, frames[1] + 3); f++) {
    const c = camAt(f);
    y = Math.max(y, c.oy + VIDEO.frames[f].h[3] * c.dh);
  }
  return y;
}

/**
 * Tall clear column beside the head. Only the protected head (hair, face, nose)
 * bounds it — text may sit over the jacket at the side, never over the head.
 */
function columnZone(vp: Viewport, cam: CamRect, frames: [number, number], side: "left" | "right", bottom: number): Rect {
  const edge = EDGE(vp);
  const gap = clamp(vp.w * 0.03, 28, 64);
  let bound = side === "right" ? edge : vp.w - edge;
  for (let f = Math.max(0, frames[0] - 4); f <= Math.min(VIDEO.count - 1, frames[1] + 4); f++) {
    const [x0, , x1] = VIDEO.frames[f].h;
    if (side === "right") bound = Math.max(bound, cam.ox + (x1 + 0.015) * cam.dw + gap);
    else bound = Math.min(bound, cam.ox + (x0 - 0.02) * cam.dw - gap);
  }
  return side === "right"
    ? { x: bound, y: TOP_SAFE, w: vp.w - edge - bound, h: bottom - TOP_SAFE }
    : { x: edge, y: TOP_SAFE, w: bound - edge, h: bottom - TOP_SAFE };
}

export type Zone = Rect & { shape: Shape };
export type Layout = {
  vp: Viewport;
  cams: Record<ChapterId, CamRect>;
  zones: Record<ChapterId, Zone>;
};

function zoneFor(vp: Viewport, ch: Chapter, cam: CamRect, camAt: (f: number) => CamRect): Zone {
  const edge = EDGE(vp);
  const stack = vp.mode === "stack";
  const bottomPad = stack ? 20 : clamp(vp.h * 0.035, 24, 44);
  const chin = chinLine(ch.frames, camAt);
  // clear of the padded head box the face guard uses (18px wide, 10px stacked) plus a little air
  const bandTop = Math.min(chin + (stack ? 14 : 26), vp.h - 180);
  const band: Zone = { shape: "band", x: edge, y: bandTop, w: vp.w - edge * 2, h: vp.h - bottomPad - bandTop };
  if (stack || ch.side === "band") return band;
  const col = columnZone(vp, cam, ch.frames, ch.side, vp.h - bottomPad);
  // a column is only used when it's comfortably readable; otherwise the chapter sits under the chin like the hero
  if (col.w >= ch.target) return { ...col, shape: "column" };
  return band;
}

export function computeLayout(vp: Viewport): Layout {
  const cams = {} as Layout["cams"];
  const zones = {} as Layout["zones"];
  for (const ch of CHAPTERS) {
    const ax = ch.ax ?? (ch.side === "right" ? -1 : ch.side === "left" ? 1 : 0);
    const cam = vp.mode === "stack" ? faceCam(vp, ch.frames[0]) : camRect(vp, ax);
    const camAt = (f: number) => (vp.mode === "stack" ? faceCam(vp, f) : cam);
    cams[ch.id] = cam;
    zones[ch.id] = zoneFor(vp, ch, cam, camAt);
  }
  return { vp, cams, zones };
}
