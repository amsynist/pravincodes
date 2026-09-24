"use client";

import { useEffect, useRef } from "react";
import { useLayoutState, useTick } from "./react";
import { CHAPTERS, VIDEO, frameAt, silhouetteUnion, SIL_ROWS } from "./timeline";
import { getEngine } from "./engine";

/**
 * Debug overlay (?debug): protected head box, face box, silhouette union, layout zones and a
 * readout. The streak tracers that used to live here are painted into the film canvas itself
 * (paint.ts), so on a normal visit this layer is a 1×1 canvas that never draws.
 */
export default function Overlay() {
  const ref = useRef<HTMLCanvasElement>(null);
  const layout = useLayoutState();
  const lastKey = useRef("");

  useEffect(() => {
    if (!layout) return;
    const c = ref.current!;
    if (!getEngine().debug) {
      c.width = c.height = 1;
      c.style.display = "none";
      return;
    }
    c.style.display = "";
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    c.width = Math.round(layout.vp.w * dpr);
    c.height = Math.round(layout.vp.h * dpr);
  }, [layout]);

  useTick((t) => {
    const c = ref.current;
    if (!c || !getEngine().debug || c.width <= 1) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { vp } = t.layout;
    const dpr = c.width / vp.w;
    const key = `${t.frame.toFixed(2)}|${t.cam.ox.toFixed(0)}|${t.cam.dw.toFixed(0)}|${t.chapter}|${t.progress.toFixed(3)}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vp.w, vp.h);
    const cam = t.cam;
    const head = t.head;
    const fr = frameAt(t.frame);
    const ch = CHAPTERS[t.chapter];
    const zone = t.layout.zones[ch.id];
    ctx.strokeStyle = "rgba(255,60,60,.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(head.x, head.y, head.w, head.h);
    const f = fr.f;
    ctx.strokeStyle = "rgba(255,220,0,.9)";
    ctx.strokeRect(cam.ox + f[0] * cam.dw, cam.oy + f[1] * cam.dh, f[2] * cam.dw, f[3] * cam.dh);
    const rows = silhouetteUnion(ch.frames[0] - 4, ch.frames[1] + 4);
    ctx.fillStyle = "rgba(255,0,200,.12)";
    rows.forEach(([x0, x1], r) => {
      if (x1 <= x0) return;
      ctx.fillRect(cam.ox + x0 * cam.dw, cam.oy + (r / SIL_ROWS) * cam.dh, (x1 - x0) * cam.dw, cam.dh / SIL_ROWS);
    });
    ctx.strokeStyle = "rgba(0,255,255,.9)";
    ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
    ctx.font = "12px monospace";
    ctx.fillStyle = "#0ff";
    ctx.fillText(`${ch.id} p=${t.progress.toFixed(2)} f=${t.frame.toFixed(1)}/${VIDEO.count} ${vp.w}x${vp.h} ${vp.mode}`, 90, vp.h - 80);
  });

  return <canvas ref={ref} className="film-overlay" aria-hidden />;
}
