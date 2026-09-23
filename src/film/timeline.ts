/**
 * Video timeline — generated from frame-by-frame analysis of
 * "Man tilting head sideways" (191 frames, 24fps).
 *
 * Every coordinate is normalised to the video frame (0..1, 16:9).
 *   f   face box            [x, y, w, h]        (YuNet detector)
 *   h   protected head box  [x0, y0, x1, y1]    (hair + nose + face, from segmentation)
 *   e   eye midpoint        [x, y]
 *   s   light streaks       [y, x0, x1, intensity][]
 *   sil silhouette          18 rows of [x0, x1]  (row r spans y r/18 .. (r+1)/18)
 *   l   mean luminance, k streak energy, g top-left glow (dawn light)
 */
import raw from "@/data/video-timeline.json";

export type Frame = {
  f: [number, number, number, number];
  h: [number, number, number, number];
  e: [number, number];
  s: [number, number, number, number][];
  sil: [number, number][];
  l: number;
  k: number;
  g: number;
};

export const VIDEO = {
  fps: raw.fps as number,
  count: raw.count as number,
  width: 1600,
  height: 900,
  frames: raw.frames as unknown as Frame[],
};

export const SIL_ROWS = 18;

export type ChapterId = "still" | "intent" | "signal" | "work" | "dawn";
export type Side = "left" | "right" | "band";

export type Chapter = {
  id: ChapterId;
  index: string;
  label: string;
  scene: string;
  /** frame range this chapter plays through (0-based, inclusive start) */
  frames: [number, number];
  /** scroll length in viewport heights */
  vh: number;
  /** which side of the subject the chapter's UI lives on */
  side: Side;
  /** camera push when the frame overflows the screen: -1 subject left, 1 subject right */
  ax?: number;
  /** min width for a side column; below it the chapter uses the under-chin band */
  target: number;
};

/**
 * Chapters are art-directed against the analysis:
 *  - the hero sits under the chin, across the jacket (full-width band)
 *  - early frames keep the head at x ≤ .70 → About on the RIGHT when there's room
 *  - the light rush (f50–100) moves him right → capabilities go back under the chin
 *  - after f96 he turns to profile and drifts right → Work and Contact move LEFT
 *  - the film is always full-bleed; nothing ever shrinks it
 */
export const CHAPTERS: Chapter[] = [
  { id: "still", index: "00", label: "Still", scene: "Home", frames: [0, 20], vh: 150, side: "band", target: 0 },
  { id: "intent", index: "01", label: "Intent", scene: "About", frames: [20, 50], vh: 200, side: "right", target: 320 },
  { id: "signal", index: "02", label: "Signal", scene: "Capabilities", frames: [50, 100], vh: 300, side: "band", target: 0, ax: 1 },
  { id: "work", index: "03", label: "The Turn", scene: "Work", frames: [100, 152], vh: 560, side: "left", target: 300 },
  { id: "dawn", index: "04", label: "Dawn", scene: "Contact", frames: [152, 190], vh: 200, side: "left", target: 300 },
];

export const TOTAL_VH = CHAPTERS.reduce((a, c) => a + c.vh, 0);

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const ease = (a: number, b: number, v: number) => smooth(clamp((v - a) / (b - a)));

export function frameAt(f: number): Frame {
  const i = clamp(Math.round(f), 0, VIDEO.count - 1);
  return VIDEO.frames[i];
}

/** Interpolated head box for fractional frames. */
export function headAt(f: number): [number, number, number, number] {
  const a = VIDEO.frames[clamp(Math.floor(f), 0, VIDEO.count - 1)].h;
  const b = VIDEO.frames[clamp(Math.ceil(f), 0, VIDEO.count - 1)].h;
  const t = f - Math.floor(f);
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
}

export function faceCenterAt(f: number): [number, number] {
  const a = frameAt(Math.floor(f)).f;
  const b = frameAt(Math.ceil(f)).f;
  const t = f - Math.floor(f);
  return [lerp(a[0] + a[2] / 2, b[0] + b[2] / 2, t), lerp(a[1] + a[3] / 2, b[1] + b[3] / 2, t)];
}

/** Silhouette union (per row min x0 / max x1) across a frame range, with head padding. */
export function silhouetteUnion(from: number, to: number): [number, number][] {
  const rows: [number, number][] = Array.from({ length: SIL_ROWS }, () => [1, 0]);
  const a = clamp(Math.floor(from), 0, VIDEO.count - 1);
  const b = clamp(Math.ceil(to), 0, VIDEO.count - 1);
  for (let i = a; i <= b; i++) {
    const fr = VIDEO.frames[i];
    fr.sil.forEach(([x0, x1], r) => {
      if (x1 <= x0) return;
      rows[r][0] = Math.min(rows[r][0], x0);
      rows[r][1] = Math.max(rows[r][1], x1);
    });
    // head box is authoritative for the protected region (includes the nose tip)
    const [hx0, hy0, hx1, hy1] = fr.h;
    for (let r = 0; r < SIL_ROWS; r++) {
      const y0 = r / SIL_ROWS, y1 = (r + 1) / SIL_ROWS;
      if (y1 >= hy0 - 0.04 && y0 <= hy1 + 0.04) {
        rows[r][0] = Math.min(rows[r][0], hx0 - 0.02);
        rows[r][1] = Math.max(rows[r][1], hx1 + 0.015);
      }
    }
  }
  return rows;
}

export function timecode(frame: number) {
  const f = Math.max(0, Math.round(frame));
  const s = Math.floor(f / VIDEO.fps);
  const ff = f % VIDEO.fps;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `00:00:${pad(s)}:${pad(ff)}`;
}
