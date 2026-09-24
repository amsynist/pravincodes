import type { ReactNode } from "react";
import { AlertTriangle, Download as DownloadIcon, Info, Lightbulb } from "lucide-react";

const KINDS = {
  note: { icon: Info, label: "Note" },
  tip: { icon: Lightbulb, label: "Tip" },
  warn: { icon: AlertTriangle, label: "Heads up" },
} as const;

function Callout({ kind, title, children }: { kind: keyof typeof KINDS; title?: string; children: ReactNode }) {
  const K = KINDS[kind];
  return (
    <aside className={`callout callout--${kind}`}>
      <p className="callout__head">
        <K.icon size={15} strokeWidth={2} aria-hidden /> {title ?? K.label}
      </p>
      <div className="callout__body">{children}</div>
    </aside>
  );
}
export const Note = (p: { title?: string; children: ReactNode }) => <Callout kind="note" {...p} />;
export const Tip = (p: { title?: string; children: ReactNode }) => <Callout kind="tip" {...p} />;
export const Warn = (p: { title?: string; children: ReactNode }) => <Callout kind="warn" {...p} />;

/** "At a glance" spec grid: <Specs items={[["Label", "Value"], …]} /> */
export function Specs({ items }: { items: [string, string][] }) {
  return (
    <dl className="specs">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Numbered step marker for tutorials: <Step n={1} title="Install ComfyUI" /> */
export function Step({ n, title }: { n: number; title: string }) {
  return (
    <p className="step">
      <span className="step__n">{String(n).padStart(2, "0")}</span>
      <span className="step__t">{title}</span>
    </p>
  );
}

/** A file to download (e.g. a ComfyUI workflow): <Download href="/blog/…/file.json" title="…" meta="…" /> */
export function Download({ href, title, meta }: { href: string; title: string; meta?: string }) {
  return (
    <a className="dl" href={href} download>
      <span className="dl__icon" aria-hidden>
        <DownloadIcon size={18} strokeWidth={2} />
      </span>
      <span className="dl__text">
        <span className="dl__title">{title}</span>
        {meta && <span className="dl__meta">{meta}</span>}
      </span>
      <span className="dl__cta">Download</span>
    </a>
  );
}
