"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, Cloud, Code2, Database, Server, Sparkles, type LucideIcon } from "lucide-react";
import { scrollToChapter, useCoarse, useTick } from "@/film/react";
import { CHAPTERS, VIDEO, clamp, ease } from "@/film/timeline";
import { EDGE, TOP_SAFE, type Layout } from "@/film/camera";
import { capabilityGroups, languages } from "@/data/portfolio";
import { BandTree } from "./BandTree";

/* =====================================================================
   Capability tree — an L-shaped tree that wraps the subject.

     ✦ Capabilities
     │
     ●─ Intelligence            (left column: the empty space in front
     │   ╰─ chip                 of his face, bounded by the widest
     │   ╰─ chip chip            head box across the chapter)
     │
     ╰──────●─ Services ──────────●─ Data ──────────●─ Cloud ────
             ╰─ chip chip          ╰─ chip chip       ╰─ chip …
                                   (band under the chin)

   The trunk grows with the scroll from the top-left, down the left
   side, round the corner and along the bottom. A glowing tip leads it.
   As the tip reaches a category the node pops with a ripple, curved
   branches unfurl and the skills fly out along them one by one.
   Every coordinate is measured from the film, so nothing touches the head.
   ===================================================================== */

const ICONS: Record<string, LucideIcon> = { intelligence: Brain, languages: Code2, interfaces: Server, data: Database, infra: Cloud };
// Tree order: the left column takes Intelligence (+ Languages when it fits), the bottom run takes the rest.
const GROUPS = [
  capabilityGroups[0],
  { key: "languages", name: "Languages", line: "", items: languages },
  ...capabilityGroups.slice(1),
];
const COL_GAP = 7;
const R = 19; // category node radius
const GROW_A = 0.05;
const GROW_B = 0.66;

type Leaf = { name: string; x: number; y: number; w: number; h: number; more?: boolean; rest?: string[]; row: number };
type Density = { h: number; gap: number };
// chip sizes, loosest first: the tree tightens up before it ever hides a skill behind "+N"
const DENSITIES: Density[] = [
  { h: 28, gap: 8 },
  { h: 26, gap: 6 },
  { h: 24, gap: 5 },
];
type Branch = { d: string; len: number };
type Cat = {
  key: string;
  name: string;
  count: number;
  x: number;
  y: number;
  s: number; // arc length along the trunk
  pop: number;
  seg: "v" | "h";
  leaves: Leaf[];
  branches: Branch[];
};
type LPlan = {
  W: number;
  H: number;
  seg: { x: number; y0: number; a: number; rad: number; b: number; c: number; y: number };
  path: string;
  L: number;
  at: (s: number) => [number, number];
  root: [number, number];
  cats: Cat[];
  hidden: number;
};

function pack(items: string[], x0: number, x1: number, y0: number, y1: number, measure: (s: string) => number, d: Density = DENSITIES[0]) {
  const leaves: Leaf[] = [];
  let x = x0, y = y0, row = 0;
  for (let i = 0; i < items.length; i++) {
    const w = Math.min(measure(items[i]), x1 - x0);
    if (x + w > x1 && x > x0) {
      row++;
      x = x0;
      y += d.h + d.gap;
    }
    if (y + d.h > y1) {
      const rest = items.length - i + 1;
      const last = leaves.pop();
      if (last) leaves.push({ ...last, name: `+${rest}`, w: measure(`+${rest}`), more: true, rest: items.slice(i - 1) });
      return { leaves, hidden: rest };
    }
    leaves.push({ name: items[i], x, y, w, h: d.h, row });
    x += w + COL_GAP;
  }
  return { leaves, hidden: 0 };
}

/** Curved branch from a trunk point to the left edge of a chip row. */
function branch(nx: number, ny: number, rx: number, ry: number): Branch {
  const d = `M ${nx} ${ny} C ${nx} ${ry}, ${nx + 6} ${ry}, ${rx} ${ry}`;
  const len = Math.abs(ry - ny) * 0.9 + Math.abs(rx - nx) + 8;
  return { d, len };
}

function planL(layout: Layout, measure: (s: string) => number): LPlan | null {
  const { vp } = layout;
  if (vp.mode === "stack") return null;
  const band = layout.zones.signal;
  const cam = layout.cams.signal;
  const ch = CHAPTERS.find((c) => c.id === "signal")!;
  const edge = EDGE(vp);
  const gap = Math.max(28, vp.w * 0.028);
  // widest the head reaches to the left during this chapter
  let bound = vp.w;
  for (let f = Math.max(0, ch.frames[0] - 4); f <= Math.min(VIDEO.count - 1, ch.frames[1] + 4); f++)
    bound = Math.min(bound, cam.ox + (VIDEO.frames[f].h[0] - 0.02) * cam.dw - gap);

  // hug the screen edge a little closer than the page margin: the column in front of his face is precious
  const trunkX = Math.max(26, edge * 0.5) + R;
  const y0 = TOP_SAFE + 14;
  const trunkY = band.y + 34;
  const rad = 46;
  const endX = vp.w - edge - 6;
  const colX0 = trunkX + 16;
  const colX1 = bound;
  const bandBottom = band.y + band.h - 2;
  if (colX1 - colX0 < 130 || trunkY - rad - y0 < 240 || band.h < 150) return null;

  const a = trunkY - rad - y0; // vertical length
  const b = (Math.PI * rad) / 2; // corner
  const c = endX - (trunkX + rad); // horizontal
  const L = a + b + c;
  const at = (s: number): [number, number] => {
    if (s <= a) return [trunkX, y0 + s];
    if (s <= a + b) {
      const th = Math.PI - ((s - a) / b) * (Math.PI / 2);
      return [trunkX + rad + rad * Math.cos(th), trunkY - rad + rad * Math.sin(th)];
    }
    return [trunkX + rad + (s - a - b), trunkY];
  };
  const path = `M ${trunkX} ${y0} L ${trunkX} ${trunkY - rad} A ${rad} ${rad} 0 0 0 ${trunkX + rad} ${trunkY} L ${endX} ${trunkY}`;

  const build = (kV: number, groups: typeof GROUPS, d: Density) => {
    const cats: Cat[] = [];
    let hidden = 0;
    // vertical categories: slots split by item count
    const vTop = y0 + 58;
    const vBottom = trunkY - 22; // chips may sit beside the corner curve (it bends away from them)
    // greedy: each category takes the room it needs, leaving at least a header + one row for the next
    const HEAD = R * 2 + 10;
    const ROW = d.h + d.gap;
    let slotTop = vTop;
    groups.slice(0, kV).forEach((g, i) => {
      const after = kV - 1 - i;
      const limit = vBottom - after * (HEAD + ROW + 18);
      const ny = slotTop + R;
      const rows0 = ny + R + 10;
      const { leaves, hidden: h } = pack(g.items, colX0 + 12, colX1, rows0, limit, measure, d);
      hidden += h;
      cats.push({ key: g.key, name: g.name, count: g.items.length, x: trunkX, y: ny, s: ny - y0, pop: 0, seg: "v", leaves, branches: [] });
      const used = leaves.length ? Math.max(...leaves.map((l) => l.y)) + d.h : rows0;
      slotTop = used + 26;
    });
    // justify the left column: share the leftover height between the gaps (half-weight at the ends)
    // so the categories sit evenly from the root down to the corner instead of bunching at the top
    const vCats = cats.filter((c) => c.seg === "v");
    if (vCats.length) {
      const slack = Math.max(0, vBottom - (slotTop - 26));
      const unit = slack / (vCats.length + 0.5);
      vCats.forEach((c, i) => {
        const dy = unit * (i + 0.5) * 0.9;
        c.y += dy;
        c.s += dy;
        c.leaves.forEach((l) => (l.y += dy));
      });
    }
    // horizontal categories: sub-rects along the bottom, width by item count
    const hG = groups.slice(kV);
    const hX0 = trunkX + rad + 34;
    const hItems = hG.reduce((s, g) => s + g.items.length, 0) || 1;
    let subX = hX0;
    hG.forEach((g) => {
      const subW = Math.max(220, (endX - hX0) * (0.5 / hG.length + 0.5 * (g.items.length / hItems)));
      const nx = subX + R;
      const { leaves, hidden: h } = pack(g.items, nx + 16, Math.min(endX, subX + subW - 18), trunkY + R + 14, bandBottom, measure, d);
      hidden += h;
      cats.push({ key: g.key, name: g.name, count: g.items.length, x: nx, y: trunkY, s: a + b + (nx - trunkX - rad), pop: 0, seg: "h", leaves, branches: [] });
      subX += subW;
    });
    return { cats, hidden };
  };

  // try: Intelligence + Languages on the left; Intelligence alone (Languages joins the bottom);
  // and without Languages if the bottom run can't hold five groups
  const noLang = GROUPS.filter((g) => g.key !== "languages");
  let best: { cats: Cat[]; hidden: number } | null = null;
  tiers: for (const d of DENSITIES) {
    for (const [kV, groups, penalty] of [[2, GROUPS, 0], [1, GROUPS, 0], [1, noLang, 9]] as const) {
      const r = build(kV, groups as typeof GROUPS, d);
      const score = r.hidden + penalty;
      if (!best || score < best.hidden) best = { cats: r.cats, hidden: score };
      if (score === 0) break tiers; // everything fits at this density
    }
  }
  // too cramped to show (almost) everything at once → the paged band tree shows every skill instead
  if (best!.hidden > 3) return null;
  const cats = best!.cats;
  cats.forEach((c) => {
    c.pop = GROW_A + (GROW_B - GROW_A) * (c.s / L);
    const rows = new Map<number, Leaf>();
    c.leaves.forEach((l) => !rows.has(l.row) && rows.set(l.row, l));
    c.branches = [...rows.values()].map((l) => branch(c.x, c.y + R * 0.6, l.x - 3, l.y + l.h / 2));
  });
  return { W: vp.w, H: vp.h, seg: { x: trunkX, y0, a, rad, b, c, y: trunkY }, path, L, at, root: [trunkX, y0], cats, hidden: best!.hidden };
}

const backOut = (t: number) => {
  const c1 = 1.5, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function LTree({ p }: { p: LPlan }) {
  const [hl, setHl] = useState<number | null>(null);
  const vLine = useRef<HTMLDivElement>(null);
  const hLine = useRef<HTMLDivElement>(null);
  const arc = useRef<SVGPathElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const pulses = useRef<HTMLDivElement>(null);
  const nodes = useRef<(HTMLElement | null)[]>([]);
  const labels = useRef<(HTMLElement | null)[]>([]);
  const branches = useRef<(SVGPathElement | null)[][]>([]);
  const leaves = useRef<(HTMLElement | null)[][]>([]);
  const cache = useRef(new Map<Element, string>());
  useEffect(() => cache.current.clear(), [p]);
  const set = (el: Element | null | undefined, key: string, apply: (el: HTMLElement) => void) => {
    if (!el || cache.current.get(el) === key) return;
    cache.current.set(el, key);
    apply(el as HTMLElement);
  };

  useTick((t) => {
    const pr = t.progressOf("signal");
    const g = ease(GROW_A, GROW_B, pr);
    // The trunk is three pieces so growth is compositor-only: the straight runs are
    // divs scaled with transforms (no repaint), only the small corner arc redraws.
    const len = g * p.L;
    const { a, b, c } = p.seg;
    const gv = clamp(len / a), gb = clamp((len - a) / b), gh = clamp((len - a - b) / c);
    set(vLine.current, gv.toFixed(4), (el) => (el.style.transform = `scaleY(${gv.toFixed(4)})`));
    set(arc.current, gb.toFixed(3), (el) => el.setAttribute("stroke-dashoffset", (b * (1 - gb)).toFixed(1)));
    set(hLine.current, gh.toFixed(4), (el) => (el.style.transform = `scaleX(${gh.toFixed(4)})`));
    // the growing tip: a bright bead leading the trunk
    const [tx, ty] = p.at(g * p.L);
    const tipOn = g > 0.001 && g < 0.999;
    set(tip.current, `${tx.toFixed(0)}|${ty.toFixed(0)}|${tipOn}`, (el) => {
      el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
      el.style.opacity = tipOn ? "1" : "0";
    });
    // once fully grown, light pulses keep travelling the trunk
    set(pulses.current, g >= 0.999 ? "1" : "0", (el) => (el.dataset.on = g >= 0.999 ? "1" : "0"));

    p.cats.forEach((c, k) => {
      const nodeIn = ease(c.pop - 0.012, c.pop + 0.028, pr);
      set(nodes.current[k], nodeIn.toFixed(3), (el) => {
        el.style.opacity = (nodeIn * 1).toFixed(3);
        el.style.transform = `translate(-50%,-50%) scale(${(0.3 + 0.7 * backOut(nodeIn)).toFixed(3)})`;
        el.dataset.on = nodeIn > 0.9 ? "1" : "0";
      });
      set(labels.current[k], nodeIn.toFixed(3), (el) => {
        el.style.opacity = nodeIn.toFixed(3);
        el.style.transform = `translate3d(${((1 - nodeIn) * -14).toFixed(1)}px, -50%, 0)`;
      });
      c.branches.forEach((b, r) => {
        const s = c.pop + 0.02 + r * 0.014;
        const v = ease(s, s + 0.05, pr);
        set(branches.current[k]?.[r], v.toFixed(3), (el) => el.setAttribute("stroke-dashoffset", (b.len * (1 - v)).toFixed(1)));
      });
      c.leaves.forEach((l, j) => {
        const s = c.pop + 0.045 + j * 0.011 + l.row * 0.008;
        const v = clamp((pr - s) / 0.045);
        const e = backOut(v);
        set(leaves.current[k]?.[j], v.toFixed(3), (el) => {
          // fly out of the node along the branch, overshoot a touch, settle
          const dx = (c.x - l.x) * (1 - e) * 0.35;
          const dy = (c.y - l.y) * (1 - e) * 0.35;
          el.style.opacity = Math.min(1, v * 1.6).toFixed(3);
          el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${(0.6 + 0.4 * e).toFixed(3)})`;
          el.style.visibility = v <= 0 ? "hidden" : "visible";
          el.dataset.in = v > 0.95 ? "1" : "0"; // a light streak sweeps each chip once as it lands
        });
      });
    });
  });

  return (
    <div className="skilltree absolute inset-0" data-hl={hl ?? ""} onMouseLeave={() => setHl(null)}>
      <svg className="absolute inset-0 overflow-visible pointer-events-none" width={p.W} height={p.H} aria-hidden>
        <path
          ref={arc}
          d={`M ${p.seg.x} ${p.seg.y - p.seg.rad} A ${p.seg.rad} ${p.seg.rad} 0 0 0 ${p.seg.x + p.seg.rad} ${p.seg.y}`}
          fill="none"
          stroke="#8ab8ff"
          strokeOpacity=".8"
          strokeWidth={1.4}
          strokeDasharray={p.seg.b}
          strokeDashoffset={p.seg.b}
        />
        {p.cats.map((c, k) =>
          c.branches.map((b, r) => (
            <path
              key={`${c.key}${r}`}
              ref={(el) => { (branches.current[k] ??= [])[r] = el; }}
              className="st-branch"
              data-k={k}
              d={b.d}
              fill="none"
              stroke="#6fa8ff"
              strokeOpacity=".5"
              strokeWidth={1}
              strokeDasharray={b.len}
              strokeDashoffset={b.len}
            />
          )),
        )}
      </svg>

      {/* trunk: vertical + horizontal runs (transform-scaled), halo baked into the element */}
      <div
        ref={vLine}
        className="st-run st-run--v"
        style={{ left: p.seg.x - 0.7, top: p.seg.y0, height: p.seg.a, transform: "scaleY(0)" }}
        aria-hidden
      />
      <div
        ref={hLine}
        className="st-run st-run--h"
        style={{ left: p.seg.x + p.seg.rad, top: p.seg.y - 0.7, width: p.seg.c, transform: "scaleX(0)" }}
        aria-hidden
      />
      {/* leading tip + travelling pulses */}
      <div ref={tip} className="st-tip" style={{ opacity: 0 }} aria-hidden />
      <div ref={pulses} className="st-pulses" data-on="0" aria-hidden>
        {[0, 1].map((i) => (
          <i key={i} style={{ offsetPath: `path("${p.path}")`, animationDelay: `${i * 2.2}s` }} />
        ))}
      </div>

      {/* root */}
      <div className="st-node st-node--root" style={{ left: p.root[0], top: p.root[1], width: 34, height: 34 }} data-on="1" aria-hidden>
        <Sparkles size={15} />
      </div>
      <p className="absolute head text-[15px] !font-semibold" style={{ left: p.root[0] + 30, top: p.root[1] - 10 }}>
        Capabilities <span className="label !text-bone-3 ml-2 !font-normal">scroll to grow</span>
      </p>

      {p.cats.map((c, k) => {
        const Icon = ICONS[c.key] ?? Brain;
        const goto = () => scrollToChapter("signal", Math.min(0.9, c.pop + 0.18));
        return (
          <div key={c.key}>
            <button
              ref={(el) => { nodes.current[k] = el; }}
              className="st-node st-node--cat"
              style={{ left: c.x, top: c.y, width: R * 2, height: R * 2, opacity: 0 }}
              onMouseEnter={() => setHl(k)}
              onFocus={() => setHl(k)}
              onClick={goto}
              aria-label={`${c.name}: ${c.count} skills`}
            >
              <Icon size={16} />
            </button>
            <button
              ref={(el) => { labels.current[k] = el; }}
              className="st-label shine"
              style={{ left: c.x + R + 10, top: c.y, opacity: 0, transform: "translate3d(0,-50%,0)", ["--d" as string]: `${(k * 0.7).toFixed(1)}s` }}
              onMouseEnter={() => setHl(k)}
              onClick={goto}
              tabIndex={-1}
            >
              {c.name} <span className="st-count">{c.count}</span>
            </button>
            {c.leaves.map((l, j) => (
              <span
                key={l.name}
                ref={(el) => { (leaves.current[k] ??= [])[j] = el; }}
                className={`st-leaf shine ${l.more ? "st-leaf--more" : ""}`}
                data-k={k}
                title={l.rest?.join(" · ")}
                onMouseEnter={() => setHl(k)}
                style={{
                  left: l.x,
                  top: l.y,
                  width: l.w,
                  height: l.h,
                  opacity: 0,
                  visibility: "hidden",
                  ["--d" as string]: `${(k * 0.4 + j * 0.08).toFixed(2)}s`,
                }}
              >
                <span className="truncate px-2.5">{l.name}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function SkillTree() {
  const { layout } = useCoarse();
  const [fontsReady, setFontsReady] = useState(0);
  useEffect(() => {
    document.fonts?.ready.then(() => setFontsReady((v) => v + 1));
  }, []);
  const p = useMemo(() => {
    if (!layout) return null;
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) ctx.font = `500 12.5px ${getComputedStyle(document.body).fontFamily}`;
    const measure = (s: string) => Math.ceil((ctx ? ctx.measureText(s).width : s.length * 7) + 24);
    return planL(layout, measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, fontsReady]);

  if (!layout) return null;
  if (p) return <LTree p={p} />;
  // no usable left column (phones, narrow/short screens): the band-only tree, placed in the band
  const z = layout.zones.signal;
  return (
    <div className="absolute" style={{ left: z.x, top: z.y, width: z.w, height: z.h }}>
      <BandTree />
    </div>
  );
}
