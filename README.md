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

## Notes (blog)

Every post is one file in `content/blog/` — the file name becomes the URL (`content/blog/my-post.mdx` → `/blog/my-post`).

1. Copy `docs/NOTE_TEMPLATE.mdx` to `content/blog/<your-slug>.mdx`.
2. Fill in the frontmatter (title, description, date, tags). Keep `draft: true` while writing — drafts only show in `npm run dev`.
3. Write in Markdown. Code blocks get syntax colours and a Copy button; shell blocks show a `$` that is never copied.
   Extras: `<Tabs group="gpu" labels={[…]}>` (tabs with the same group stay in sync), `<Note>`, `<Tip>`, `<Warn>`, `<Specs items={[…]} />`, `<Step n={1} title="…" />`.
4. Remove `draft: true` to publish. The Notes page numbers posts oldest-first (001, 002 …).

## Credits

* Scroll progress pill (in `src/components/ScrollDock.tsx`) adapted from [Rare UI](https://rareui.com) — "Scroll Progress", © 2026 Swami Malode, MIT + Commons Clause + Attribution. The footer carries the required visible link.
