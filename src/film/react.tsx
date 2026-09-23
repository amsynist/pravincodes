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
  work: { in: [0.03, 0.09], out: [0.93, 0.985] },
  dawn: { in: [0.08, 0.2] },
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
}: {
  id: ChapterId;
  children: ReactNode | ((shape: "band" | "column", stack: boolean) => ReactNode);
  className?: string;
  align?: "start" | "center" | "end";
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
    ...(z ? { left: z.x, top: z.y, width: z.w, height: z.h } : { left: 0, top: 0, width: "100%", height: "100%" }),
    justifyContent: shape === "band" ? "flex-end" : align === "start" ? "flex-start" : align === "center" ? "center" : "flex-end",
  };
  return (
    <ChapterCtx.Provider value={id}>
      <div
        ref={ref}
        data-stage={id}
        data-shape={shape}
        className={`stage stage--${shape} ${stack ? "stage--stack" : ""} ${className}`}
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

export function scrollToChapter(id: ChapterId, at?: number) {
  getEngine().scrollToChapter(id, at);
}

export function chapterIndex(id: ChapterId) {
  return CHAPTERS.findIndex((c) => c.id === id);
}

/** Short bands (small laptops, phones) page their content one beat at a time. */
export function isCompact(layout: Layout | null, id: ChapterId) {
  return !!layout && (layout.vp.mode === "stack" || layout.zones[id].h < 260);
}
