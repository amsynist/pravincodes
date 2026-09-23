"use client";

import { useEffect, useRef } from "react";
import { useLayoutState, useTick, chapterVis } from "./react";
import { CHAPTERS, VIDEO, clamp, frameAt, silhouetteUnion, SIL_ROWS } from "./timeline";
import { getEngine } from "./engine";
import type { Rect } from "./camera";

const LABELS = [
  "LANGCHAIN", "GROQ", "WEAVIATE", "FASTAPI", "GOLANG", "PINECONE", "WHISPER", "DEEPGRAM",
  "TERRAFORM", "K8S", "LORA", "VLLM", "NEXT.JS", "POSTGRES", "BIGQUERY", "STEP FUNCTIONS",
];

const overlaps = (a: Rect, b: Rect, pad = 0) =>
  a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

/**
 * Canvas overlay that belongs to the film:
 *  - tracer lines riding the real light streaks detected in each frame (never across the head)
 *  - ?debug : protected head box, silhouette union, layout zones
 */
export default function Overlay() {
  const ref = useRef<HTMLCanvasElement>(null);
  const layout = useLayoutState();
  const fontReady = useRef(false);
  const monoRef = useRef("monospace");
  const drewLast = useRef(true);
  const lastKey = useRef("");

  useEffect(() => {
    if (!layout) return;
    const c = ref.current!;
    // hairlines only need ~1.5x; a 2x full-screen canvas cleared every frame is pure fill cost
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    c.width = Math.round(layout.vp.w * dpr);
    c.height = Math.round(layout.vp.h * dpr);
    monoRef.current = getComputedStyle(document.documentElement).getPropertyValue("--font-mono-stack").trim() || "monospace";
    document.fonts?.ready.then(() => (fontReady.current = true));
  }, [layout]);

  useTick((t) => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { vp } = t.layout;
    const dpr = c.width / vp.w;
    const fr = frameAt(t.frame);
    const energy0 = clamp((fr.k - 0.025) / 0.13);
    const dbg = getEngine().debug;
    // redraw only when the frame/camera changed, and skip entirely when there's nothing to draw
    const key = `${Math.round(t.frame)}|${t.cam.ox.toFixed(0)}|${t.cam.dw.toFixed(0)}|${t.chapter}|${dbg ? t.progress.toFixed(3) : ""}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (energy0 <= 0.02 && !dbg) {
      if (drewLast.current) ctx.clearRect(0, 0, c.width, c.height);
      drewLast.current = false;
      return;
    }
    drewLast.current = true;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vp.w, vp.h);
    const stack = vp.mode === "stack";
    const cam = t.cam;
    const head = t.head;
    const chId = CHAPTERS[t.chapter].id;
    const zone = t.layout.zones[chId];
    const uiRects: Rect[] = [zone];
    // persistent chrome: top bar
    const chrome: Rect[] = [{ x: 0, y: 0, w: vp.w, h: 100 }];
    const blockers = [...uiRects, ...chrome];
    const mono = monoRef.current;

    /* ---- tracers on streaks ---- */
    const energy = clamp((fr.k - 0.025) / 0.13);
    const sig = chapterVis("signal", t.progressOf("signal"));
    const weight = energy * (0.35 + 0.65 * sig);
    if (weight > 0.02) {
      fr.s.forEach(([sy, sx0, sx1, int], n) => {
        if (int < 0.12) return;
        const y = cam.oy + sy * cam.dh;
        if (y < 76 || y > vp.h - 56) return;
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
        segs.forEach(([a, b], si) => {
          const len = b - a;
          if (len < 40) return;
          const g = ctx.createLinearGradient(a, 0, b, 0);
          g.addColorStop(0, "rgba(125,180,255,0)");
          g.addColorStop(0.2, `rgba(125,180,255,${(alpha * 0.55).toFixed(3)})`);
          g.addColorStop(0.8, `rgba(125,180,255,${(alpha * 0.55).toFixed(3)})`);
          g.addColorStop(1, "rgba(125,180,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(a, Math.round(y) + 0.5, len, 1);
          // travelling packet — advances with the film (scroll), not with wall-clock time
          const ph = (t.frame * (0.021 + (n % 3) * 0.006) + n * 0.37 + si * 0.21) % 1;
          const px = a + len * (0.1 + 0.8 * ph);
          ctx.fillStyle = `rgba(214,232,255,${(alpha * 0.95).toFixed(3)})`;
          ctx.fillRect(px - 3, Math.round(y) - 0.5, 6, 3);
          // label (wide mode, signal-heavy frames, only where it's clear of UI and the head)
          if (!stack && sig > 0.2 && fontReady.current && len > 160) {
            const label = LABELS[(Math.round(sy * 40) + si * 5) % LABELS.length];
            ctx.font = `500 10px ${mono}`;
            const tw = ctx.measureText(label).width + 14;
            const lr: Rect = { x: px + 8, y: y - 16, w: tw, h: 14 };
            if (lr.x + lr.w > vp.w - 24) lr.x = px - 8 - tw;
            const blocked = overlaps(lr, head, 16) || blockers.some((u) => overlaps(lr, u, 12));
            if (!blocked) {
              ctx.fillStyle = `rgba(214,232,255,${(alpha * 0.9 * sig).toFixed(3)})`;
              ctx.fillText("▸ " + label, lr.x, y - 6);
            }
          }
        });
      });
    }

    /* ---- debug ---- */
    if (getEngine().debug) {
      ctx.strokeStyle = "rgba(255,60,60,.95)";
      ctx.lineWidth = 2;
      ctx.strokeRect(head.x, head.y, head.w, head.h);
      const f = fr.f;
      ctx.strokeStyle = "rgba(255,220,0,.9)";
      ctx.strokeRect(cam.ox + f[0] * cam.dw, cam.oy + f[1] * cam.dh, f[2] * cam.dw, f[3] * cam.dh);
      const ch = CHAPTERS[t.chapter];
      const rows = silhouetteUnion(ch.frames[0] - 4, ch.frames[1] + 4);
      ctx.fillStyle = "rgba(255,0,200,.12)";
      rows.forEach(([x0, x1], r) => {
        if (x1 <= x0) return;
        ctx.fillRect(cam.ox + x0 * cam.dw, cam.oy + (r / SIL_ROWS) * cam.dh, (x1 - x0) * cam.dw, cam.dh / SIL_ROWS);
      });
      ctx.strokeStyle = "rgba(0,255,255,.9)";
      uiRects.forEach((u) => ctx.strokeRect(u.x, u.y, u.w, u.h));
      ctx.font = "12px monospace";
      ctx.fillStyle = "#0ff";
      ctx.fillText(`${ch.id} p=${t.progress.toFixed(2)} f=${t.frame.toFixed(1)}/${VIDEO.count} ${vp.w}x${vp.h} ${vp.mode}`, 90, vp.h - 80);
    }
  });

  return <canvas ref={ref} className="film-overlay" aria-hidden />;
}
