"use client";

import { useEffect, useRef } from "react";
import { useLayoutState, useTick } from "./react";
import { getEngine } from "./engine";
import { VIDEO, clamp } from "./timeline";
import type { CamRect } from "./camera";

/* =====================================================================
   Frame store
   - All frames are fetched once as compressed WebP blobs (~9 MB total).
   - Only a sliding window around the playhead is decoded, into ImageBitmaps,
     with createImageBitmap (decodes OFF the main thread). drawImage on an
     ImageBitmap never triggers a synchronous decode, which was the main
     cause of scroll jank.
   - The window prefetches ahead in the scroll direction; frames far from the
     playhead are closed to keep memory bounded.
   ===================================================================== */

type Store = {
  set: "" | "lg" | "sm";
  blobs: (Blob | null)[];
  bitmaps: Map<number, ImageBitmap>;
  pending: Set<number>;
  fetched: number;
  limit: number;
  listeners: Set<(n: number) => void>;
};
const store: Store = { set: "", blobs: [], bitmaps: new Map(), pending: new Set(), fetched: 0, limit: 40, listeners: new Set() };

export function onLoadProgress(cb: (ratio: number) => void) {
  store.listeners.add(cb);
  cb(store.set ? store.fetched / VIDEO.count : 0);
  return () => {
    store.listeners.delete(cb);
  };
}

function order(n: number) {
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

const url = (set: string, i: number) => `/seq/${set}/${String(i + 1).padStart(3, "0")}.webp`;

function load(set: "lg" | "sm", limit: number) {
  store.limit = limit;
  if (store.set === set) return;
  store.bitmaps.forEach((b) => b.close());
  store.bitmaps.clear();
  store.pending.clear();
  store.set = set;
  store.blobs = new Array(VIDEO.count).fill(null);
  store.fetched = 0;
  const queue = order(VIDEO.count);
  let active = 0;
  const pump = () => {
    while (active < 6 && queue.length) {
      const i = queue.shift()!;
      active++;
      fetch(url(set, i))
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null)
        .then((blob) => {
          active--;
          if (store.set !== set) return;
          store.blobs[i] = blob;
          store.fetched++;
          store.listeners.forEach((l) => l(store.fetched / VIDEO.count));
          // make sure the frame we're sitting on gets decoded as soon as its bytes arrive
          getEngine().poke();
          pump();
        });
    }
  };
  pump();
}

function decode(i: number) {
  if (i < 0 || i >= VIDEO.count) return;
  if (store.bitmaps.has(i) || store.pending.has(i) || store.pending.size >= 4) return;
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
  decode(center);
  const ahead = dir >= 0 ? 1 : -1;
  for (let d = 1; d <= 14 && store.pending.size < 4; d++) {
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

function nearest(i: number): [ImageBitmap | null, number] {
  const exact = store.bitmaps.get(i);
  if (exact) return [exact, i];
  for (let d = 1; d < 24; d++) {
    const a = store.bitmaps.get(i - d);
    if (a) return [a, i - d];
    const b = store.bitmaps.get(i + d);
    if (b) return [b, i + d];
  }
  return [null, -1];
}

/* ---------------- renderer ---------------- */

const BG = "#04050c";

export default function FilmCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const layout = useLayoutState();
  const last = useRef({ key: "", frame: 0 });
  const scale = useRef(1);

  useEffect(() => {
    if (!layout) return;
    const c = ref.current!;
    const { w, h } = layout.vp;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const drawnCss = Math.max(w, (h * 16) / 9); // film is always full-bleed
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slow = conn?.saveData || /(^|-)2g|3g/.test(conn?.effectiveType ?? "");
    const set = !slow && drawnCss * dpr > 1250 ? "lg" : "sm";
    const srcW = set === "lg" ? 1600 : 960;
    // The backing store never exceeds the source's own resolution: a 1600px frame on a
    // retina laptop is drawn at 1x and upscaled by the compositor (same result,
    // about 4x less fill work per frame than a 2x canvas).
    scale.current = clamp(srcW / drawnCss, 1, dpr);
    c.width = Math.round(w * scale.current);
    c.height = Math.round(h * scale.current);
    last.current.key = "";
    const touch = matchMedia("(pointer: coarse)").matches;
    load(set, set === "lg" ? (touch ? 18 : 36) : 48);
  }, [layout]);

  useTick((t) => {
    const c = ref.current;
    if (!c) return;
    const i = clamp(Math.round(t.frame), 0, VIDEO.count - 1);
    prefetch(i, i - last.current.frame);
    last.current.frame = i;
    const [bm, at] = nearest(i);
    if (!bm) return;
    const cam = t.cam;
    const key = `${store.set}|${at}|${cam.dw.toFixed(1)}|${cam.ox.toFixed(1)}|${cam.oy.toFixed(1)}|${c.width}`;
    if (key === last.current.key) return;
    last.current.key = key;
    const ctx = c.getContext("2d", { alpha: false });
    if (!ctx) return;
    draw(ctx, bm, cam, scale.current, t.layout.vp.w, t.layout.vp.h);
  });

  return <canvas ref={ref} className="film-canvas" aria-hidden />;
}

function draw(ctx: CanvasRenderingContext2D, img: ImageBitmap, cam: CamRect, s: number, vw: number, vh: number) {
  ctx.setTransform(s, 0, 0, s, 0, 0);
  // full-bleed: the frame covers the viewport, so it only needs a clear if it doesn't
  if (cam.ox > 0 || cam.oy > 0 || cam.ox + cam.dw < vw || cam.oy + cam.dh < vh) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, vw, vh);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";
  ctx.drawImage(img, cam.ox, cam.oy, cam.dw, cam.dh);
}
