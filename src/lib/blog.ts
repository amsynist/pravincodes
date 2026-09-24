import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * Notes (blog) — every post is one MDX file in /content/blog:
 *   content/blog/<slug>.mdx   with frontmatter: title, description, date, tags, draft?,
 *                             accent? (card colour), cover?, status?
 * The file name is the URL: /blog/<slug>.
 * Cover: drop public/blog/<slug>/cover.webp (16:9, ~1600×900) and it's used on the card
 * and — from cover-blur.webp, a tiny pre-blurred copy — behind the article header.
 * Or point `cover:` at any image in /public. No cover → the neutral draft cover.
 * status: "soon" lists the note as an "In the works" card with no page yet —
 * delete that line once it's written and it becomes a normal post.
 */
const PUB = path.join(process.cwd(), "public");
const DRAFT_COVER = "/blog/_drafts/cover.webp";
const has = (url: string) => fs.existsSync(path.join(PUB, url));
function coverOf(slug: string, data: Record<string, unknown>) {
  const own = typeof data.cover === "string" ? data.cover : `/blog/${slug}/cover.webp`;
  const cover = has(own) ? own : DRAFT_COVER;
  const blurUrl = cover.replace(/(\.[a-z]+)$/i, "-blur.webp");
  return { cover, coverBlur: has(blurUrl) ? blurUrl : cover };
}

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO yyyy-mm-dd
  tags: string[];
  draft: boolean;
  soon: boolean;
  accent: string; // any CSS colour
  cover: string; // card image
  coverBlur: string; // tiny pre-blurred copy for the article header
  minutes: number;
  number: number; // 1-based issue number, oldest = 001
};

const DIR = path.join(process.cwd(), "content", "blog");

function readAll(): (PostMeta & { body: string })[] {
  if (!fs.existsSync(DIR)) return [];
  const posts = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(DIR, file), "utf8");
      const { data, content } = matter(raw);
      const words = content.replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
      const codeLines = (content.match(/```[\s\S]*?```/g) ?? []).join("\n").split("\n").length;
      return {
        slug: file.replace(/\.mdx?$/, ""),
        title: String(data.title ?? file),
        description: String(data.description ?? ""),
        date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date ?? ""),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        draft: Boolean(data.draft),
        soon: String(data.status ?? "").toLowerCase() === "soon",
        accent: String(data.accent ?? "#6fa8ff"),
        ...coverOf(file.replace(/\.mdx?$/, ""), data),
        // prose at ~220 wpm, plus a little time for every block of commands you'll actually run
        minutes: Math.max(1, Math.round(words / 220 + codeLines / 40)),
        number: 0,
        body: content,
      };
    })
    .filter((p) => !p.soon && (process.env.NODE_ENV !== "production" || !p.draft))
    .sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
  posts.forEach((p, i) => (p.number = i + 1));
  return posts.reverse(); // newest first
}

export function getPosts(): PostMeta[] {
  return readAll().map((p) => {
    const meta: PostMeta & { body?: string } = { ...p };
    delete meta.body;
    return meta;
  });
}

/** notes marked `status: soon` — shown as "In the works" cards, no page yet */
export function getUpcoming(): PostMeta[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => /\.mdx?$/.test(f))
    .map((file) => {
      const { data } = matter(fs.readFileSync(path.join(DIR, file), "utf8"));
      return { file, data };
    })
    .filter(({ data }) => String(data.status ?? "").toLowerCase() === "soon")
    .map(({ file, data }) => ({
      slug: file.replace(/\.mdx?$/, ""),
      title: String(data.title ?? file),
      description: String(data.description ?? ""),
      date: "",
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      draft: false,
      soon: true,
      accent: String(data.accent ?? "#8b91a0"),
      cover: DRAFT_COVER,
      coverBlur: DRAFT_COVER,
      minutes: 0,
      number: 0,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getPost(slug: string) {
  return readAll().find((p) => p.slug === slug) ?? null;
}

export const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
export const pad3 = (n: number) => String(n).padStart(3, "0");
