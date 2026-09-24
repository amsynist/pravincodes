"use client";

import { useEffect, useState } from "react";

export type TocItem = { id: string; text: string; depth: 2 | 3 };

/** "On this page": follows the section you're reading. */
export default function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);
  if (!items.length) return null;
  let n = 0;
  return (
    <nav className="toc" aria-label="On this page">
      <p className="toc__label">On this page</p>
      <ol>
        {items.map((i) => (
          <li key={i.id} data-depth={i.depth} data-active={active === i.id ? "" : undefined}>
            <a href={`#${i.id}`}>
              {i.depth === 2 && <span className="toc__n">{String(++n).padStart(2, "0")}</span>}
              {i.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
