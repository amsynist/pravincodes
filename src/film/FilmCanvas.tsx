"use client";

import { useEffect, useRef } from "react";
import { useLayoutState, useTick } from "./react";
import { getEngine } from "./engine";
import { clamp } from "./timeline";
import { PT_W, PT_X0, portraitCropFits, type CamRect } from "./camera";
import { FRAME_W, SUB, type SetName, countOf, coverageOrder, frameUrl } from "./seq";
import { drawScrims, drawTracers, scrimKey, scrimsAt, streakEnergy } from "./paint";

/* =====================================================================
   Frame store
   - All frames are fetched once as compressed blobs (desktop: 1080p WebP, ~44 MB;
     phones: the 1094×1080 portrait crop as WebP, ~31 MB — fast to decode).
   - The fetch order follows the visitor: whatever is nearest the playhead (in the
     direction of travel) is fetched first, then the reel fills in coarse-to-fine.
     Scrolling ahead of the download used to show the nearest fetched frame — up to
     32 frames off; now the frames under the playhead jump the queue.
   - Frames are stored on the device (Cache API) the first time they arrive, so a
     return visit reads them from disk instead of the network — with no service
     worker to go stale: the frame URL carries a version, and the store is one
     versioned cache that is replaced when the frames are regenerated.
   - Two tiers on phones, the way scroll-scrubbed product pages do it: while the
     finger is moving the light WebP frames scrub; the moment scrolling rests, the
     sharp 1.5× AVIF of that one frame is fetched/decoded and swapped in. Motion hides
     the difference, and the heavy AVIF decode never sits on the scrubbing path.
   - Only a sliding window around the playhead is decoded, into ImageBitmaps,
     with createImageBitmap (decodes OFF the main thread). drawImage on an
     ImageBitmap never triggers a synchronous decode, which was the main
     cause of scroll jank.
   ===================================================================== */

type Store = {
  set: "" | SetName;
  blobs: (Blob | null)[];
  bitmaps: Map<number, ImageBitmap>;
  pending: Set<number>;
  fetching: Set<number>;
  fetched: number;
  limit: number;
  /** playhead in this set's frame units + direction, for fetch/decode priority */
  center: number;
  dir: number;
  listeners: Set<(n: number) => void>;
};
const store: Store = {
  set: "",
  blobs: [],
  bitmaps: new Map(),
  pending: new Set(),
  fetching: new Set(),
  fetched: 0,
  limit: 40,
  center: 0,
  dir: 1,
  listeners: new Set(),
};

/* ---------------- on-device frame cache (Cache API, versioned by the URL) ---------------- */

const CACHE = "film-seq";
let cacheP: Promise<Cache | null> | null = null;
function frameCache() {
  cacheP ??= (async () => {
    try {
      if (typeof caches === "undefined") return null;
      return await caches.open(CACHE);
    } catch {
      return null; // private mode / storage blocked: plain network + HTTP cache
    }
  })();
  return cacheP;
}
/** cached blob, else network (and stored for next time). null on failure. */
async function fetchFrame(u: string): Promise<Blob | null> {
  const c = await frameCache();
  if (c) {
    try {
      const hit = await c.match(u);
      if (hit) return await hit.blob();
    } catch {}
  }
  try {
    const r = await fetch(u);
    if (!r.ok) return null;
    if (c) {
      const copy = r.clone();
      c.put(u, copy).catch(() => {}); // storage full / evicted: still fine, we have the bytes
    }
    return await r.blob();
  } catch {
    return null;
  }
}
/** frames from a previous version of the reel are dropped once (only their URL differs) */
async function pruneOldFrames() {
  const c = await frameCache();
  if (!c) return;
  try {
    const keys = await c.keys();
    const cur = frameUrl("lg", 0).split("?")[1];
    for (const k of keys) if (k.url.includes("/seq/") && !k.url.endsWith(`?${cur}`)) c.delete(k).catch(() => {});
  } catch {}
}

/* phones: sharp frames, fetched + decoded on demand for the frame the film rests on */
const hq = { set: "" as "" | "pt2", bitmaps: new Map<number, ImageBitmap>(), pending: new Set<number>(), failed: new Set<number>(), order: [] as number[] };
function wantHq(i: number) {
  if (!hq.set || hq.bitmaps.has(i) || hq.pending.has(i) || hq.failed.has(i)) return;
  const set = hq.set;
  hq.pending.add(i);
  fetchFrame(frameUrl(set, i))
    .then((b) => (b ? createImageBitmap(b) : null))
    .then((bm) => {
      hq.pending.delete(i);
      if (!bm) return void hq.failed.add(i); // missing / undecodable: the WebP frame stays, no retry storm
      if (hq.set !== set) return bm.close();
      hq.bitmaps.set(i, bm);
      hq.order.push(i);
      while (hq.order.length > 4) {
        const k = hq.order.shift()!;
        hq.bitmaps.get(k)?.close();
        hq.bitmaps.delete(k);
      }
      getEngine().poke();
    })
    .catch(() => hq.pending.delete(i));
}
function resetHq(set: "" | "pt2") {
  if (hq.set === set) return;
  hq.bitmaps.forEach((b) => b.close());
  hq.bitmaps.clear();
  hq.pending.clear();
  hq.failed.clear();
  hq.order = [];
  hq.set = set;
}

export function onLoadProgress(cb: (ratio: number) => void) {
  store.listeners.add(cb);
  cb(store.set ? store.fetched / countOf(store.set) : 0);
  return () => {
    store.listeners.delete(cb);
  };
}

/* Phones: "pt2" = the portrait crop upscaled 1.5× (Lanczos + light sharpen) as AVIF, so a
   3× retina screen isn't magnifying a 1080-px frame ~2×. Falls back to the WebP crop ("pt")
   where AVIF can't be decoded. */
const AVIF_1PX =
  "AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAJAAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAgAAAAIAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAALG1kYXQSAAoIGAA2iAhoNCAyFhlHh4Yhh5555oAAAJBAyRxhQmK+L0A=";
let avifOk: Promise<boolean> | null = null;
function canAvif() {
  avifOk ??= (async () => {
    try {
      const bytes = Uint8Array.from(atob(AVIF_1PX), (c) => c.charCodeAt(0));
      const bm = await createImageBitmap(new Blob([bytes], { type: "image/avif" }));
      bm.close();
      return true;
    } catch {
      return false;
    }
  })();
  return avifOk;
}

/* ---------------- fetching: the playhead first, then the rest of the reel ---------------- */

const PARALLEL = 8; // HTTP/2 multiplexes; the frames are ~100 KB each
const NEAR = 48; // how far around the playhead "urgent" reaches (in this set's frames)
let queue: number[] = [];
let active = 0;
const tries = new Map<number, number>();

/** next frame to fetch: nearest un-fetched frame around the playhead (ahead first), else the coverage order */
function pickNext(): number {
  const N = countOf(store.set);
  const c = Math.round(store.center);
  const ahead = store.dir >= 0 ? 1 : -1;
  const free = (i: number) => i >= 0 && i < N && !store.blobs[i] && !store.fetching.has(i) && (tries.get(i) ?? 0) < 3;
  if (free(c)) return c;
  for (let d = 1; d <= NEAR; d++) {
    if (free(c + ahead * d)) return c + ahead * d;
    if (d <= 12 && free(c - ahead * d)) return c - ahead * d;
  }
  while (queue.length) {
    const i = queue.shift()!;
    if (free(i)) return i;
  }
  return -1;
}

function pump() {
  const set = store.set;
  if (!set) return;
  while (active < PARALLEL) {
    const i = pickNext();
    if (i < 0) return;
    active++;
    store.fetching.add(i);
    fetchFrame(frameUrl(set, i)).then((blob) => {
      active--;
      if (store.set !== set) return pump(); // the set changed under us: hand the slot to the new one
      store.fetching.delete(i);
      if (!blob) {
        // try again after the rest of the reel — three times, then that frame is left to its neighbours
        const n = (tries.get(i) ?? 0) + 1;
        tries.set(i, n);
        if (n < 3) queue.push(i);
        else store.blobs[i] = null;
      } else {
        store.blobs[i] = blob;
        store.fetched++;
        store.listeners.forEach((l) => l(store.fetched / countOf(set)));
        // make sure the frame we're sitting on gets decoded as soon as its bytes arrive
        getEngine().poke();
      }
      pump();
    });
  }
}

function load(set: SetName, limit: number) {
  store.limit = limit;
  if (store.set === set) return;
  store.bitmaps.forEach((b) => b.close());
  store.bitmaps.clear();
  store.pending.clear();
  store.fetching.clear();
  store.set = set;
  const N = countOf(set);
  store.blobs = new Array(N).fill(null);
  store.fetched = 0;
  store.center = clamp(store.center, 0, N - 1);
  queue = coverageOrder(N);
  tries.clear();
  pump(); // fetches of a previous set still in flight release their slots as they finish
  pruneOldFrames();
}

/** decodes in flight at once: createImageBitmap runs off the main thread, so a few more only help catch-up */
const DECODES = 6;
function decode(i: number) {
  if (i < 0 || i >= countOf(store.set)) return;
  if (store.bitmaps.has(i) || store.pending.has(i) || store.pending.size >= DECODES) return;
  const blob = store.blobs[i];
  if (!blob) return;
  const set = store.set;
  store.pending.add(i);
  createImageBitmap(blob)
    .then((bm) => {
      store.pending.delete(i);
      if (store.set !== set) return bm.close();
      store.bitmaps.set(i, bm);
      getEngine().poke();
    })
    .catch(() => store.pending.delete(i));
}

function prefetch(center: number, dir: number) {
  store.center = center;
  store.dir = dir;
  decode(center);
  const ahead = dir >= 0 ? 1 : -1;
  const reach = Math.min(20, store.limit - 5); // never prefetch more than the budget can keep
  for (let d = 1; d <= reach && store.pending.size < DECODES; d++) {
    decode(center + ahead * d);
    if (d <= 4) decode(center - ahead * d);
  }
  // evict the farthest frames beyond the memory budget
  if (store.bitmaps.size > store.limit) {
    const far = [...store.bitmaps.keys()].sort((a, b) => Math.abs(b - center) - Math.abs(a - center));
    for (const k of far.slice(0, store.bitmaps.size - store.limit)) {
      store.bitmaps.get(k)?.close();
      store.bitmaps.delete(k);
    }
  }
}

/**
 * Closest decoded frame, preferring frames BEHIND the direction of travel (the ones just
 * passed are already decoded). Never steps backwards past the frame already on screen —
 * alternating between i-1 and i+1 while decoding catches up read as shaking.
 */
function nearest(i: number, dir: number, shown: number): [ImageBitmap | null, number] {
  const exact = store.bitmaps.get(i);
  if (exact) return [exact, i];
  const back = dir >= 0 ? -1 : 1;
  for (let d = 1; d < 24; d++) {
    for (const j of [i + back * d, i - back * d]) {
      const b = store.bitmaps.get(j);
      if (!b) continue;
      const regress = shown >= 0 && (dir > 0 ? j < shown && shown <= i : dir < 0 ? j > shown && shown >= i : false);
      if (regress && store.bitmaps.has(shown)) return [store.bitmaps.get(shown)!, shown];
      return [b, j];
    }
  }
  return [null, -1];
}

/* =====================================================================
   Renderer — two canvases, one picture.

   The frames are 1080p. A 4K monitor (or a 3× phone) shows them enlarged, and the old
   renderer enlarged them by drawing into a canvas the size of the whole screen in
   device pixels: 8.3 million pixels written twice (two blended frames) on every one of
   the ~60 redraws a second while scrolling. On a Mac at 2× that was ~5 MP and fine; on
   a 4K display it was the stutter.

   Now, like Apple's scroll-driven product pages:
     · while the film MOVES it is drawn into a canvas at the frames' own resolution
       (1920×1080 for the desktop set) and the GPU compositor stretches it to the
       screen — a bilinear stretch, the same filter the canvas used while scrubbing
       before, so the picture in motion is identical and costs 4× less on 4K;
     · the moment it RESTS, the same frame is drawn once more into a canvas at full
       device resolution with the high-quality resampler and shown instead. That is
       exactly the at-rest picture the site had before — nothing is downscaled, ever.
   On screens where the two sizes coincide (a 1080p laptop) only one canvas is used.
   ===================================================================== */

const BG = "#04050c";

export default function FilmCanvas() {
  const hiRef = useRef<HTMLCanvasElement>(null);
  const loRef = useRef<HTMLCanvasElement>(null);
  const layout = useLayoutState();
  const last = useRef({ key: "", frame: 0, pos: -1, changedAt: 0, dir: 1, shown: -1, lastT: 0, ema: 16.7, noBlend: false, tier: "" as "" | "hi" | "lo" });
  const scales = useRef({ hi: 1, lo: 1, dual: false, set: "" as "" | SetName });

  useEffect(() => {
    if (!layout) return;
    const hi = hiRef.current!;
    const lo = loRef.current!;
    const { w, h } = layout.vp;
    // Rest canvas at the screen's real pixel density (phones up to 3×), so the frame is
    // resampled ONCE by the canvas' high-quality filter instead of a second bilinear stretch
    // by the compositor — that second stretch is what made the film look softer than the mp4.
    const maxPx = 8.4e6; // ~2880×2900 — keeps big 4K monitors from allocating absurd canvases
    const dpr = Math.min(window.devicePixelRatio || 1, 3, Math.sqrt(maxPx / (w * h)));
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slow = conn?.saveData || /(^|-)2g|3g/.test(conn?.effectiveType ?? "");
    // lg: full 1920×1080 frames · pt2/pt: portrait crops for phones · sm: 960px for slow connections
    const portrait = layout.vp.mode === "stack" && portraitCropFits(layout.vp);
    const apply = (set: SetName) => {
      // slow connections keep the light path; everything else rests at device resolution
      const hiS = set === "sm" ? 1 : Math.max(1, dpr);
      // scrub canvas: the frames' own pixels per CSS pixel, never above the rest canvas.
      // (every set spans the same 1920-px source width over cam.dw CSS px — the portrait
      // crop is a slice of it — except the 960-px slow-connection set)
      const camW = layout.cams.still.dw; // the cover scale is the same for every chapter
      const srcS = (set === "sm" ? FRAME_W.sm : FRAME_W.lg) / camW;
      const loS = Math.max(0.5, Math.min(hiS, srcS));
      const dual = loS < hiS * 0.97;
      scales.current = { hi: hiS, lo: dual ? loS : hiS, dual, set };
      hi.width = Math.round(w * hiS);
      hi.height = Math.round(h * hiS);
      if (dual) {
        lo.width = Math.round(w * loS);
        lo.height = Math.round(h * loS);
      } else {
        lo.width = lo.height = 1;
      }
      lo.style.visibility = "hidden";
      hi.style.visibility = "";
      last.current.key = "";
      last.current.tier = "";
      // decoded-frame budget: lg 8.3 MB, pt 4.7 MB, sm 2 MB per frame
      load(set, set === "lg" ? 26 : set === "pt" ? 30 : 48);
      getEngine().poke();
    };
    if (slow) {
      resetHq("");
      apply("sm");
    } else if (!portrait) {
      resetHq("");
      apply("lg");
    } else {
      apply("pt");
      canAvif().then((ok) => {
        resetHq(ok ? "pt2" : "");
        getEngine().poke();
      });
    }
  }, [layout]);

  useTick((t) => {
    const hi = hiRef.current;
    const lo = loRef.current;
    if (!hi || !lo) return;
    const L = last.current;
    const S = scales.current;
    const cam = t.cam;
    const camKey = `${cam.dw.toFixed(1)}|${cam.ox.toFixed(1)}|${cam.oy.toFixed(1)}|${hi.width}`;
    /* Sub-frame blending. The reel is 191 frames stretched over ~14 screens of scroll — one
       new picture every 45–95 px — so a slow scroll showed a new frame only a few times a
       second (stop-motion, however smooth the page). Drawing frame i, then frame i+1 on top
       at the fractional position, makes the picture move continuously with every pixel. */
    const N = countOf(store.set);
    const f = clamp(t.frame * (store.set ? SUB[store.set] : 1), 0, N - 1); // position in this set's frames
    const i0 = Math.floor(f);
    const i1 = Math.min(N - 1, i0 + 1);
    const a = Math.round((f - i0) * 24) / 24; // 1/24 steps: a redraw every ~2–4 px of scroll
    const i = a >= 0.5 ? i1 : i0;
    const pos = i0 + a;
    // adaptive: watch real frame pacing while the film moves; a device that can't hold ~45fps
    // with two layers drops back to single frames (and gets it back once it recovers)
    const dtick = t.time - (L.lastT || t.time);
    L.lastT = t.time;
    const speed = Math.abs(pos - (L.pos < 0 ? pos : L.pos)); // frames advanced this tick
    if (pos !== L.pos && dtick > 0 && dtick < 200) {
      L.ema = L.ema * 0.92 + dtick * 0.08;
      if (!L.noBlend && L.ema > 22) L.noBlend = true;
      else if (L.noBlend && L.ema < 17) L.noBlend = false;
    }
    if (pos !== L.pos || t.moving) L.changedAt = t.time;
    if (i !== L.frame) L.dir = i > L.frame ? 1 : -1;
    L.pos = pos;
    prefetch(i, L.dir);
    L.frame = i;
    // "resting" = the film hasn't moved for a moment → refine to the sharp frames
    const resting = t.time - L.changedAt > 140;
    // fast flicks (≥ ~0.8 frame per tick) don't show the in-between anyway — skip the second layer
    const blend = a > 0.02 && a < 0.98 && !L.noBlend && speed < 0.8;
    let A: ImageBitmap | null = null;
    let B: ImageBitmap | null = null;
    let alpha = 0;
    let src = "";
    if (resting && hq.set) {
      const k0 = blend ? i0 : i;
      wantHq(k0);
      if (blend) wantHq(i1);
      const h0 = hq.bitmaps.get(k0);
      const h1 = blend ? hq.bitmaps.get(i1) : null;
      if (h0 && (!blend || h1)) {
        A = h0;
        B = h1 ?? null;
        alpha = blend ? a : 0;
        src = `hq${k0}+${blend ? i1 : ""}@${alpha}`;
        L.shown = i;
      }
    }
    if (!A) {
      const f0 = store.bitmaps.get(blend ? i0 : i);
      const f1 = blend ? store.bitmaps.get(i1) : null;
      if (f0 && (!blend || f1)) {
        A = f0;
        B = f1 ?? null;
        alpha = blend ? a : 0;
        src = `${store.set}${blend ? i0 : i}+${blend ? i1 : ""}@${alpha}`;
        L.shown = i;
      } else {
        // a neighbour isn't decoded yet: show the closest single frame (never stepping backwards)
        const [n, at] = nearest(i, L.dir, L.shown);
        if (!n) return;
        A = n;
        L.shown = at;
        src = `${store.set}${at}`;
      }
    }
    // in motion: the scrub canvas at source resolution, bilinear; at rest: the device-resolution
    // canvas with the high-quality filter (a single canvas does both where they coincide)
    const tier: "hi" | "lo" = S.dual && !resting ? "lo" : "hi";
    const q: ImageSmoothingQuality = resting ? "high" : "low";
    // the scrims and streak tracers are part of this picture too (see paint.ts)
    const scrims = scrimsAt(t);
    const tracing = streakEnergy(t) > 0.02;
    const key = `${src}|${q}|${tier}|${camKey}|${scrimKey(scrims)}|${tracing ? t.chapter : "-"}`;
    if (key === L.key) return;
    L.key = key;
    const c = tier === "lo" ? lo : hi;
    const ctx = c.getContext("2d", { alpha: false });
    if (!ctx) return;
    const crop = store.set === "pt" || store.set === "pt2";
    const { w: vw, h: vh } = t.layout.vp;
    draw(ctx, A, B, alpha, cam, tier === "lo" ? S.lo : S.hi, vw, vh, crop, q);
    drawScrims(ctx, scrims, vw, vh);
    if (tracing) drawTracers(ctx, t, vw, vh);
    if (tier !== L.tier) {
      // swap in the same task as the draw: the compositor never sees an empty frame
      L.tier = tier;
      if (tier === "lo") {
        lo.style.visibility = "";
        hi.style.visibility = "hidden";
      } else {
        hi.style.visibility = "";
        lo.style.visibility = "hidden";
      }
    }
  });

  return (
    <>
      <canvas ref={hiRef} className="film-canvas" aria-hidden />
      <canvas ref={loRef} className="film-canvas film-canvas--scrub" aria-hidden style={{ visibility: "hidden" }} />
    </>
  );
}

function draw(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  next: ImageBitmap | null,
  alpha: number,
  cam: CamRect,
  s: number,
  vw: number,
  vh: number,
  crop: boolean,
  q: ImageSmoothingQuality,
) {
  ctx.setTransform(s, 0, 0, s, 0, 0);
  // full-bleed: the frame covers the viewport, so it only needs a clear if it doesn't
  if (cam.ox > 0 || cam.oy > 0 || cam.ox + cam.dw < vw || cam.oy + cam.dh < vh) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, vw, vh);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = q;
  const put = (b: ImageBitmap) =>
    crop ? ctx.drawImage(b, cam.ox + PT_X0 * cam.dw, cam.oy, PT_W * cam.dw, cam.dh) : ctx.drawImage(b, cam.ox, cam.oy, cam.dw, cam.dh);
  put(img);
  if (next && alpha > 0) {
    ctx.globalAlpha = alpha;
    put(next);
    ctx.globalAlpha = 1;
  }
  // phones (zoomed-out film): melt the frame's bottom edge into the page so there's no seam
  const bottom = cam.oy + cam.dh;
  if (bottom < vh - 1) {
    const fade = Math.min(220, cam.dh * 0.3);
    const g = ctx.createLinearGradient(0, bottom - fade, 0, bottom);
    g.addColorStop(0, "rgba(4,5,12,0)");
    g.addColorStop(0.55, "rgba(4,5,12,0.72)");
    g.addColorStop(1, BG);
    ctx.fillStyle = g;
    ctx.fillRect(0, bottom - fade, vw, fade + 1);
  }
}
