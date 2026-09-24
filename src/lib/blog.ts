import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * Notes (blog) — every post is one MDX file in /content/blog:
 *   content/blog/<slug>.mdx   with frontmatter: title, description, date, tags, draft?
 * The file name is the URL: /blog/<slug>.
 */
export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO yyyy-mm-dd
  tags: string[];
  draft: boolean;
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
        // prose at ~220 wpm, plus a little time for every block of commands you'll actually run
        minutes: Math.max(1, Math.round(words / 220 + codeLines / 40)),
        number: 0,
        body: content,
      };
    })
    .filter((p) => process.env.NODE_ENV !== "production" || !p.draft)
    .sort((a, b) => a.date.localeCompare(b.date));
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

export function getPost(slug: string) {
  return readAll().find((p) => p.slug === slug) ?? null;
}

export const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
export const pad3 = (n: number) => String(n).padStart(3, "0");
