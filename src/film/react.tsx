"use client";

import {
  CSSProperties,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { getEngine, Tick } from "./engine";
import { CHAPTERS, ChapterId, clamp, ease } from "./timeline";
import type { Layout } from "./camera";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useFilmStart() {
  useIso(() => {
    getEngine().start();
    return startSnap();
  }, []);
}

const serverCoarse = { layout: null, chapter: 0, unit: 0 };
export function useCoarse() {
  const e = getEngine();
  return useSyncExternalStore(e.subscribeCoarse, e.getCoarse, () => serverCoarse);
}

export function useLayoutState(): Layout | null {
  return useCoarse().layout;
}

/** Subscribe to every engine tick without re-rendering. */
export function useTick(cb: (t: Tick) => void) {
  const ref = useRef(cb);
  useIso(() => {
    ref.current = cb;
  });
  useEffect(() => getEngine().subscribe((t) => ref.current(t)), []);
}

/* ------------------------------------------------------------------ */
/* Chapter stage: a fixed layer positioned inside the chapter's zone. */
/* ------------------------------------------------------------------ */

const ChapterCtx = createContext<ChapterId>("still");
export const useChapterId = () => useContext(ChapterCtx);

type Win = { in: [number, number]; out?: [number, number] };
const DEFAULT_WIN: Record<ChapterId, Win> = {
  still: { in: [-1, -0.5], out: [0.78, 0.96] },
  intent: { in: [0.04, 0.14], out: [0.86, 0.97] },
  signal: { in: [0.04, 0.12], out: [0.88, 0.97] },
  // the last project stays until the very end of Work and Contact rises straight after — no empty stretch
  work: { in: [0.03, 0.09], out: [0.965, 0.995] },
  dawn: { in: [0.0, 0.06] },
};

export function chapterVis(id: ChapterId, p: number) {
  const w = DEFAULT_WIN[id];
  const a = w.in[0] < 0 ? 1 : ease(w.in[0], w.in[1], p);
  const b = w.out ? 1 - ease(w.out[0], w.out[1], p) : 1;
  return clamp(Math.min(a, b));
}

export function Stage({
  id,
  children,
  className = "",
  align = "end",
  full = false,
}: {
  id: ChapterId;
  children: ReactNode | ((shape: "band" | "column", stack: boolean) => ReactNode);
  className?: string;
  align?: "start" | "center" | "end";
  /** cover the whole viewport; the child positions itself around the subject (skill tree) */
  full?: boolean;
}) {
  const layout = useLayoutState();
  const ref = useRef<HTMLDivElement>(null);
  const shown = useRef<boolean | null>(null);
  const lastO = useRef("");
  useTick((t) => {
    const el = ref.current;
    if (!el) return;
    const v = chapterVis(id, t.progressOf(id));
    const o = v.toFixed(3);
    if (o !== lastO.current) {
      lastO.current = o;
      el.style.opacity = o;
    }
    const on = v > 0.02;
    if (on !== shown.current) {
      shown.current = on;
      el.style.visibility = on ? "visible" : "hidden";
      if (on) el.removeAttribute("inert");
      else el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", on ? "false" : "true");
    }
  });
  const z = layout?.zones[id];
  const stack = layout?.vp.mode === "stack";
  const shape = z?.shape ?? "band";
  const style: CSSProperties = {
    ...(z && !full ? { left: z.x, top: z.y, width: z.w, height: z.h } : { left: 0, top: 0, width: "100%", height: "100%" }),
    justifyContent: shape === "band" ? "flex-end" : align === "start" ? "flex-start" : align === "center" ? "center" : "flex-end",
  };
  return (
    <ChapterCtx.Provider value={id}>
      <div
        ref={ref}
        data-stage={id}
        data-shape={shape}
        className={`stage stage--${full ? "full" : shape} ${stack ? "stage--stack" : ""} ${className}`}
        style={{ ...style, opacity: 0, visibility: "hidden" }}
      >
        {typeof children === "function" ? children(shape, !!stack) : children}
      </div>
    </ChapterCtx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Beat: reveals content inside a chapter progress window.            */
/* ------------------------------------------------------------------ */

export function Beat({
  at,
  atStack,
  children,
  className = "",
  as: Tag = "div",
  y = 22,
  style,
}: {
  at: [number, number];
  atStack?: [number, number];
  children: ReactNode;
  className?: string;
  as?: "div" | "p" | "h2" | "h3" | "span" | "li" | "ul";
  y?: number;
  style?: CSSProperties;
}) {
  const id = useChapterId();
  const layout = useLayoutState();
  const ref = useRef<HTMLElement>(null);
  const compact = layout ? isCompact(layout, id) : false;
  const win = compact && atStack ? atStack : at;
  const last = useRef("");
  useTick((t) => {
    const el = ref.current;
    if (!el) return;
    const p = t.progressOf(id);
    const [a, b] = win;
    const fin = a <= 0 ? 1 : ease(a, a + 0.07, p);
    const fout = b >= 1 ? 0 : ease(b - 0.06, b, p);
    const v = clamp(fin - fout);
    const o = v.toFixed(3);
    const ty = ((1 - fin) * y - fout * y * 0.6).toFixed(1);
    const key = o + ty + compact;
    if (key === last.current) return; // no style writes when nothing changed
    last.current = key;
    el.style.opacity = o;
    el.style.transform = `translate3d(0, ${ty}px, 0)`;
    el.style.pointerEvents = v > 0.5 ? "" : "none";
    if (compact && atStack) el.style.display = v <= 0.001 ? "none" : "";
  });
  const T = Tag as "div";
  return (
    <T ref={ref as React.Ref<HTMLDivElement>} className={`beat ${className}`} style={{ opacity: 0, ...style }}>
      {children}
    </T>
  );
}

/** Line-by-line mask reveal for display type. */
export function Lines({ lines, at, className = "", stagger = 0.035 }: { lines: ReactNode[]; at: number; className?: string; stagger?: number }) {
  const id = useChapterId();
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const last = useRef<string[]>([]);
  useTick((t) => {
    const p = t.progressOf(id);
    refs.current.forEach((el, i) => {
      if (!el) return;
      const a = at + i * stagger;
      const v = at <= 0 ? 1 : ease(a, a + 0.08, p);
      const tr = `translate3d(0, ${((1 - v) * 105).toFixed(1)}%, 0)`;
      if (last.current[i] === tr) return;
      last.current[i] = tr;
      el.style.transform = tr;
    });
  });
  return (
    <span className={`lines ${className}`}>
      {lines.map((l, i) => (
        <span className="line" key={i}>
          <span className="line__in" ref={(el) => { refs.current[i] = el; }}>
            {l}
          </span>
        </span>
      ))}
    </span>
  );
}

/** Face guard wrapper: fades + slides its content away from the subject's head when they overlap. */
export function Guard({
  children,
  className = "",
  style,
  level = "head",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  level?: "head" | "face";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return getEngine().guard(ref.current, level);
  }, [level]);
  return (
    <div ref={ref} data-guard className={className} style={style}>
      <div className="guard-inner">{children}</div>
    </div>
  );
}

/**
 * Rest points: where each chapter is FULLY drawn (every beat revealed, nothing mid-wipe
 * or fading out). Measured by sweeping each chapter at 7 viewports and keeping the
 * middle of a window that is complete on all of them. Arrows, the section menu and
 * every "go to" button land here, so no stop ever shows a half-built screen.
 *   full    = the chapter's regular layout
 *   compact = short bands / phones (content pages one beat at a time) or the band tree
 */
const REST: Record<ChapterId, { full: number; compact: number }> = {
  still: { full: 0, compact: 0 },
  intent: { full: 0.6, compact: 0.24 },
  signal: { full: 0.79, compact: 0.46 },
  work: { full: 0.124, compact: 0.124 },
  dawn: { full: 0.4, compact: 0.4 },
};
const restVariant: Partial<Record<ChapterId, "full" | "compact">> = {};
/** A chapter whose layout choice isn't the band height (the skill tree) reports it here. */
export function setRestVariant(id: ChapterId, v: "full" | "compact") {
  restVariant[id] = v;
}
export function restOf(id: ChapterId) {
  const layout = getEngine().coarse.layout;
  const v = restVariant[id] ?? (isCompact(layout, id) ? "compact" : "full");
  return REST[id][v];
}

export function scrollToChapter(id: ChapterId, at?: number) {
  getEngine().scrollToChapter(id, at ?? restOf(id));
}

/* ------------------------------------------------------------------ */
/* Snapping — when the visitor stops scrolling, never leave a half-    */
/* built screen: glide to the nearest fully drawn stop.                 */
/*  · Work pages: one card per scroll gesture (like Apple's galleries)  */
/*  · elsewhere : only if it stopped mid-transition (proximity snap)    */
/* ------------------------------------------------------------------ */
/** Work cards occupy [W_A, W_A + W_SPAN] of the Work chapter, one equal slot each. */
export const W_A = 0.06;
export const W_SPAN = 0.9;
const WORK_CARDS = 7;
const WORK_STOPS = Array.from({ length: WORK_CARDS }, (_, i) => W_A + (i + 0.5) * (W_SPAN / WORK_CARDS));
/** Fully drawn stops per chapter (measured windows, see REST) — full layout / compact (paged). */
const STOPS: Record<ChapterId, { full: number[]; compact: number[] }> = {
  still: { full: [0, 0.26, 0.73], compact: [0, 0.26, 0.73] },
  intent: { full: [0.6], compact: [0.24, 0.57, 0.82] },
  signal: { full: [0.79], compact: [0.46, 0.66, 0.86] },
  work: { full: WORK_STOPS, compact: WORK_STOPS },
  dawn: { full: [0.4], compact: [0.4] },
};

function stopsY(): number[] {
  const e = getEngine();
  const layout = e.coarse.layout;
  const out: number[] = [];
  for (const c of CHAPTERS) {
    const v = restVariant[c.id] ?? (isCompact(layout, c.id) ? "compact" : "full");
    for (const p of STOPS[c.id][v]) out.push(e.chapterStart(c.id, p));
  }
  return out.sort((a, b) => a - b);
}

/** Is anything in the visible stage(s) half-shown (fading, mid-wipe) — or is nothing shown at all? */
function screenIncomplete(): boolean {
  const stages = [...document.querySelectorAll<HTMLElement>("[data-stage]")].filter((s) => +getComputedStyle(s).opacity > 0.02);
  if (!stages.length) return true; // only the film: a gap between sections
  for (const st of stages) {
    if (+getComputedStyle(st).opacity < 0.98) return true;
    let shown = 0;
    for (const el of st.querySelectorAll<HTMLElement>("h1,h2,h3,p,li,a,button,dd,.chip,.st-leaf")) {
      if (el instanceof HTMLButtonElement && el.disabled) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      let o = 1;
      let clipped = false;
      for (let n: HTMLElement | null = el; n && n !== st.parentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        o *= +cs.opacity;
        if (cs.visibility === "hidden" || cs.display === "none") o = 0;
        if (cs.clipPath.startsWith("inset(")) {
          const v = cs.clipPath.slice(6).split("round")[0].trim().split(/\s+/).map(parseFloat);
          if (v.some((x) => x > 0.5)) clipped = true;
        }
        if (o < 0.03) break;
      }
      if (o < 0.03) continue;
      if (o < 0.95 || clipped) return true;
      shown++;
    }
    if (!shown) return true;
  }
  return false;
}

function startSnap() {
  const e = getEngine();
  return e.onIdle((y, dir) => {
    if (document.documentElement.style.overflow === "hidden") return; // a sheet is open
    const stops = stopsY();
    const eps = 3;
    if (stops.some((s) => Math.abs(s - y) <= eps)) return; // already on a stop
    // paging zone: from the stop before the first card to the stop after the last one, so one
    // scroll past project 7 carries straight on to Contact (and one before project 1, back up)
    const workFrom = e.chapterStart("work", WORK_STOPS[0]);
    const workTo = e.chapterStart("work", WORK_STOPS[WORK_STOPS.length - 1]);
    const fi = stops.findIndex((s) => Math.abs(s - workFrom) < 1);
    const li = stops.findIndex((s) => Math.abs(s - workTo) < 1);
    const lower = fi > 0 ? stops[fi - 1] : workFrom;
    const upper = li >= 0 && li < stops.length - 1 ? stops[li + 1] : workTo;
    const inWork = y > lower && y < upper;
    // outside the cards: leave the visitor alone unless the screen is half-built
    if (!inWork && !screenIncomplete()) return;
    let prev = -Infinity;
    let next = Infinity;
    for (const s of stops) {
      if (s < y && s > prev) prev = s;
      if (s > y && s < next) next = s;
    }
    if (!isFinite(prev)) return e.jumpTo(next);
    if (!isFinite(next)) return e.jumpTo(prev);
    // direction wins as soon as you've clearly moved (12% of the way, or 60px for long gaps
    // like project 7 → Contact) — one flick, one stop
    const moved = dir > 0 ? y - prev : next - y;
    const along = moved / (next - prev);
    const ahead = dir > 0 ? next : prev;
    const behind = dir > 0 ? prev : next;
    e.jumpTo(along > 0.12 || moved > 60 ? ahead : behind);
  });
}

export function chapterIndex(id: ChapterId) {
  return CHAPTERS.findIndex((c) => c.id === id);
}

/** Short bands (small laptops, phones) page their content one beat at a time. */
export function isCompact(layout: Layout | null, id: ChapterId) {
  return !!layout && (layout.vp.mode === "stack" || layout.zones[id].h < 260);
}
