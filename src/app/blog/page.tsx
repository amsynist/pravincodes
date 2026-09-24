import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { fmtDate, getPosts, getUpcoming, pad3, type PostMeta } from "@/lib/blog";
import PostCover from "@/components/blog/PostArt";

export const metadata: Metadata = {
  title: "Notes — Praveen",
  description: "Hands-on notes and tutorials on AI models, infrastructure and the things I build.",
};

const acc = (p: PostMeta) => ({ ["--acc" as string]: p.accent }) as CSSProperties;

export default function NotesIndex() {
  const posts = getPosts();
  const soon = getUpcoming();
  return (
    <main className="notes-index">
      <section className="notes-hero">
        <p className="dotlabel">
          Notes · {pad3(posts.length)} published{soon.length > 0 && <> · {soon.length} in the works</>}
        </p>
        <h1 className="notes-hero__title">
          Field notes<span>.</span>
        </h1>
        <p className="notes-hero__lede">
          What I learn, written down properly — step-by-step tutorials with commands you can copy and run, and honest numbers from my own hardware.
        </p>
      </section>

      <ol className="deck">
        {posts.map((p, i) => (
          <li key={p.slug} className={i === 0 ? "deck__lead" : undefined}>
            <Link href={`/blog/${p.slug}`} className={`pcard ${i === 0 ? "pcard--lead" : ""}`} style={acc(p)}>
              <div className="pcard__art">
                <PostCover
                  src={p.cover}
                  priority={i === 0}
                  sizes={i === 0 ? "(max-width: 819px) 100vw, 620px" : "(max-width: 719px) 100vw, 560px"}
                />
              </div>
              <div className="pcard__body">
                <p className="pcard__kicker">
                  {i === 0 && <span className="pcard__new">Latest</span>}
                  {p.tags[0] ?? "Note"}
                </p>
                <h2 className="pcard__title">{p.title}</h2>
                <p className="pcard__desc">{p.description}</p>
                <p className="pcard__foot">
                  <span className="pcard__num">№ {pad3(p.number)}</span>
                  <span>{fmtDate(p.date)}</span>
                  <span>{p.minutes} min read</span>
                  <ArrowUpRight className="pcard__arr" size={18} aria-hidden />
                </p>
              </div>
            </Link>
          </li>
        ))}
        {!posts.length && <li className="post-empty">First note coming soon.</li>}
      </ol>

      {soon.length > 0 && (
        <section className="soon" aria-labelledby="soon-h">
          <h2 id="soon-h" className="soon__h">
            <span className="dotlabel">In the works</span>
          </h2>
          <ul className="soon__grid">
            {soon.map((p) => (
              <li key={p.slug} className="pcard pcard--soon" style={acc(p)}>
                <div className="pcard__art">
                  <PostCover src={p.cover} />
                </div>
                <div className="pcard__body">
                  <p className="pcard__kicker">
                    <span className="pcard__drafting">Drafting</span>
                    {p.tags[0] ?? "Note"}
                  </p>
                  <h3 className="pcard__title">{p.title}</h3>
                  {p.description && <p className="pcard__desc">{p.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
