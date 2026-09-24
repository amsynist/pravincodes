import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { fmtDate, getPosts, pad3 } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Notes — Praveen",
  description: "Hands-on notes and tutorials on AI models, infrastructure and the things I build.",
};

export default function NotesIndex() {
  const posts = getPosts();
  return (
    <main className="notes-index">
      <section className="notes-hero">
        <p className="dotlabel">Notes · {pad3(posts.length)} published</p>
        <h1 className="notes-hero__title">
          Field notes<span>.</span>
        </h1>
        <p className="notes-hero__lede">
          What I learn, written down properly — step-by-step tutorials with commands you can copy and run, and honest numbers from my own hardware.
        </p>
      </section>

      <ol className="post-list">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`} className="post-row">
              <span className="post-row__n">{pad3(p.number)}</span>
              <span className="post-row__main">
                <span className="post-row__title">{p.title}</span>
                <span className="post-row__desc">{p.description}</span>
                <span className="post-row__meta">
                  {fmtDate(p.date)} · {p.minutes} min read
                  {p.tags.length > 0 && <> · {p.tags.join(" · ")}</>}
                </span>
              </span>
              <ArrowUpRight className="post-row__arr" size={20} aria-hidden />
            </Link>
          </li>
        ))}
        {!posts.length && <li className="post-empty">First note coming soon.</li>}
      </ol>
    </main>
  );
}
