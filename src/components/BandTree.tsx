"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, Cloud, Database, Server, Sparkles, type LucideIcon } from "lucide-react";
import { scrollToChapter, useCoarse, useTick } from "@/film/react";
import { clamp, ease } from "@/film/timeline";
import { capabilityGroups, languages } from "@/data/portfolio";

/* =====================================================================
   Band tree (fallback) — grows with the scroll inside the empty band under
   the chin (the zone is measured from the video, so it never reaches
   the face).

   root ── trunk ──●Intelligence──────●Services──────●Data──────●Cloud
                   │                  │              │          │
                   ├ chip chip chip   ├ chip chip    ├ …        ├ …
                   └ chip chip        └ chip …

   Scrolling grows the trunk left→right; as its tip reaches a category
   the node pops, its spine drops and the skills pop in one by one,
   packed row by row into the space that's left. Short bands (phones,
   720p) show one category at a time instead.
   ===================================================================== */

const ICONS: Record<string, LucideIcon> = { intelligence: Brain, interfaces: Server, data: Database, infra: Cloud };
const CHIP_H = 26;
const ROW_GAP = 7;
const COL_GAP = 6;
const PAD_X = 10;

type Leaf = { name: string; x: number; y: number; w: number; more?: boolean; rest?: string[] };
type Cat = {
  key: string;
  name: string;
  count: number;
  cx: number;
  labelX: number;
  leaves: Leaf[];
  spine: { x: number; y0: number; y1: number };
  stubs: { x0: number; x1: number; y: number }[];
  pop: number; // chapter progress at which the node appears
};
type Plan = { compact: boolean; W: number; H: number; R: number; trunkY: number; rootX: number; trunkEnd: number; leavesY: number; cats: Cat[] };

const TRUNK_A = 0.06;
const TRUNK_B = 0.6;
const CMP_A = 0.12; // compact: category windows start
const CMP_W = 0.2;

function pack(items: string[], x0: number, x1: number, y0: number, y1: number, measure: (s: string) => number) {
  const leaves: Leaf[] = [];
  const rows: number[] = [];
  let x = x0, y = y0, row = 0;
  for (let i = 0; i < items.length; i++) {
    const w = measure(items[i]);
    if (x + w > x1 && x > x0) {
      row++;
      x = x0;
      y += CHIP_H + ROW_GAP;
    }
    if (y + CHIP_H > y1) {
      // out of room: turn the last chip into "+N"
      const rest = items.length - i + 1;
      const last = leaves.pop();
      if (last) leaves.push({ name: `+${rest}`, x: last.x, y: last.y, w: measure(`+${rest}`), more: true, rest: items.slice(i - 1) });
      break;
    }
    leaves.push({ name: items[i], x, y, w });
    rows[row] = y;
    x += w + COL_GAP;
  }
  return { leaves, rows: rows.filter((r) => r !== undefined) };
}

function plan(W: number, H: number, compact: boolean, measure: (s: string) => number): Plan {
  const n = capabilityGroups.length;
  if (!compact) {
    const R = 17;
    const trunkY = 52;
    const rootX = R + 1;
    const start = 74;
    const sw = (W - start) / n;
    const leavesY = trunkY + R + 16;
    const cats: Cat[] = capabilityGroups.map((g, k) => {
      const cx = start + k * sw + R;
      const x0 = cx + 14;
      const x1 = start + (k + 1) * sw - 22;
      const { leaves, rows } = pack(g.items, x0, x1, leavesY, H - 2, measure);
      const lastY = rows.length ? rows[rows.length - 1] + CHIP_H / 2 : leavesY;
      return {
        key: g.key,
        name: g.name,
        count: g.items.length,
        cx,
        labelX: cx + R + 8,
        leaves,
        spine: { x: cx, y0: trunkY + R, y1: lastY },
        stubs: rows.map((y) => ({ x0: cx, x1: x0 - 2, y: y + CHIP_H / 2 })),
        pop: 0,
      };
    });
    const trunkEnd = cats[n - 1].cx;
    cats.forEach((c) => (c.pop = TRUNK_A + (TRUNK_B - TRUNK_A) * ((c.cx - R - rootX) / (trunkEnd - rootX))));
    return { compact, W, H, R, trunkY, rootX, trunkEnd, leavesY, cats };
  }
  // compact: nodes in a row, one category's skills at a time underneath
  const R = 14;
  const trunkY = R + 2;
  const rootX = R;
  const first = 58;
  const step = (W - first - R - 2) / (n - 1);
  const leavesY = trunkY + R + 48;
  const cats: Cat[] = capabilityGroups.map((g, k) => {
    const cx = first + k * step;
    const { leaves, rows } = pack(g.items, PAD_X, W - 2, leavesY, H - 2, measure);
    return {
      key: g.key,
      name: g.name,
      count: g.items.length,
      cx,
      labelX: 0,
      leaves,
      spine: { x: cx, y0: trunkY + R, y1: leavesY - 8 },
      stubs: rows.length ? [{ x0: Math.min(cx, PAD_X), x1: Math.max(cx, W - 8), y: leavesY - 8 }] : [],
      pop: CMP_A + k * CMP_W,
    };
  });
  return { compact, W, H, R, trunkY, rootX, trunkEnd: cats[n - 1].cx, leavesY, cats };
}

/** Band-only tree: used on phones and short screens where the left column has no room. */
export function BandTree() {
  const { layout } = useCoarse();
  const zone = layout?.zones.signal;
  // the full tree needs ~4 rows of chips under the trunk; below that, page one category at a time
  const compact = layout?.vp.mode === "stack" || (zone ? zone.w < 900 || zone.h < 200 : false);
  const [fontsReady, setFontsReady] = useState(0);
  const [hl, setHl] = useState<number | null>(null);
  useEffect(() => {
    document.fonts?.ready.then(() => setFontsReady((v) => v + 1));
  }, []);

  const p = useMemo(() => {
    if (!zone) return null;
    const ctx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
    const family = typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "sans-serif";
    if (ctx) ctx.font = `500 12px ${family}`;
    const measure = (s: string) => Math.ceil((ctx ? ctx.measureText(s).width : s.length * 6.6) + 22);
    return plan(zone.w, zone.h, compact, measure);
    // fontsReady: re-measure once webfonts are in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.w, zone?.h, compact, fontsReady]);

  /* ---------------- scroll-driven growth (imperative, cached) ---------------- */
  const trunk = useRef<SVGLineElement>(null);
  const pulse = useRef<HTMLDivElement>(null);
  const nodes = useRef<(HTMLElement | null)[]>([]);
  const spines = useRef<(SVGGElement | null)[]>([]);
  const leaves = useRef<(HTMLElement | null)[][]>([]);
  const titles = useRef<(HTMLElement | null)[]>([]);
  const cache = useRef(new Map<Element, string>());
  const set = (el: Element | null | undefined, v: string, apply: (el: HTMLElement | SVGElement) => void) => {
    if (!el || cache.current.get(el) === v) return;
    cache.current.set(el, v);
    apply(el as HTMLElement);
  };
  useEffect(() => cache.current.clear(), [p]);

  useTick((t) => {
    if (!p) return;
    const pr = t.progressOf("signal");
    const len = p.trunkEnd - p.rootX;
    const g = p.compact ? ease(0.03, 0.1, pr) : ease(TRUNK_A, TRUNK_B, pr);
    set(trunk.current, g.toFixed(3), (el) => el.setAttribute("stroke-dashoffset", (len * (1 - g)).toFixed(1)));
    set(pulse.current, g.toFixed(3), (el) => ((el as HTMLElement).style.clipPath = `inset(0 ${((1 - g) * 100).toFixed(2)}% 0 0)`));
    const active = p.compact ? clamp(Math.floor((pr - CMP_A) / CMP_W), 0, p.cats.length - 1) : -1;

    p.cats.forEach((c, k) => {
      // node
      const nodeIn = p.compact ? ease(0.05 + k * 0.015, 0.09 + k * 0.015, pr) : ease(c.pop - 0.01, c.pop + 0.03, pr);
      const on = p.compact ? (k === active ? 1 : 0) : nodeIn;
      set(nodes.current[k], `${nodeIn.toFixed(3)}|${on}`, (el) => {
        el.style.opacity = String(0.25 + nodeIn * 0.75);
        el.style.transform = `translate(-50%,-50%) scale(${(0.4 + nodeIn * 0.6).toFixed(3)})`;
        (el as HTMLElement).dataset.on = p.compact ? (k === active ? "1" : "0") : nodeIn > 0.95 ? "1" : "0";
      });
      // category window for compact paging
      const a = c.pop;
      const out = p.compact && k < p.cats.length - 1 ? ease(a + CMP_W - 0.02, a + CMP_W, pr) : 0;
      const base = p.compact ? a + 0.005 : c.pop + 0.03;
      const sp = ease(base, base + 0.05, pr) * (1 - out);
      set(spines.current[k], sp.toFixed(3), (el) => ((el as SVGElement).style.opacity = sp.toFixed(3)));
      set(titles.current[k], (p.compact ? sp : nodeIn).toFixed(3), (el) => ((el as HTMLElement).style.opacity = (p.compact ? sp : nodeIn).toFixed(3)));
      // leaves pop one by one
      c.leaves.forEach((_, j) => {
        const s = base + 0.03 + j * (p.compact ? 0.007 : 0.011);
        const v = ease(s, s + 0.03, pr) * (1 - out);
        set(leaves.current[k]?.[j], v.toFixed(3), (el) => {
          el.style.opacity = v.toFixed(3);
          el.style.transform = `translate3d(0,${((1 - v) * 8).toFixed(1)}px,0) scale(${(0.86 + v * 0.14).toFixed(3)})`;
          (el as HTMLElement).style.visibility = v < 0.01 ? "hidden" : "visible";
        });
      });
    });
  });

  if (!p) return null;
  const len = p.trunkEnd - p.rootX;
  const stroke = "rgba(111,168,255,.55)";

  return (
    <div
      className="skilltree relative"
      style={{ width: p.W, height: p.H }}
      data-hl={hl ?? ""}
      onMouseLeave={() => setHl(null)}
    >
      {/* traces */}
      <svg className="absolute inset-0 overflow-visible pointer-events-none" width={p.W} height={p.H} aria-hidden>
        <defs>
          <linearGradient id="trunkGrad" gradientUnits="userSpaceOnUse" x1={p.rootX} x2={p.trunkEnd} y1={0} y2={0}>
            <stop offset="0" stopColor="rgba(111,168,255,.5)" />
            <stop offset="1" stopColor="rgba(111,168,255,.75)" />
          </linearGradient>
        </defs>
        <line
          ref={trunk}
          x1={p.rootX}
          y1={p.trunkY}
          x2={p.trunkEnd}
          y2={p.trunkY}
          stroke="url(#trunkGrad)"
          strokeWidth={1.25}
          strokeDasharray={len}
          strokeDashoffset={len}
        />
        {p.cats.map((c, k) => (
          <g key={c.key} ref={(el) => { spines.current[k] = el; }} className="st-branch" data-k={k} style={{ opacity: 0 }}>
            <line x1={c.spine.x} y1={c.spine.y0} x2={c.spine.x} y2={c.spine.y1} stroke={stroke} strokeWidth={1} />
            {c.stubs.map((s, i) => (
              <g key={i}>
                <line x1={s.x0} y1={s.y} x2={s.x1} y2={s.y} stroke={stroke} strokeWidth={1} />
                {!p.compact && <circle cx={s.x0} cy={s.y} r={2} fill="#6fa8ff" />}
              </g>
            ))}
          </g>
        ))}
      </svg>

      {/* a light pulse travels the grown part of the trunk, like the streaks in the film */}
      <div ref={pulse} className="absolute pointer-events-none" style={{ left: p.rootX, top: p.trunkY - 2, width: len, height: 4, clipPath: "inset(0 100% 0 0)" }} aria-hidden>
        <div className="st-pulse" style={{ ["--len" as string]: `${len}px` }} />
      </div>

      {/* root */}
      <div className="st-node st-node--root" style={{ left: p.rootX, top: p.trunkY, width: p.R * 2, height: p.R * 2 }} data-on="1" aria-hidden>
        <Sparkles size={p.compact ? 13 : 15} />
      </div>
      {!p.compact && (
        <>
          <p className="label absolute" style={{ left: 0, top: 0 }}>
            Capabilities
          </p>
          {p.W > 1100 && (
            <p className="label absolute !text-bone-3 text-right" style={{ right: 0, top: 0 }}>
              Languages · <span className="text-bone-2">{languages.join(" · ")}</span>
            </p>
          )}
        </>
      )}

      {/* categories */}
      {p.cats.map((c, k) => {
        const Icon = ICONS[c.key] ?? Brain;
        return (
          <div key={c.key}>
            <button
              ref={(el) => { nodes.current[k] = el; }}
              className="st-node"
              style={{ left: c.cx, top: p.trunkY, width: p.R * 2, height: p.R * 2, opacity: 0 }}
              onMouseEnter={() => setHl(k)}
              onFocus={() => setHl(k)}
              onClick={() => scrollToChapter("signal", p.compact ? c.pop + 0.1 : Math.min(0.86, c.pop + 0.22))}
              aria-label={`${c.name}: ${c.count} skills`}
            >
              <Icon size={p.compact ? 13 : 15} />
            </button>
            {p.compact ? (
              <p
                ref={(el) => { titles.current[k] = el; }}
                className="absolute flex items-baseline gap-2 pointer-events-none"
                style={{ left: 0, top: p.trunkY + p.R + 12, opacity: 0 }}
              >
                <span className="head text-[20px] !font-semibold">{c.name}</span>
                <span className="label !text-bone-3">{c.count} skills</span>
              </p>
            ) : (
              <button
                ref={(el) => { titles.current[k] = el; }}
                className="st-label"
                style={{ left: c.labelX, top: p.trunkY - 13, opacity: 0 }}
                onMouseEnter={() => setHl(k)}
                onClick={() => scrollToChapter("signal", Math.min(0.86, c.pop + 0.22))}
                tabIndex={-1}
              >
                {c.name} <span className="text-bone-3 ml-1 tabular-nums">{c.count}</span>
              </button>
            )}
            {c.leaves.map((l, j) => (
              <span
                key={l.name}
                ref={(el) => {
                  (leaves.current[k] ??= [])[j] = el;
                }}
                className={`st-leaf shine ${l.more ? "st-leaf--more" : ""}`}
                data-k={k}
                style={{ left: l.x, top: l.y, width: l.w, height: CHIP_H, opacity: 0, visibility: "hidden", ["--d" as string]: `${(k * 0.35 + j * 0.09).toFixed(2)}s` }}
                onMouseEnter={() => setHl(k)}
                title={l.rest?.join(" · ")}
              >
                {l.name}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
