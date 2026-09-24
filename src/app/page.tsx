"use client";

import { useCallback, useState } from "react";
import { preload } from "react-dom";
import FilmCanvas from "@/film/FilmCanvas";
import Overlay from "@/film/Overlay";
import { useFilmStart } from "@/film/react";
import { CHAPTERS } from "@/film/timeline";
import { Loader, Menu, Scrims, TopBar } from "@/components/Chrome";
import { Dawn, Intent, Signal, Still, Work } from "@/components/Chapters";
import ScrollDock from "@/components/ScrollDock";

const WIDE = "(min-width: 820px) and (min-aspect-ratio: 21/20)";
const TALL = "(max-width: 819px), (max-aspect-ratio: 21/20)";

export default function Home() {
  // first frames start downloading with the HTML — only on the film page, not on /blog
  preload("/seq/lg/001.webp", { as: "fetch", crossOrigin: "anonymous", media: WIDE });
  preload("/seq/pt/001.webp", { as: "fetch", crossOrigin: "anonymous", media: TALL });
  preload("/seq/pt2/001.avif", { as: "fetch", crossOrigin: "anonymous", media: TALL });
  useFilmStart();
  const [menu, setMenu] = useState(false);
  const close = useCallback(() => setMenu(false), []);

  return (
    <>
      {/* the film */}
      <FilmCanvas />
      <Scrims />
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
