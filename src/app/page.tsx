"use client";

import { useCallback, useState } from "react";
import { preload } from "react-dom";
import FilmCanvas from "@/film/FilmCanvas";
import Overlay from "@/film/Overlay";
import { useFilmStart } from "@/film/react";
import { CHAPTERS } from "@/film/timeline";
import { frameUrl } from "@/film/seq";
import { Loader, Menu, TopBar } from "@/components/Chrome";
import { Dawn, Intent, Signal, Still, Work } from "@/components/Chapters";
import ScrollDock from "@/components/ScrollDock";

const WIDE = "(min-width: 820px) and (min-aspect-ratio: 21/20)";
const TALL = "(max-width: 819px), (max-aspect-ratio: 21/20)";
/* The first frames the loader asks for (the opening of the hero) start downloading with the
   HTML itself, before any script has run — only on the film page, not on /blog. */
const FIRST = Array.from({ length: 12 }, (_, i) => i);

export default function Home() {
  for (const i of FIRST) {
    preload(frameUrl("lg", i), { as: "fetch", crossOrigin: "anonymous", media: WIDE, fetchPriority: i === 0 ? "high" : "auto" });
    preload(frameUrl("pt", i), { as: "fetch", crossOrigin: "anonymous", media: TALL, fetchPriority: i === 0 ? "high" : "auto" });
  }
  preload(frameUrl("pt2", 0), { as: "fetch", crossOrigin: "anonymous", media: TALL });
  useFilmStart();
  const [menu, setMenu] = useState(false);
  const close = useCallback(() => setMenu(false), []);

  return (
    <>
      {/* the film (scrims and streak tracers are painted into it); the overlay only draws in ?debug */}
      <FilmCanvas />
      <Overlay />

      {/* chapters: fixed stages positioned in the clear space around the subject */}
      <div className="stages">
        <Still />
        <Intent />
        <Signal />
        <Work />
        <Dawn />
      </div>

      <TopBar onMenu={() => setMenu(true)} />
      <ScrollDock />
      <Menu open={menu} onClose={close} />
      <Loader />

      {/* scroll track — each chapter's length is its share of the film */}
      <main aria-label="Praveen — portfolio">
        {CHAPTERS.map((c) => (
          <section key={c.id} id={c.id} aria-label={c.scene} style={{ height: `calc(var(--vhu) * ${c.vh})` }} />
        ))}
        <div aria-hidden style={{ height: "calc(var(--vhu) * 100)" }} />
      </main>
    </>
  );
}
