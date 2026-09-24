"use client";

import { useEffect, useRef } from "react";

/** Reading progress: a hairline of signal blue across the top. */
export default function Progress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - innerHeight;
        bar.current?.style.setProperty("transform", `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`);
      });
    };
    on();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => {
      removeEventListener("scroll", on);
      removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <div ref={bar} className="read-progress" aria-hidden />;
}
