/**
 * Everything that belongs to the film's own picture and used to be a separate full-screen
 * layer on top of it: the legibility scrims that follow each chapter's zone, the vignette,
 * and the tracer lines riding the light streaks. Painting them into the film canvas removes
 * five screen-sized composited layers (each 33 MB on a 4K monitor, blended on every frame)
 * — they now cost a few gradient fills at the canvas' resolution, only when the film redraws.
 */
import type { Tick } from "./engine";
import { CHAPTERS, clamp, frameAt } from "./timeline";
import { chapterVis } from "./react";

const INK = (a: number) => `rgba(3,4,7,${a.toFixed(3)})`;

export type ScrimState = { band: number; right: number; left: number; bandY: number };

/** Chapter-zone scrims for this tick: how dark under the chin, on the right, on the left. */
export function scrimsAt(t: Tick): ScrimState {
  let vb = 0, vr = 0, vl = 0, by = 0, bw = 0;
  for (const c of CHAPTERS) {
    const v = chapterVis(c.id, t.progressOf(c.id));
    const z = t.layout.zones[c.id];
    if (z.shape === "band") {
      vb = Math.max(vb, v);
      by += z.y * v;
      bw += v;
      if (c.id === "signal") vl = Math.max(vl, v * 0.85); // the skill tree also climbs the left side
    } else if (c.side === "right") vr = Math.max(vr, v);
    else vl = Math.max(vl, v);
  }
  return { band: vb, right: vr, left: vl, bandY: bw > 0 ? by / bw : t.layout.zones.still.y };
}

export const scrimKey = (s: ScrimState) => `${s.band.toFixed(2)}|${s.right.toFixed(2)}|${s.left.toFixed(2)}|${s.bandY.toFixed(0)}`;

/* gradients are cached per canvas size (and band position) — a CanvasGradient is cheap, but
   the film redraws up to sixty times a second */
type GCache = { key: string; right?: CanvasGradient; left?: CanvasGradient; vig?: CanvasGradient; top?: CanvasGradient; bandKey?: string; band?: CanvasGradient };
const caches = new WeakMap<CanvasRenderingContext2D, GCache>();

/** The scrims + vignette, in CSS px (the context is already scaled). Same stops as the old CSS layers. */
export function drawScrims(ctx: CanvasRenderingContext2D, s: ScrimState, vw: number, vh: number) {
  let g = caches.get(ctx);
  const key = `${vw}x${vh}`;
  if (!g || g.key !== key) {
    g = { key };
    caches.set(ctx, g);
  }
  // under-chin band: darkens the jacket so type reads, never reaches the face
  if (s.band > 0.005) {
    const bk = s.bandY.toFixed(0);
    if (g.bandKey !== bk) {
      const y = s.bandY;
      const grad = ctx.createLinearGradient(0, 0, 0, vh);
      const p = (v: number) => clamp(v / vh);
      grad.addColorStop(0, INK(0));
      grad.addColorStop(p(y - 60), INK(0));
      grad.addColorStop(p(y + 70), INK(0.36));
      grad.addColorStop(1, INK(0.66));
      g.band = grad;
      g.bandKey = bk;
    }
    ctx.globalAlpha = s.band;
    ctx.fillStyle = g.band!;
    ctx.fillRect(0, Math.max(0, s.bandY - 60), vw, vh);
  }
  if (s.right > 0.005) {
    if (!g.right) {
      const grad = ctx.createLinearGradient(vw, 0, 0, 0);
      grad.addColorStop(0, INK(0.64));
      grad.addColorStop(0.24, INK(0.32));
      grad.addColorStop(0.4, INK(0));
      g.right = grad;
    }
    ctx.globalAlpha = s.right;
    ctx.fillStyle = g.right;
    ctx.fillRect(vw * 0.6, 0, vw * 0.4, vh);
  }
  if (s.left > 0.005) {
    if (!g.left) {
      const grad = ctx.createLinearGradient(0, 0, vw, 0);
      grad.addColorStop(0, INK(0.66));
      grad.addColorStop(0.24, INK(0.32));
      grad.addColorStop(0.4, INK(0));
      g.left = grad;
    }
    ctx.globalAlpha = s.left;
    ctx.fillStyle = g.left;
    ctx.fillRect(0, 0, vw * 0.4, vh);
  }
  ctx.globalAlpha = 1;
  // vignette: radial-gradient(140% 100% at 50% 40%, transparent 64%, ink .3 100%) — an ellipse,
  // drawn as a circle under a horizontal stretch
  const rx = vw * 1.4, ry = vh;
  if (!g.vig) {
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
    grad.addColorStop(0, INK(0));
    grad.addColorStop(0.64, INK(0));
    grad.addColorStop(1, INK(0.3));
    g.vig = grad;
  }
  ctx.save();
  ctx.translate(vw * 0.5, vh * 0.4);
  ctx.scale(rx / ry, 1);
  ctx.fillStyle = g.vig;
  ctx.fillRect(-vw * 0.5 / (rx / ry), -vh * 0.4, vw / (rx / ry), vh);
  ctx.restore();
  // and the soft darkening along the top edge (linear-gradient(to bottom, ink .3, transparent 11%))
  if (!g.top) {
    const grad = ctx.createLinearGradient(0, 0, 0, vh * 0.11);
    grad.addColorStop(0, INK(0.3));
    grad.addColorStop(1, INK(0));
    g.top = grad;
  }
  ctx.fillStyle = g.top;
  ctx.fillRect(0, 0, vw, vh * 0.11);
}

/** Streak energy of the current frame (0 = nothing to trace). */
export function streakEnergy(t: Tick) {
  return clamp((frameAt(t.frame).k - 0.025) / 0.13);
}

/**
 * Tracer lines riding the real light streaks detected in each frame: never across the head,
 * never through the band the text lives in. Packets travel with the scroll, not the clock.
 */
export function drawTracers(ctx: CanvasRenderingContext2D, t: Tick, vw: number, vh: number) {
  const fr = frameAt(t.frame);
  const energy = streakEnergy(t);
  const sig = chapterVis("signal", t.progressOf("signal"));
  const weight = energy * (0.35 + 0.65 * sig);
  if (weight <= 0.02) return;
  const cam = t.cam;
  const head = t.head;
  const zone = t.layout.zones[CHAPTERS[t.chapter].id];
  fr.s.forEach(([sy, sx0, sx1, int], n) => {
    if (int < 0.12) return;
    const y = cam.oy + sy * cam.dh;
    if (y < 76 || y > vh - 56) return;
    if (y > zone.y - 12 && y < zone.y + zone.h + 12 && zone.shape === "band") return;
    let segs: [number, number][] = [[cam.ox + sx0 * cam.dw, cam.ox + sx1 * cam.dw]];
    // cut around the head (and generous vertical band)
    if (y > head.y - 14 && y < head.y + head.h + 14) {
      const hx0 = head.x - 24, hx1 = head.x + head.w + 24;
      segs = segs.flatMap(([a, b]) => {
        const out: [number, number][] = [];
        if (a < hx0) out.push([a, Math.min(b, hx0)]);
        if (b > hx1) out.push([Math.max(a, hx1), b]);
        return out;
      });
    }
    const alpha = clamp(int * 1.4) * weight;
    const yy = Math.round(y);
    segs.forEach(([a, b], si) => {
      const len = b - a;
      if (len < 40) return;
      const g = ctx.createLinearGradient(a, 0, b, 0);
      g.addColorStop(0, "rgba(125,180,255,0)");
      g.addColorStop(0.2, `rgba(125,180,255,${(alpha * 0.55).toFixed(3)})`);
      g.addColorStop(0.8, `rgba(125,180,255,${(alpha * 0.55).toFixed(3)})`);
      g.addColorStop(1, "rgba(125,180,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(a, yy + 0.5, len, 1);
      // travelling packet — advances with the film (scroll), not with wall-clock time
      const ph = (t.frame * (0.021 + (n % 3) * 0.006) + n * 0.37 + si * 0.21) % 1;
      const px = a + len * (0.1 + 0.8 * ph);
      ctx.fillStyle = `rgba(214,232,255,${(alpha * 0.95).toFixed(3)})`;
      ctx.fillRect(px - 3, yy - 0.5, 6, 3);
    });
  });
}
