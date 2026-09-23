"use client";

/**
 * Scroll dock — quick up/down section arrows on the right, around a scroll-progress pill.
 *
 * The progress pill is adapted from Rare UI's "Scroll Progress"
 * (https://rareui.com/components/scrollprogressindicator):
 * Copyright (c) 2026 Swami Malode — MIT + Commons Clause + Attribution.
 * Adapted to this site: the film is scroll-driven with virtual chapters (no DOM
 * sections), so progress/active section come from the film engine, the pill is a
 * ring that morphs to show the section name on hover, and it opens into the squircle
 * section menu anchored to the right edge.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CHAPTERS } from "@/film/timeline";
import { Guard, scrollToChapter, useCoarse, useTick } from "@/film/react";
import { getEngine } from "@/film/engine";

const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const SIZE_SPRING = { type: "spring", bounce: 0.16, duration: 0.5 } as const;
const LABEL_CROSSFADE = { duration: 0.22, ease: EASE_OUT } as const;
const LAYER_FADE = { duration: 0.24, ease: EASE_IN_OUT } as const;

type Size = { width: number; height: number };
const SQUIRCLE = "[corner-shape:squircle]";
const go = (i: number) => {
  const c = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, i))];
  scrollToChapter(c.id);
};

export default function ScrollDock() {
  const { layout, chapter } = useCoarse();
  const stack = layout?.vp.mode === "stack";
  const reduce = useReducedMotion();

  /* progress through the whole film, fed from the engine (window scroll is virtual chapters) */
  const raw = useMotionValue(0);
  const progress = useSpring(raw, { stiffness: 120, damping: 30, mass: 0.3 });
  useTick((t) => {
    const max = getEngine().totalScroll; // the track ends with one extra screen, so max scrollY = total
    raw.set(max > 0 ? Math.min(1, Math.max(0, t.y / max)) : 0);
  });

  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const label = CHAPTERS[chapter]?.scene ?? "";

  /* measure the three surface states off-screen, like the original */
  const ring = stack ? 34 : 44;
  const labelRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [labelSize, setLabelSize] = useState<Size>();
  const [menuSize, setMenuSize] = useState<Size>();
  useLayoutEffect(() => {
    const measure = () => {
      if (labelRef.current) setLabelSize({ width: labelRef.current.offsetWidth, height: ring });
      if (menuRef.current) setMenuSize({ width: menuRef.current.offsetWidth, height: menuRef.current.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (labelRef.current) ro.observe(labelRef.current);
    if (menuRef.current) ro.observe(menuRef.current);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [ring, label]);

  // phones: sit in the top bar row, just left of the Menu button (the only strip the face never reaches)
  useLayoutEffect(() => {
    if (!stack) return;
    const menu = document.querySelector<HTMLElement>("header .menu-btn");
    const dock = root.current?.closest<HTMLElement>(".dock");
    if (!menu || !dock) return;
    const place = () => {
      const r = menu.getBoundingClientRect();
      dock.style.setProperty("--dock-right", `${Math.round(innerWidth - r.left + 8)}px`);
      dock.style.setProperty("--dock-top", `${Math.round(r.top + r.height / 2 - ring / 2)}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(menu);
    addEventListener("resize", place);
    return () => {
      ro.disconnect();
      removeEventListener("resize", place);
    };
  }, [stack, ring]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const showLabel = hover && !stack && !open;
  const size: Size = open && menuSize ? menuSize : showLabel && labelSize ? labelSize : { width: ring, height: ring };
  const radius = open ? 22 : ring / 2;
  const last = CHAPTERS.length - 1;
  const prev = CHAPTERS[chapter - 1];
  const next = CHAPTERS[chapter + 1];

  return (
    <Guard level="face" className={`dock ${stack ? "dock--stack" : ""}`}>
      <div ref={root} className="dock__rail" data-open={open ? "" : undefined} style={{ ["--ring" as string]: `${ring}px` }}>
        {/* aria-disabled, not disabled: disabling the focused button mid-scroll cancels the smooth scroll on phones */}
        <button
          type="button"
          className="dock__btn"
          onClick={() => chapter > 0 && go(chapter - 1)}
          aria-disabled={chapter === 0}
          aria-label={prev ? `Previous section: ${prev.scene}` : "At the top"}
          title={prev ? prev.scene : undefined}
        >
          <ChevronUp size={18} strokeWidth={2} />
        </button>

        {/* the pill: a slot the size of the ring; the surface grows out of it to the left.
            Phones: the Menu button carries the progress ring instead (no room beside the face). */}
        <div className="dock__slot" hidden={stack}>
          {/* hidden measurers */}
          <div className="pointer-events-none invisible absolute" aria-hidden>
            <div ref={labelRef} className="inline-flex items-center gap-2.5 pl-3 pr-[11px] whitespace-nowrap text-[13px] font-medium" style={{ height: ring }}>
              <span>{label}</span>
              <span style={{ width: 22 }} />
            </div>
            <div ref={menuRef} className="w-max p-1.5">
              {CHAPTERS.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-[13.5px] font-medium leading-none">
                  <span className="w-[18px]" />
                  <span className="whitespace-nowrap">{c.scene}</span>
                  <span className="w-3" />
                </div>
              ))}
            </div>
          </div>

          <motion.div
            className={`dock__surface ${SQUIRCLE}`}
            initial={false}
            animate={{ width: size.width, height: size.height, borderRadius: radius }}
            transition={reduce ? { duration: 0 } : SIZE_SPRING}
            onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
            onPointerLeave={() => setHover(false)}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {open ? (
                <motion.ul
                  key="list"
                  className="absolute inset-0 flex flex-col p-1.5"
                  initial={{ opacity: 0, filter: reduce ? undefined : "blur(4px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: reduce ? undefined : "blur(4px)" }}
                  transition={LAYER_FADE}
                >
                  {CHAPTERS.map((c, i) => {
                    const active = i === chapter;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            go(i);
                          }}
                          className={`relative flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-[13.5px] font-medium leading-none transition-colors ${SQUIRCLE} ${
                            active ? "text-white" : "text-white/55 hover:text-white/85"
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="dock-active"
                              className={`absolute inset-0 rounded-[14px] bg-white/10 ${SQUIRCLE}`}
                              transition={reduce ? { duration: 0 } : SIZE_SPRING}
                            />
                          )}
                          <motion.span
                            className="relative w-[18px] shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--signal-hi)]"
                            initial={reduce ? undefined : { opacity: 0, y: 4, filter: "blur(3px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            transition={{ duration: 0.3, ease: EASE_IN_OUT, delay: reduce ? 0 : 0.04 + i * 0.03 }}
                          >
                            {String(i + 1).padStart(2, "0")}
                          </motion.span>
                          <motion.span
                            className="relative whitespace-nowrap"
                            initial={reduce ? undefined : { opacity: 0, y: 4, filter: "blur(3px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            transition={{ duration: 0.3, ease: EASE_IN_OUT, delay: reduce ? 0 : 0.04 + i * 0.03 }}
                          >
                            {c.scene}
                          </motion.span>
                          <span className={`relative ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-white" : "bg-white/25"}`} />
                        </button>
                      </li>
                    );
                  })}
                </motion.ul>
              ) : (
                <motion.button
                  key="pill"
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label={`Sections — now: ${label}`}
                  aria-haspopup="menu"
                  className="absolute inset-0 flex items-center justify-end"
                  initial={{ opacity: 0, filter: reduce ? undefined : "blur(4px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: reduce ? undefined : "blur(4px)" }}
                  transition={LAYER_FADE}
                >
                  <AnimatePresence initial={false}>
                    {showLabel && (
                      <motion.span
                        key={label}
                        className="absolute left-3 whitespace-nowrap text-[13px] font-medium text-white"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(1.5px)" }}
                        animate={{ opacity: 1, filter: "blur(0px)" }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(1.5px)" }}
                        transition={LABEL_CROSSFADE}
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <span className="relative grid shrink-0 place-items-center" style={{ width: ring, height: ring }}>
                    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] -rotate-90" aria-hidden>
                      <circle cx="12" cy="12" r="10" fill="none" strokeWidth="2.2" className="stroke-white/15" />
                      <motion.circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        className="stroke-[var(--signal-hi)]"
                        style={{ pathLength: progress }}
                      />
                    </svg>
                    <span className="absolute font-mono text-[8.5px] tabular-nums text-white/70">{String(chapter + 1).padStart(2, "0")}</span>
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        <button
          type="button"
          className="dock__btn"
          onClick={() => chapter < last && go(chapter + 1)}
          aria-disabled={chapter === last}
          aria-label={next ? `Next section: ${next.scene}` : "At the end"}
          title={next ? next.scene : undefined}
        >
          <ChevronDown size={18} strokeWidth={2} />
        </button>
      </div>
    </Guard>
  );
}
