"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BrainCircuit, Plus, Database, Infinity, Layers, MonitorSmartphone, Server } from "lucide-react";
import { Beat, Lines, Stage, isCompact, scrollToChapter, useCoarse, useTick } from "@/film/react";
import { clamp, ease } from "@/film/timeline";
import { contact, identity, industries, projects } from "@/data/portfolio";
import SkillTree from "./SkillTree";
import ProjectSheet from "./ProjectSheet";

/* ================================================================== */
/* 00 · HOME — the reference composition: giant name across the jacket */
/* under the chin, three ticked columns, then the tile row.            */
/* ================================================================== */
const TILES = [
  { name: "AI Engineer", short: "AI / ML", icon: BrainCircuit },
  { name: "Full Stack", short: "Full Stack", icon: Layers },
  { name: "Backend", short: "Backend", icon: Server },
  { name: "Data Engineer", short: "Data", icon: Database },
  { name: "Frontend", short: "Frontend", icon: MonitorSmartphone },
  { name: "DevOps", short: "DevOps", icon: Infinity },
];
/* The core overview, most important first: who he is → what he builds → how far he takes it. */
const COLUMNS = [
  { title: identity.years, text: "Building AI products end to end, from the first model to production." },
  { title: "AI / ML", text: "LLM agents, retrieval and voice systems that reason and answer back." },
  { title: "Full Stack", text: "Services, data and interfaces designed, shipped and run as one product." },
];

/** The name as a 3D object: extruded depth, chrome face with the film's blue rim light, a travelling sheen. */
export function Wordmark3D({ text }: { text: string }) {
  return (
    <span className="wm3d-wrap">
      <span className="wm3d">
        <span className="wm3d__depth" aria-hidden>{text}</span>
        <span className="wm3d__face">{text}</span>
        <span className="wm3d__sheen" aria-hidden>{text}</span>
      </span>
      {/* ® is kept flat and crisp, outside the extruded copies (it smeared at small sizes) */}
      <sup className="wm3d__reg" aria-hidden>®</sup>
    </span>
  );
}

/** Fits the wordmark to the band: as wide as the zone allows, never taller than the space under the chin. */
function Wordmark({ reserve }: { reserve: number }) {
  const { layout } = useCoarse();
  const ref = useRef<HTMLHeadingElement>(null);
  const [size, setSize] = useState<number | null>(null);
  useEffect(() => {
    if (!layout || !ref.current) return;
    const el = ref.current;
    const fit = () => {
      const z = layout.zones.still;
      const prev = el.style.fontSize;
      el.style.fontSize = "100px";
      const em = el.scrollWidth / 100;
      el.style.fontSize = prev;
      const byW = (z.w * 0.97) / em;
      const byH = (z.h - reserve) / 0.8;
      setSize(Math.max(40, Math.min(byW, byH, 300)));
    };
    fit();
    document.fonts?.ready.then(fit);
  }, [layout, reserve]);
  // gentle 3D tilt toward the pointer (transform only — composited, no repaint)
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(".wm3d-wrap");
    if (!el || matchMedia("(pointer: coarse)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const nx = e.clientX / innerWidth - 0.5;
        const ny = e.clientY / innerHeight - 0.5;
        el.style.setProperty("--ry", `${(nx * 14).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-ny * 9).toFixed(2)}deg`);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <h1
      ref={ref}
      data-wordmark-target
      aria-label={identity.first}
      className="self-center"
      style={{ fontSize: size ?? "clamp(56px,11vw,300px)" }}
    >
      <Wordmark3D text={identity.first.toUpperCase()} />
    </h1>
  );
}

/** Minimal skill tiles: pop in one by one with the scroll, then a light streak sweeps across them. */
function Tiles({ small = false }: { small?: boolean }) {
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const last = useRef<string[]>([]);
  useTick((t) => {
    const p = t.progressOf("still");
    refs.current.forEach((el, i) => {
      if (!el) return;
      const a = 0.44 + i * 0.035;
      const v = ease(a, a + 0.08, p);
      const k = v.toFixed(3);
      if (last.current[i] === k) return;
      last.current[i] = k;
      el.style.opacity = k;
      el.style.transform = `translate3d(0,${((1 - v) * 18).toFixed(1)}px,0) scale(${(0.94 + v * 0.06).toFixed(3)})`;
    });
  });
  return (
    <ul className={small ? "grid grid-cols-3 gap-2" : "grid grid-cols-6 gap-3"}>
      {TILES.map((t, i) => (
        <li
          key={t.name}
          ref={(el) => { refs.current[i] = el; }}
          className={`tile-min shine ${small ? "!h-11 !text-[13.5px] !gap-1.5" : ""}`}
          style={{ opacity: 0, ["--d" as string]: `${(1.2 + i * 0.12).toFixed(2)}s` }}
        >
          <t.icon size={17} strokeWidth={2} aria-hidden /> {small ? t.short : t.name}
        </li>
      ))}
    </ul>
  );
}

export function Still() {
  const { layout } = useCoarse();
  const compact = isCompact(layout, "still");
  const stack = layout?.vp.mode === "stack";
  return (
    <Stage id="still" className="intro">
      <Wordmark reserve={stack ? 132 : compact ? 64 : 104} />
      <div className="intro-fade mt-[clamp(8px,2.4cqh,22px)] grid">
        {stack ? (
          <>
          <Beat at={[0, 0.46]} style={{ gridArea: "1 / 1" }}>
            <p className="body !text-[14px] max-w-[34ch]">
              {identity.role[0].toUpperCase() + identity.role.slice(1)} with <strong>{identity.years}</strong> taking AI from research to production.
            </p>
            <div className="mt-4 flex gap-2">
              <button className="btn btn--light btn--sm" onClick={() => scrollToChapter("work")}>
                See work <ArrowRight size={16} className="arr" />
              </button>
              <button className="btn btn--sm" onClick={() => scrollToChapter("dawn")}>
                Let&rsquo;s talk
              </button>
            </div>
          </Beat>
          <Beat at={[0.44, 1]} style={{ gridArea: "1 / 1" }} className="self-end" y={0}>
            <Tiles small />
          </Beat>
          </>
        ) : (
          <>
            <Beat at={[0, 0.46]} style={{ gridArea: "1 / 1" }}>
              <div className="grid grid-cols-3 gap-[clamp(24px,5vw,96px)]">
                {COLUMNS.map((c) => (
                  <div key={c.title} className="tick">
                    <h3 className="head text-[clamp(20px,2vw,32px)] !font-semibold">{c.title}</h3>
                    {!compact && <p className="body mt-1.5 !text-[clamp(13px,1vw,15px)] !leading-[1.45] max-w-[40ch] line-clamp-2">{c.text}</p>}
                  </div>
                ))}
              </div>
            </Beat>
            <Beat at={[0.44, 1]} style={{ gridArea: "1 / 1" }} className="self-end" y={0}>
              <Tiles />
            </Beat>
          </>
        )}
      </div>
    </Stage>
  );
}

/* ================================================================== */
/* 01 · ABOUT — beside him (right) when there's room, else under chin  */
/* ================================================================== */
export function Intent() {
  const { layout } = useCoarse();
  const shape = layout?.zones.intent.shape ?? "column";
  const compact = isCompact(layout, "intent");
  const stats = [
    [identity.years.replace(" Years", ""), "Years building"],
    [String(projects.length).padStart(2, "0"), "Products shipped"],
    [String(industries.length).padStart(2, "0"), "Industries"],
  ];
  const statement = ["Five years between", "a model and the moment", "someone uses it."];
  const body = (
    <p className="body">
      I design and build AI products end to end: <strong>real-time voice agents</strong>, <strong>LLM pipelines</strong> that know where to
      look, and the <strong>serverless infrastructure</strong> that keeps them fast. Research in, production out.
    </p>
  );
  const Stats = (
    <dl className="grid grid-cols-3 gap-5">
      {stats.map(([n, l]) => (
        <div key={l} className="tick">
          <dd className="head text-[clamp(28px,3vw,44px)] !font-semibold">{n}</dd>
          <dt className="label mt-1.5">{l}</dt>
        </div>
      ))}
    </dl>
  );

  if (shape === "column")
    return (
      <Stage id="intent" align="center">
        <Beat at={[0.06, 1]}>
          <p className="label">About</p>
          <h2 className="head mt-4 text-[clamp(30px,11cqi,54px)]">
            <Lines at={0.1} lines={statement} />
          </h2>
        </Beat>
        <Beat at={[0.22, 1]} className="mt-6">{body}</Beat>
        <Beat at={[0.32, 1]} className="mt-8">{Stats}</Beat>
      </Stage>
    );

  return (
    <Stage id="intent">
      <div className="grid">
        <Beat at={[0.06, 1]} atStack={[0.06, 0.42]} style={{ gridArea: "1 / 1" }} className={compact ? "" : "grid grid-cols-12 gap-10 items-end"}>
          <div className={compact ? "" : "col-span-5"}>
            <p className="label">About</p>
            <h2 className="head mt-3 text-[clamp(22px,min(3.2vw,13cqh),48px)]">
              <Lines at={0.1} lines={compact ? ["Five years between a model", "and the moment someone uses it."] : statement} />
            </h2>
          </div>
          {!compact && <div className="col-span-4">{body}</div>}
          {!compact && <div className="col-span-3">{Stats}</div>}
        </Beat>
        {compact && (
          <>
            <Beat at={[2, 2]} atStack={[0.42, 0.72]} style={{ gridArea: "1 / 1" }}>{body}</Beat>
            <Beat at={[2, 2]} atStack={[0.72, 1]} style={{ gridArea: "1 / 1" }}>{Stats}</Beat>
          </>
        )}
      </div>
    </Stage>
  );
}

/* ================================================================== */
/* 02 · CAPABILITIES — a skill tree that grows into the empty band     */
/* under the chin while the light rushes past                          */
/* ================================================================== */
export function Signal() {
  return (
    <Stage id="signal" full>
      <SkillTree />
    </Stage>
  );
}

/* ================================================================== */
/* 03 · WORK — he turns away; the projects take the left side          */
/* ================================================================== */
const W_A = 0.06;
const W_SPAN = 0.9;
export function Work() {
  const { layout } = useCoarse();
  const shape = layout?.zones.work.shape ?? "column";
  const compact = isCompact(layout, "work");
  const n = projects.length;
  const w = W_SPAN / n;
  const cards = useRef<(HTMLElement | null)[]>([]);
  const prog = useRef<(HTMLDivElement | null)[]>([]);
  const counter = useRef<HTMLSpanElement>(null);
  const cur = useRef(-1);
  const on = useRef<boolean[]>([]);
  const [open, setOpen] = useState<number | null>(null);

  useTick((t) => {
    const p = t.progressOf("work");
    const k = clamp(Math.floor((p - W_A) / w), 0, n - 1);
    cards.current.forEach((el, i) => {
      if (!el) return;
      const a = W_A + i * w;
      // exit first (fade + drift left), then the next card wipes in left→right like a light streak
      const fin = i === 0 ? ease(0.02, W_A + 0.02, p) : ease(a + 0.004, a + w * 0.3, p);
      const fout = i === n - 1 ? 0 : ease(a + w - 0.022, a + w - 0.002, p);
      const vis = fin * (1 - fout);
      el.style.opacity = (Math.min(1, fin * 3) * (1 - fout)).toFixed(3);
      el.style.clipPath = `inset(0 ${((1 - fin) * 100).toFixed(2)}% 0 0 round 24px)`;
      el.style.transform = `translate3d(${(-fout * 28).toFixed(1)}px,0,0)`;
      el.style.visibility = vis <= 0.001 ? "hidden" : "visible";
      el.style.pointerEvents = vis > 0.6 ? "" : "none";
      // the content cascade plays once the card has wiped in, and resets when it leaves
      const live = fin > 0.22 && fout < 0.5;
      if (live !== on.current[i]) {
        on.current[i] = live;
        el.classList.toggle("is-on", live);
      }
      const pr = prog.current[i];
      if (pr) pr.style.transform = `scaleX(${clamp((p - a) / w).toFixed(3)})`;
    });
    if (k !== cur.current) {
      cur.current = k;
      if (counter.current) counter.current.textContent = String(k + 1).padStart(2, "0");
    }
  });

  const go = useCallback((i: number) => scrollToChapter("work", W_A + clamp(i, 0, n - 1) * w + w * 0.5), [n, w]);
  const band = shape === "band";
  const close = useCallback(() => setOpen(null), []);
  // flipping projects inside the sheet also moves the film to that card behind it
  const pick = useCallback((i: number) => { setOpen(i); go(i); }, [go]);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const spot = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
    e.currentTarget.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
  };

  const Controls = ({ i }: { i: number }) => (
    <div className="flex items-center gap-2 shrink-0" onClick={stop}>
      <button onClick={() => go(i - 1)} disabled={i === 0} className="btn btn--sm !h-9 !w-9 !p-0 disabled:opacity-30" aria-label="Previous project">
        <ArrowLeft size={15} />
      </button>
      <button
        onClick={() => (i === n - 1 ? scrollToChapter("dawn") : go(i + 1))}
        className="btn btn--sm !h-9 !w-9 !p-0"
        aria-label={i === n - 1 ? "Contact" : "Next project"}
      >
        <ArrowRight size={15} />
      </button>
    </div>
  );
  const Progress = ({ i }: { i: number }) => (
    <div className="relative h-[2px] flex-1 rounded bg-white/10 overflow-hidden">
      <div ref={(el) => { prog.current[i] = el; }} className="absolute inset-0 origin-left bg-[var(--signal-hi)]" style={{ transform: "scaleX(0)" }} />
    </div>
  );

  return (
    <Stage id="work" align="center">
      {!compact && (
        <Beat at={[0.02, 1]} className="flex items-end justify-between gap-4 mb-4">
          <p className="label">Selected work</p>
          <p className="head text-[15px] text-bone-2 tabular-nums">
            <span ref={counter} className="text-white">01</span> / {String(n).padStart(2, "0")}
          </p>
        </Beat>
      )}
      <div className="grid">
        {projects.map((pj, i) => (
          <article
            key={pj.title}
            ref={(el) => { cards.current[i] = el; }}
            className={`card card--work ${compact ? "p-4" : band ? "grid grid-cols-12 gap-8 items-start p-6" : "p-5 md:p-7"}`}
            style={{ gridArea: "1 / 1", opacity: 0, visibility: "hidden" }}
            aria-label={pj.title}
            onClick={() => setOpen(i)}
            onPointerMove={spot}
          >
            {compact ? (
              /* short bands / phones: title, two lines, controls — nothing taller than the band */
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="label !text-signal-hi truncate">
                    {String(i + 1).padStart(2, "0")}/{String(n).padStart(2, "0")} · {pj.industry.split(" / ")[0]}
                  </p>
                  <Controls i={i} />
                </div>
                <h3 className="wk-r head mt-1 text-[clamp(22px,14cqh,34px)] !font-semibold" style={{ ["--i" as string]: 0 }}>{pj.title}</h3>
                <p className="wk-r body mt-1.5 !text-[13.5px] !leading-[1.45] line-clamp-2" style={{ ["--i" as string]: 1 }}>{pj.overview}</p>
                <div className="wk-r mt-3 flex items-center gap-3" style={{ ["--i" as string]: 2 }}>
                  <Progress i={i} />
                  <button className="wk-more" onClick={(e) => { e.stopPropagation(); setOpen(i); }} aria-label={`Details: ${pj.title}`}>
                    Details <Plus size={13} strokeWidth={2.4} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={band ? "col-span-4" : ""}>
                  <p className="wk-r tick label !text-signal-hi" style={{ ["--i" as string]: 0 }}>{pj.industry.split(" / ")[0]}</p>
                  <h3 className="wk-title head mt-3 text-[clamp(28px,3vw,46px)] !font-semibold">
                    <span>{pj.title}</span>
                  </h3>
                  {!band && <p className="wk-r label mt-1 !text-bone-3" style={{ ["--i" as string]: 2 }}>{pj.role}</p>}
                </div>
                <p className={`wk-r body ${band ? "col-span-4 !mt-0" : "mt-4"}`} style={{ ["--i" as string]: 3 }}>{pj.overview}</p>
                <div className={band ? "col-span-4" : "mt-5"}>
                  <ul className="flex flex-wrap gap-1.5">
                    {pj.techStack.slice(0, 8).map((s, k) => (
                      <li key={s} className="wk-chip chip" style={{ ["--i" as string]: 4 + k * 0.45 }}>{s}</li>
                    ))}
                  </ul>
                  <div className="wk-r mt-5 flex items-center gap-3" style={{ ["--i" as string]: 6 }}>
                    <Progress i={i} />
                    <button className="wk-more" onClick={(e) => { e.stopPropagation(); setOpen(i); }} aria-label={`Details: ${pj.title}`}>
                      Details <Plus size={13} strokeWidth={2.4} />
                    </button>
                    <Controls i={i} />
                  </div>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
      <ProjectSheet index={open} onClose={close} onIndex={pick} />
    </Stage>
  );
}

/* ================================================================== */
/* 04 · CONTACT — in the dawn light that rises top-left                */
/* ================================================================== */
export function Dawn() {
  const { layout } = useCoarse();
  const shape = layout?.zones.dawn.shape ?? "column";
  const compact = isCompact(layout, "dawn");
  const band = shape === "band";
  return (
    <Stage id="dawn" align="center">
      <div className={band && !compact ? "grid grid-cols-12 gap-10 items-end" : ""}>
        <Beat at={[0.1, 1]} atStack={[0.1, 0.55]} className={band && !compact ? "col-span-7" : ""}>
          <p className="label">Contact</p>
          <h2 className="head mt-4 text-[clamp(36px,5vw,84px)] !font-semibold">
            <Lines at={0.14} lines={["Let’s build", "what’s next."]} />
          </h2>
          {!compact && (
            <p className="body mt-5 max-w-[42ch]">
              Have a product that needs to listen, reason or scale? I&rsquo;m taking on a small number of AI builds and platform roles.
            </p>
          )}
        </Beat>
        <Beat at={[0.24, 1]} atStack={[0.55, 1]} className={band && !compact ? "col-span-5" : "mt-8"}>
          <a href={`mailto:${contact.email}`} className="btn btn--light w-full sm:w-auto !justify-between">
            {contact.email} <ArrowUpRight size={18} className="arr" />
          </a>
          <div className="mt-5 flex flex-wrap gap-2">
            {contact.links.map((l) => (
              <a key={l.label} href={l.href} className="pill hover:!text-white">
                {l.label}
              </a>
            ))}
          </div>
          <p className="label mt-6 !text-bone-3">
            © 2026 {identity.first} · {contact.availability} · Scroll UI by{" "}
            <a href="https://rareui.com" target="_blank" rel="noreferrer" className="link-u hover:text-white">
              Rare UI
            </a>
          </p>
        </Beat>
      </div>
    </Stage>
  );
}
