"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { projects } from "@/data/portfolio";

const noop = () => () => {};

/**
 * Project details — opens when a work card is tapped.
 *  phones  : a bottom sheet that rises over the film (swipe down / tap outside to close)
 *  desktop : a panel that wipes in from the left, on the side away from his face
 * Content cascades in, and prev/next flips between projects without closing.
 */
export default function ProjectSheet({
  index,
  onClose,
  onIndex,
}: {
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const open = index !== null;
  const [shown, setShown] = useState(0); // last opened project stays rendered while the sheet closes
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const n = projects.length;

  if (open && index !== shown) setShown(index);

  // lock the page (the film is scroll-driven) and wire Escape / arrows while open
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex(Math.min(n - 1, (index ?? 0) + 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(0, (index ?? 0) - 1));
    };
    // iOS ignores overflow:hidden for touch — stop touch scrolling outside the sheet's own body
    const touch = (e: TouchEvent) => {
      if (!body.current?.contains(e.target as Node)) e.preventDefault();
    };
    window.addEventListener("keydown", key);
    document.addEventListener("touchmove", touch, { passive: false });
    panel.current?.querySelector<HTMLElement>("[data-close]")?.focus({ preventScroll: true });
    return () => {
      root.style.overflow = prev;
      window.removeEventListener("keydown", key);
      document.removeEventListener("touchmove", touch);
    };
  }, [open, index, n, onClose, onIndex]);

  // restart the cascade whenever the project changes
  useEffect(() => {
    const el = body.current;
    if (!el || !open) return;
    el.classList.remove("ps-play");
    void el.offsetWidth;
    el.classList.add("ps-play");
    el.scrollTop = 0;
  }, [shown, open]);

  /* swipe-down to close (phones) */
  const down = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    drag.current = { y: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !panel.current) return;
    d.dy = Math.max(0, e.clientY - d.y);
    panel.current.style.transition = "none";
    panel.current.style.transform = `translate3d(0,${d.dy}px,0)`;
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !panel.current) return;
    panel.current.style.transition = "";
    panel.current.style.transform = "";
    if (d.dy > 90) onClose();
  };

  if (!mounted) return null;
  const pj = projects[shown];
  const num = (i: number) => String(i + 1).padStart(2, "0");
  const prevP = shown > 0 ? projects[shown - 1] : null;
  const nextP = shown < n - 1 ? projects[shown + 1] : null;

  return createPortal(
    <div className={`psheet ${open ? "is-open" : ""}`} aria-hidden={!open} inert={!open}>
      <div className="psheet__scrim" onClick={onClose} />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={`${pj.title} — project details`} className="psheet__panel">
        <div className="psheet__grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span className="psheet__handle" aria-hidden />
          <div className="flex items-center justify-between gap-3">
            <p className="label !text-signal-hi">
              {num(shown)}/{num(n - 1)} · {pj.industry.split(" / ")[0]}
            </p>
            <button data-close onClick={onClose} className="btn btn--sm !h-9 !w-9 !p-0" aria-label="Close details">
              <X size={16} />
            </button>
          </div>
        </div>

        <div ref={body} className="psheet__body">
          <h3 className="ps-r head text-[clamp(32px,4.2vw,54px)] !font-semibold !leading-[1]" style={{ ["--i" as string]: 0 }}>
            {pj.title}
          </h3>
          <p className="ps-r body mt-6 !text-[15.5px] !leading-[1.6] text-bone" style={{ ["--i" as string]: 1 }}>
            {pj.overview}
          </p>

          <dl className="ps-r psheet__facts" style={{ ["--i" as string]: 2 }}>
            <div>
              <dt className="label">Industry</dt>
              <dd>{pj.industry}</dd>
            </div>
            <div>
              <dt className="label">Role</dt>
              <dd>{pj.role}</dd>
            </div>
          </dl>

          <p className="ps-r label mt-7" style={{ ["--i" as string]: 3 }}>Built with</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {pj.techStack.map((s, k) => (
              <li key={s} className="ps-chip chip" style={{ ["--i" as string]: 4 + k * 0.4 }}>
                {s}
              </li>
            ))}
          </ul>
        </div>

        <span className="psheet__num" aria-hidden>{num(shown)}</span>
        <div className="psheet__foot">
          <button onClick={() => prevP && onIndex(shown - 1)} disabled={!prevP} className="psheet__nav" aria-label="Previous project">
            <ArrowLeft size={15} />
            <span className="truncate">{prevP ? prevP.title : "—"}</span>
          </button>
          <button onClick={() => nextP && onIndex(shown + 1)} disabled={!nextP} className="psheet__nav psheet__nav--next" aria-label="Next project">
            <span className="truncate">{nextP ? nextP.title : "—"}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
