# Design system: the film is the layout

The portfolio is built around one frame sequence: *Man tilting head sideways*, 191 frames at 24 fps. Scrolling scrubs the film. Every piece of UI is placed in space the subject isn't using, and that space is measured from the video itself rather than guessed.

## 1. Video analysis

`src/data/video-timeline.json` holds data for every frame. The data was produced like this:

* **Face box:** OpenCV YuNet detector. It found a face in all 191 frames, with scores of 0.90–0.93.
* **Person silhouette:** `u2net_human_seg` segmentation, stored as 18 rows of `[x0, x1]` spans.
* **Protected head box:** the part of the silhouette above the chin, joined with the face box. This covers the hair, the back of the head and the nose tip, which sticks out past the face box once he turns to profile.
* **Light streaks:** peaks of blue, high-saturation pixels in each row, stored as `[y, x0, x1, intensity]`.
* **Luminance, streak energy and top-left glow:** the glow value tracks the dawn light.

All coordinates are normalised to the 16:9 frame.

| Scene | Frames | What happens | Clear space |
|---|---|---|---|
| Still | 1–12 | Dark frame. 3/4 face looking up and to screen-left. | Left 0–35%. Right 67–100% above the shoulder. |
| Light rush | 13–95 | Blue streaks cross the frame, peaking at f85. He leans left. | Right side 33–40% wide, the widest it gets (f37–61). |
| The turn | 96–140 | Head rotates to full profile and drifts right. | The right side shrinks to about 22%. The left side opens up. |
| Dawn | 140–191 | Streaks fade and grey light rises top-left (glow 0.09 → 0.27). | Left 0–36%, now lit. |

**Palette (k-means over all frames):**

* void `#04050C`
* ink `#0C111F`
* navy `#071E49`
* signal `#3581E2` / `#4994E9`
* skin `#C2948B` (used as the warm accent)
* mauve `#8E7885`
* bone `#D0C3CC`
* dawn `#797F8D`

## 2. Chapters (`src/film/timeline.ts`)

The film is **always full-bleed**, on every chapter and every screen size. The virtual camera only pans inside whatever the screen's aspect ratio crops off (and follows the face on portrait screens). It never scales the film down.

| # | Chapter | Frames | Where the UI goes |
|---|---|---|---|
| 00 | Home | 0–20 | **Band under the chin**, following the reference layout: giant `Praveen®` across the jacket, three ticked columns, then the tile row. |
| 01 | About | 20–50 | Right of the head when that column is at least 320px wide, otherwise the band. |
| 02 | Capabilities | 50–100 | Band. He leans right during the light rush. |
| 03 | Work | 100–152 | Left of the head when there's room (he has turned to profile), otherwise the band. |
| 04 | Contact | 152–190 | Left, in the rising dawn light, otherwise the band. |

To change the pacing, edit `frames` or `vh`. To change the width at which a chapter falls back from a column to the band, edit `target`.

## 3. Placement and protection

1. **Zones** (`camera.ts`) are recalculated on every resize.
   * **Band:** runs from the lowest chin line across the chapter's frames down to the bottom of the screen, at full width.
   * **Column:** the space beside the widest head box across the chapter's frames.
   * Text may sit over the jacket. It never sits over the head.
2. **Compact paging.** When a band is shorter than 260px (a phone, or a 720p laptop), the chapter shows its content one beat at a time. Every stage also clips its contents, so nothing can spill upward over the face.
3. **Face guard** (`engine.ts`).
   * Content `<Guard>`s are checked against the head box: hair, face and nose.
   * The top bar is checked against the face box only. It can sit over hair at the top edge but never over the face.
   * Anything that touches its box fades and slides away.
4. **Tracers** (`Overlay.tsx`). Thin lines ride the light streaks the analysis detected, and are cut around the head.

## 4. Debug mode

Open `/?debug` to see:

* the protected head box (red)
* the face box (yellow)
* the silhouette joined across the chapter (magenta)
* the layout zones (cyan)
* a readout of the chapter, progress and frame

## 5. Assets

* `public/seq/lg/*.webp`: 1600×900, quality 72. 9.2 MB total.
* `public/seq/sm/*.webp`: 960×540, quality 70. 4.4 MB total. Used on small screens and slow connections (Save-Data, 2G/3G).
* The original 1080p PNGs (about 310 MB) are not needed at runtime.

To regenerate the WebP sets:

```bash
ffmpeg -i frame_%03d.png -vf scale=1600:900:flags=lanczos -c:v libwebp -quality 72 -start_number 1 public/seq/lg/%03d.webp
ffmpeg -i frame_%03d.png -vf scale=960:540:flags=lanczos  -c:v libwebp -quality 70 -start_number 1 public/seq/sm/%03d.webp
```

**Fonts** are self-hosted in `src/app/fonts`, all under the OFL licence: Outfit (wordmark and headings), Geist (text) and Geist Mono (tracer labels).
