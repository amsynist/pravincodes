# pravincodes — portfolio

A scroll-driven, single-page portfolio. The background film drives the layout, and the UI stays clear of the subject's face.

```bash
npm install
npm run dev      # http://localhost:3000   (add ?debug to see face boxes and layout zones)
npm run build
```

* `src/film/`: the engine, virtual camera, layout zones, face guard, and canvas renderer
* `src/components/`: the chapters (Still, Intent, Signal, Work, Dawn) and the chrome (nav, rail, HUD, menu, loader)
* `src/data/`: `resume.ts` (content), `portfolio.ts` (copy and contact placeholders), `video-timeline.json` (per-frame analysis)
* `docs/DESIGN.md`: the video analysis and how the layout system works

**Before publishing:** replace the contact placeholders in `src/data/portfolio.ts`.

## Credits

* Scroll progress pill (in `src/components/ScrollDock.tsx`) adapted from [Rare UI](https://rareui.com) — "Scroll Progress", © 2026 Swami Malode, MIT + Commons Clause + Attribution. The footer carries the required visible link.
