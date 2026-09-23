"use client";

import { useEffect, useRef, useState } from "react";
import { CHAPTERS, VIDEO } from "@/film/timeline";
import { Guard, chapterVis, scrollToChapter, useCoarse, useLayoutState, useTick } from "@/film/react";
import { onLoadProgress } from "@/film/FilmCanvas";
import { contact, identity } from "@/data/portfolio";

/* ------------------------------------------------------------------ */
/* Top bar — name + availability pill left, menu pill right            */
/* Guarded against the FACE only (it may sit over hair at the top).    */
/* ------------------------------------------------------------------ */
export function TopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-20 pointer-events-none">
      <div className="flex items-center justify-between px-5 pt-5 md:px-[clamp(20px,6vw,110px)] md:pt-6">
        <Guard level="face" className="pointer-events-auto">
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => scrollToChapter("still", 0)} className="head text-[20px] md:text-[24px]" aria-label="Back to top">
              {identity.first}
              <sup className="text-[0.5em] font-normal ml-0.5">®</sup>
            </button>
            <span className="pill !h-8 !px-3.5 !text-[12.5px]">
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
      <div className="grain" />
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
                  scrollToChapter(c.id, c.id === "still" ? 0 : undefined);
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
/* Loader — lifts once the first keyframes are decoded                 */
/* ------------------------------------------------------------------ */
export function Loader() {
  const [ratio, setRatio] = useState(0);
  const [gone, setGone] = useState(false);
  const [lift, setLift] = useState(false);
  useEffect(() => onLoadProgress(setRatio), []);
  const ready = ratio >= 14 / VIDEO.count;
  useEffect(() => {
    if (!ready || lift) return;
    const t1 = setTimeout(() => {
      setLift(true);
      document.documentElement.classList.add("lifted");
    }, 300);
    const t2 = setTimeout(() => setGone(true), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready, lift]);
  if (gone) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--void)] flex items-end"
      style={{ clipPath: lift ? "inset(0 0 100% 0)" : "inset(0 0 0 0)", transition: "clip-path 1.1s var(--ease-film)" }}
      aria-hidden
    >
      <div className="w-full px-6 pb-8 md:px-[clamp(20px,6vw,110px)] md:pb-12">
        <div className="flex items-end justify-between">
          <p className="wordmark text-[clamp(64px,14vw,220px)]">
            {identity.first}
            <sup>®</sup>
          </p>
          <p className="label tabular-nums">{String(Math.round(ratio * 100)).padStart(2, "0")}%</p>
        </div>
        <div className="mt-6 h-px w-full bg-white/10">
          <div className="h-px bg-[var(--signal-hi)] transition-[width] duration-300" style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
