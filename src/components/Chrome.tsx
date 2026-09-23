"use client";

import { useEffect, useRef, useState } from "react";
import { CHAPTERS, VIDEO } from "@/film/timeline";
import { Guard, chapterVis, scrollToChapter, useCoarse, useLayoutState, useTick } from "@/film/react";
import { onLoadProgress } from "@/film/FilmCanvas";
import { contact, identity } from "@/data/portfolio";
import { Wordmark3D } from "./Chapters";

/* ------------------------------------------------------------------ */
/* Top bar — name + availability pill left, menu pill right            */
/* Guarded against the FACE only (it may sit over hair at the top).    */
/* ------------------------------------------------------------------ */
export function TopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-20 pointer-events-none">
      <div className="flex items-center justify-between px-5 pt-5 md:px-[clamp(20px,6vw,110px)] md:pt-6">
        <Guard level="face" className="pointer-events-auto">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <button onClick={() => scrollToChapter("still", 0)} className="brand text-[15px] sm:text-[17px] md:text-[19px]" aria-label="Back to top">
              {identity.first.toUpperCase()}
              <sup className="text-[0.5em] font-normal ml-0.5">®</sup>
            </button>
            <span className="pill !h-7 !px-2.5 !gap-2 !text-[11.5px] sm:!h-8 sm:!px-3.5 sm:!text-[12.5px]">
              <span className="dot" /> Available
            </span>
          </div>
        </Guard>
        <Guard level="face" className="pointer-events-auto">
          <button onClick={onMenu} className="btn !h-12 md:!h-14 !px-6 md:!px-7" aria-haspopup="dialog">
            Menu
            <svg width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M0 1h22M0 7h22M0 13h22" />
            </svg>
          </button>
        </Guard>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Scrims — legibility gradients that follow each chapter's zone       */
/* ------------------------------------------------------------------ */
export function Scrims() {
  const band = useRef<HTMLDivElement>(null);
  const r = useRef<HTMLDivElement>(null);
  const l = useRef<HTMLDivElement>(null);
  const layout = useLayoutState();
  const last = useRef("");
  useTick((t) => {
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
    const bandY = bw > 0 ? (by / bw).toFixed(0) : "";
    const key = `${vb.toFixed(3)}|${vr.toFixed(3)}|${vl.toFixed(3)}|${bandY}`;
    if (key === last.current) return; // don't repaint full-screen gradients unless something changed
    last.current = key;
    if (band.current) {
      band.current.style.opacity = vb.toFixed(3);
      if (bandY) band.current.style.setProperty("--band-y", `${bandY}px`);
    }
    if (r.current) r.current.style.opacity = vr.toFixed(3);
    if (l.current) l.current.style.opacity = vl.toFixed(3);
  });
  return (
    <>
      <div ref={band} className="scrim scrim--band" style={{ ["--band-y" as string]: `${layout?.zones.still.y ?? 600}px` }} />
      <div ref={r} className="scrim scrim--right" />
      <div ref={l} className="scrim scrim--left" />
      <div className="scrim scrim--vignette" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Menu — full-height sheet from the right                             */
/* ------------------------------------------------------------------ */
export function Menu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const { chapter } = useCoarse();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <div className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open} inert={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/40 transition-opacity duration-700 ${open ? "opacity-100" : "opacity-0"}`} />
      <div
        ref={panel}
        role="dialog"
        aria-label="Menu"
        className="absolute right-0 top-0 bottom-0 w-full sm:w-[460px] bg-[#0b0b0e]/[.97] border-l border-[var(--line)] flex flex-col"
        style={{ clipPath: open ? "inset(0 0 0 0)" : "inset(0 0 0 100%)", transition: "clip-path .9s var(--ease-film)" }}
      >
        <div className="flex items-center justify-between px-6 pt-6 md:px-8">
          <span className="label">Menu</span>
          <button onClick={onClose} className="btn btn--sm">Close</button>
        </div>
        <ol className="mt-10 flex-1 px-6 md:px-8">
          {CHAPTERS.map((c, i) => (
            <li key={c.id}>
              <button
                onClick={() => {
                  onClose();
                  scrollToChapter(c.id);
                }}
                className="group flex w-full items-baseline justify-between border-b border-[var(--line)] py-5 text-left"
              >
                <span className={`head text-[40px] transition-transform duration-700 group-hover:translate-x-2 ${chapter === i ? "text-white" : "text-white/55 group-hover:text-white"}`}>
                  {c.scene}
                </span>
                <span className="label !text-bone-3">0{i + 1}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="px-6 pb-8 md:px-8 space-y-4">
          <a href={`mailto:${contact.email}`} className="head text-[26px] link-u">{contact.email}</a>
          <div className="flex gap-5 text-[14px] text-bone-2">
            {contact.links.map((l) => (
              <a key={l.label} href={l.href} className="link-u hover:text-white">{l.label}</a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loader — the name decodes in dot-matrix while frames load, turns    */
/* into the solid chrome wordmark, then flies into its hero position    */
/* as the screen splits open along a streak of light.                   */
/* ------------------------------------------------------------------ */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/";
const NAME = identity.first.toUpperCase();
type Phase = "decode" | "solid" | "fly" | "done";

export function Loader() {
  const [ratio, setRatio] = useState(0);
  const [phase, setPhase] = useState<Phase>("decode");
  const [chars, setChars] = useState<string[]>(() => NAME.split("").map(() => "·"));
  const [locked, setLocked] = useState(0);
  const fly = useRef<HTMLDivElement>(null);
  const dots = useRef<HTMLParagraphElement>(null);
  const ratioRef = useRef(0);
  const fontsRef = useRef(false);
  const READY = 14 / VIDEO.count;

  useEffect(() => onLoadProgress((r) => { ratioRef.current = r; setRatio(r); }), []);
  // the hero wordmark is fitted with the real font — measuring before it arrives made the
  // flight land where the fallback font put the name, then the name jumped
  useEffect(() => {
    document.fonts?.ready.then(() => (fontsRef.current = true)).catch(() => (fontsRef.current = true));
    if (!document.fonts) fontsRef.current = true;
  }, []);

  /**
   * Place the flying wordmark so the centre of its visible word sits at (cx, cy), at scale s.
   * transform-origin is the word's own centre, so scaling never shifts it.
   */
  const place = (cx: number, cy: number, s: number) => {
    const el = fly.current;
    const w = el?.querySelector<HTMLElement>(".wm3d-wrap");
    if (!el || !w) return "";
    const ox = w.offsetLeft + w.offsetWidth / 2;
    const oy = w.offsetTop + w.offsetHeight / 2;
    el.style.transformOrigin = `${ox}px ${oy}px`;
    const x = cx - innerWidth / 2 - ox + el.offsetWidth / 2;
    const y = cy - innerHeight / 2 - oy + el.offsetHeight / 2;
    return `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(4)})`;
  };

  // decode: unlocked letters cycle glyphs; letters lock left→right on a steady beat,
  // never ahead of loading (or the fonts) — but never wait forever either (8s cap)
  useEffect(() => {
    if (phase !== "decode") return;
    const t0 = performance.now();
    let lockedN = 0;
    const id = setInterval(() => {
      const elapsed = performance.now() - t0;
      const capped = elapsed > 8000;
      const byTime = Math.floor((elapsed - 250) / 110);
      const loaded = Math.min(1, ratioRef.current / READY);
      const byLoad = capped ? NAME.length : Math.floor(NAME.length * loaded + 0.001);
      // hold the last letter until the fonts are in
      const byFont = capped || fontsRef.current ? NAME.length : NAME.length - 1;
      lockedN = Math.max(lockedN, Math.min(byTime, byLoad, byFont, NAME.length));
      setLocked(lockedN);
      setChars(NAME.split("").map((c, i) => (i < lockedN ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])));
      if (lockedN >= NAME.length) {
        clearInterval(id);
        const target = document.querySelector<HTMLElement>("[data-wordmark-target]");
        const el = fly.current;
        const d = dots.current?.getBoundingClientRect();
        if (target && el && d) {
          // same font size as the hero (the flight is then a clean move), shown at the dot word's width
          el.style.fontSize = getComputedStyle(target).fontSize;
          const w = el.querySelector<HTMLElement>(".wm3d-wrap");
          const s0 = w ? Math.min(1.6, Math.max(0.45, d.width / w.offsetWidth)) : 1;
          el.dataset.s0 = String(s0);
          el.style.transition = "none";
          el.style.transform = place(d.left + d.width / 2, d.top + d.height / 2, s0 * 0.94);
          void el.offsetWidth;
          el.style.transition = "";
          el.dataset.cx = String(d.left + d.width / 2);
          el.dataset.cy = String(d.top + d.height / 2);
        }
        setTimeout(() => setPhase("solid"), 120);
      }
    }, 40);
    return () => clearInterval(id);
  }, [phase, READY]);

  useEffect(() => {
    const el = fly.current;
    if (phase === "solid") {
      // the chrome word forms exactly where the dot word was
      if (el?.dataset.cx) el.style.transform = place(+el.dataset.cx, +el.dataset.cy!, +(el.dataset.s0 ?? 1));
      const t = setTimeout(() => setPhase("fly"), 650);
      return () => clearTimeout(t);
    }
    if (phase !== "fly") return;
    const target = document.querySelector<HTMLElement>("[data-wordmark-target] .wm3d-wrap");
    const finish = () => {
      document.documentElement.classList.add("lifted");
      requestAnimationFrame(() => setPhase("done"));
    };
    const w = el?.querySelector<HTMLElement>(".wm3d-wrap");
    if (!el || !w || !target || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(finish, 600);
      return () => clearTimeout(t);
    }
    // one compositor-driven flight (Web Animations) onto the hero word's centre, in step with the split
    const b = target.getBoundingClientRect();
    const from = el.style.transform || getComputedStyle(el).transform;
    const to = place(b.left + b.width / 2, b.top + b.height / 2, b.width / w.offsetWidth);
    const anim = el.animate([{ transform: from }, { transform: to }], {
      duration: 1000,
      easing: "cubic-bezier(0.65, 0, 0.2, 1)",
      fill: "forwards",
    });
    anim.onfinish = finish;
    return () => anim.cancel();
  }, [phase]);

  if (phase === "done") return null;
  const pct = String(Math.round(Math.min(1, ratio / READY) * 100)).padStart(3, "0");
  return (
    <div className="loader" data-phase={phase} aria-hidden>
      <div className="loader__half loader__half--top" />
      <div className="loader__half loader__half--bottom" />
      <div className="loader__seam" />
      <div className="loader__center">
        <p ref={dots} className="loader__dots">
          {chars.map((c, i) => (
            <span key={i} data-lock={i < locked ? "1" : "0"}>{c}</span>
          ))}
        </p>
        <div className="loader__sub">
          <div className="loader__bar"><i style={{ transform: `scaleX(${Math.min(1, ratio / READY).toFixed(3)})` }} /></div>
          <p className="loader__meta">
            <span className="loader__role">AI · Full-stack engineer</span>
            <b className="tabular-nums">{pct}%</b>
            <span className="loader__reel">Reel {VIDEO.count} fr</span>
          </p>
        </div>
      </div>
      <div ref={fly} className="loader__fly" style={{ fontSize: 160 }}>
        <Wordmark3D text={NAME} />
      </div>
    </div>
  );
}
