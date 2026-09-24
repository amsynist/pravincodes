"use client";

import { Children, useSyncExternalStore, type ReactNode } from "react";

/* Tabs that share a `group` stay in sync across the article: pick your GPU once and every
   command block on the page follows. The choice is remembered for next time. */
const listeners = new Set<() => void>();
const picks = new Map<string, number>();
const KEY = "notes:tabs";
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  Object.entries(saved).forEach(([k, v]) => picks.set(k, v));
} catch {
  /* private mode / SSR — defaults are fine */
}
function setPick(group: string, i: number) {
  picks.set(group, i);
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(picks)));
  } catch {}
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function Tabs({ labels, group, children }: { labels: string[]; group?: string; children: ReactNode }) {
  const key = group ?? labels.join("|");
  const i = useSyncExternalStore(subscribe, () => picks.get(key) ?? 0, () => 0);
  const panes = Children.toArray(children);
  const active = Math.min(i, panes.length - 1);
  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist">
        {labels.map((l, k) => (
          <button key={l} type="button" role="tab" aria-selected={k === active} className="tabs__tab" onClick={() => setPick(key, k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="tabs__pane" role="tabpanel">
        {panes[active]}
      </div>
    </div>
  );
}

export function Tab({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
