/**
 * Film engine — one rAF loop drives the whole page.
 *
 * scroll → smoothed position → chapter + local progress → video frame
 *        → camera rect → canvas draw, beat reveals, face guard, streak tracers.
 *
 * React only re-renders on coarse changes (viewport/layout, active chapter).
 * Everything per-frame is written imperatively to styles / CSS variables.
 */
import { CHAPTERS, ChapterId, TOTAL_VH, VIDEO, clamp, ease, frameAt, headAt, lerp } from "./timeline";
import { CamRect, Layout, Rect, blendCam, computeLayout, faceCam, modeFor, toScreen } from "./camera";

export type Tick = {
  y: number;
  frame: number;
  chapter: number;
  progress: number; // local progress in active chapter
  progressOf: (id: ChapterId) => number; // -ve before, >1 after
  cam: CamRect;
  head: Rect; // protected head rect in screen px (padded): hair + face + nose
  face: Rect; // face only (padded): the strict no-go area for persistent chrome
  layout: Layout;
  time: number;
  moving: boolean;
};

type Listener = (t: Tick) => void;
type Coarse = { layout: Layout | null; chapter: number; unit: number };

let rmQuery: MediaQueryList | null = null;
const reduceMotion = () => {
  if (typeof window === "undefined") return false;
  rmQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return rmQuery.matches;
};

class Engine {
  private listeners = new Set<Listener>();
  private coarseListeners = new Set<() => void>();
  private guards = new Map<HTMLElement, { g: number; dir: number; level: "head" | "face"; rect: DOMRect | null }>();
  /** frames left to keep ticking after the last change (lets easing/guards settle), then the loop idles */
  private settle = 60;
  private guardRectsStale = true;
  private raf = 0;
  private started = false;
  private targetY = 0;
  private y = 0;
  private lastT = 0;
  private starts: number[] = [];
  private lens: number[] = [];
  private lastTick: Tick | null = null;
  coarse: Coarse = { layout: null, chapter: 0, unit: 0 };
  debug = false;
  /** touch screens follow the finger 1:1 (native momentum already smooths it) */
  private touch = false;

  start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    this.debug = new URLSearchParams(location.search).has("debug");
    this.touch = matchMedia("(pointer: coarse)").matches;
    if (this.debug) (window as unknown as { __film: Engine }).__film = this;
    this.measure(true);
    this.targetY = this.y = window.scrollY;
    window.addEventListener("scroll", this.onScroll, { passive: true });
    for (const ev of ["wheel", "touchstart", "keydown"] as const) window.addEventListener(ev, this.cancelJump, { passive: true });
    window.addEventListener("resize", this.onResize);
    this.loop(performance.now());
  }

  private onScroll = () => {
    this.targetY = window.scrollY;
    this.settle = 60;
  };

  /** Wake the loop (e.g. a decoded frame arrived for the current position). */
  poke() {
    this.settle = Math.max(this.settle, 2);
  }

  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private onResize = () => {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.measure(false), 120);
  };

  /** Viewport unit is stable against mobile toolbar show/hide (height-only changes < 140px). */
  private measure(force: boolean) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const prev = this.coarse.layout?.vp;
    const touch = matchMedia("(pointer: coarse)").matches;
    if (!force && prev && touch && prev.w === w && Math.abs(prev.h - h) < 140) return;
    const vp = { w, h, mode: modeFor(w, h) };
    const unit = h / 100;
    document.documentElement.style.setProperty("--vhu", `${unit}px`);
    let acc = 0;
    this.starts = [];
    this.lens = [];
    for (const c of CHAPTERS) {
      this.starts.push(acc);
      this.lens.push(c.vh * unit);
      acc += c.vh * unit;
    }
    this.coarse = { ...this.coarse, layout: computeLayout(vp), unit };
    this.guardRectsStale = true;
    this.settle = 60;
    this.emitCoarse();
  }

  get totalScroll() {
    return TOTAL_VH * (this.coarse.unit || 1);
  }

  chapterStart(id: ChapterId, at = 0) {
    const i = CHAPTERS.findIndex((c) => c.id === id);
    return (this.starts[i] ?? 0) + (this.lens[i] ?? 0) * at;
  }

  /**
   * Eased jump to a chapter position. Our own animation rather than scroll-behavior:smooth:
   * the native one is cancelled by focus changes (a tapped button being disabled/hidden
   * mid-flight left phones stranded halfway), and older iOS ignores it. A wheel, touch or
   * key press from the visitor takes over immediately.
   */
  private jump: { from: number; to: number; t0: number; dur: number } | null = null;
  private cancelJump = () => {
    this.jump = null;
  };
  scrollToChapter(id: ChapterId, at = 0.18) {
    const to = Math.round(this.chapterStart(id, at));
    const from = window.scrollY;
    if (reduceMotion() || Math.abs(to - from) < 2) {
      window.scrollTo(0, to);
      return;
    }
    const dist = Math.abs(to - from) / (this.coarse.unit * 100 || 800); // in screens
    this.jump = { from, to, t0: performance.now(), dur: Math.min(1500, 520 + dist * 150) };
    this.settle = 60;
  }
  private stepJump(t: number) {
    const j = this.jump;
    if (!j) return;
    const k = Math.min(1, (t - j.t0) / j.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // easeInOutCubic
    const y = Math.round(j.from + (j.to - j.from) * e);
    window.scrollTo(0, y);
    this.targetY = y;
    this.settle = 60;
    if (k >= 1) this.jump = null;
  }

  private emitCoarse() {
    this.coarseListeners.forEach((l) => l());
  }

  subscribeCoarse = (l: () => void) => {
    this.coarseListeners.add(l);
    return () => this.coarseListeners.delete(l);
  };
  getCoarse = () => this.coarse;

  subscribe(l: Listener) {
    this.listeners.add(l);
    if (this.lastTick) l(this.lastTick);
    return () => {
      this.listeners.delete(l);
    };
  }

  guard(el: HTMLElement, level: "head" | "face" = "head") {
    this.guards.set(el, { g: 0, dir: 1, level, rect: null });
    this.guardRectsStale = true;
    this.settle = Math.max(this.settle, 30);
    return () => {
      this.guards.delete(el);
    };
  }

  private locate(y: number) {
    let i = 0;
    for (let k = 0; k < this.starts.length; k++) if (y >= this.starts[k]) i = k;
    const p = this.lens[i] ? (y - this.starts[i]) / this.lens[i] : 0;
    return { i, p: clamp(p, 0, 1) };
  }

  private camFor(layout: Layout, i: number, p: number, frame: number): CamRect {
    const vp = layout.vp;
    if (vp.mode === "stack") return faceCam(vp, frame);
    // wide: full-bleed always; the camera only pans between chapter framings
    const ids = CHAPTERS.map((c) => c.id);
    let cam = layout.cams[ids[i]];
    if (p > 0.84 && i < ids.length - 1) cam = blendCam(cam, layout.cams[ids[i + 1]], ease(0.84, 1, p) * 0.5);
    else if (p < 0.16 && i > 0) cam = blendCam(layout.cams[ids[i - 1]], cam, 0.5 + ease(0, 0.16, p) * 0.5);
    return cam;
  }

  private loop = (t: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const layout = this.coarse.layout;
    if (!layout) return;
    const dt = Math.min(64, t - (this.lastT || t));
    this.lastT = t;
    this.stepJump(t);
    // touch: read the scroll position at frame time (scroll events can land after rAF
    // in the same frame, which made the film step 0 / 2 / 0 / 2 px — a visible judder)
    if (this.touch) {
      const sy = window.scrollY;
      if (sy !== this.targetY) {
        this.targetY = sy;
        this.settle = 60;
      }
    }
    // idle: nothing scrolled, nothing settling → skip all per-frame work
    if (this.settle <= 0 && this.targetY === this.y) return;
    // Like Lenis: wheel/trackpad input is eased (wheel steps are coarse); touch is NOT —
    // iOS/Android momentum is already smooth, and easing on top of it reads as lag.
    // (a jump is already eased — follow it 1:1 so the two easings don't stack)
    const k = reduceMotion() || this.touch || this.jump ? 1 : 1 - Math.exp(-dt / 90);
    const d = this.targetY - this.y;
    this.y = Math.abs(d) < 0.4 ? this.targetY : this.y + d * k;
    const moving = Math.abs(d) >= 0.4;
    if (moving) this.settle = 60;
    else this.settle--;

    const { i, p } = this.locate(this.y);
    const ch = CHAPTERS[i];
    const frame = lerp(ch.frames[0], ch.frames[1], p);
    const cam = this.camFor(layout, i, p, frame);
    const head = toScreen(cam, headAt(frame), layout.vp.mode === "stack" ? 10 : 18);
    const fb = frameAt(frame).f;
    const face = toScreen(cam, [fb[0] - fb[2] * 0.12, fb[1], fb[0] + fb[2], fb[1] + fb[3]], 14);

    if (i !== this.coarse.chapter) {
      this.coarse = { ...this.coarse, chapter: i };
      this.emitCoarse();
    }

    const starts = this.starts, lens = this.lens, y = this.y;
    const tick: Tick = {
      y,
      frame,
      chapter: i,
      progress: p,
      progressOf: (id) => {
        const j = CHAPTERS.findIndex((c) => c.id === id);
        return (y - starts[j]) / lens[j];
      },
      cam,
      head,
      face,
      layout,
      time: t,
      moving,
    };
    this.lastTick = tick;
    this.listeners.forEach((l) => l(tick));
    this.runGuards(head, face);
  };

  /** Face guard: any registered element overlapping the protected head rect fades and slides away. */
  private runGuards(headRect: Rect, faceRect: Rect) {
    // Guarded elements are fixed chrome: their boxes only move on resize, so measure
    // them once instead of forcing a layout read on every frame.
    if (this.guardRectsStale) {
      this.guards.forEach((s, el) => (s.rect = el.getBoundingClientRect()));
      this.guardRectsStale = false;
    }
    this.guards.forEach((s, el) => {
      const head = s.level === "face" ? faceRect : headRect;
      const hx1 = head.x + head.w, hy1 = head.y + head.h;
      const hcx = head.x + head.w / 2;
      const r = s.rect!;
      let target = 0;
      if (r.width > 0 && r.height > 0) {
        const ix = Math.max(0, Math.min(r.right, hx1) - Math.max(r.left, head.x));
        const iy = Math.max(0, Math.min(r.bottom, hy1) - Math.max(r.top, head.y));
        const inter = ix * iy;
        if (inter > 0) {
          const denom = Math.min(r.width * r.height, head.w * head.h);
          target = clamp(0.35 + (inter / denom) * 4);
        }
      }
      const next = s.g + (target - s.g) * 0.22;
      const dir = r.left + r.width / 2 < hcx ? -1 : 1;
      if (Math.abs(next - s.g) > 0.001 || dir !== s.dir) {
        s.g = Math.abs(next) < 0.002 ? 0 : next;
        s.dir = dir;
        el.style.setProperty("--guard", s.g.toFixed(3));
        el.style.setProperty("--guard-dir", String(dir));
        el.dataset.guarded = s.g > 0.5 ? "1" : "0";
      }
    });
  }

  /** debug/testing: last computed tick */
  get snapshot() {
    return this.lastTick;
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }
}

let engine: Engine | null = null;
export function getEngine() {
  if (!engine) engine = new Engine();
  return engine;
}

export { VIDEO };
