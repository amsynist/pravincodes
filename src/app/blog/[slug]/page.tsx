import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { fmtDate, getPost, getPosts, pad3 } from "@/lib/blog";
import { renderMdx, tocFrom } from "@/components/blog/Mdx";
import Toc from "@/components/blog/Toc";
import Progress from "@/components/blog/Progress";
import PostCover from "@/components/blog/PostArt";

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return { title: `${post.title} — Praveen`, description: post.description };
}

export default async function NotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const content = await renderMdx(post.body);
  const toc = tocFrom(post.body);
  const all = getPosts();
  const i = all.findIndex((p) => p.slug === slug);
  const newer = all[i - 1];
  const older = all[i + 1];

  return (
    <main className="note" style={{ ["--acc" as string]: post.accent }}>
      <Progress />
      <section className="note-hero">
        {/* the card's cover, pre-blurred (cover-blur.webp is ~1 KB) and stretched behind the header */}
        <div className="note-hero__bg" style={{ backgroundImage: `url(${post.coverBlur})` }} aria-hidden />
      <header className="note-head">
        <Link href="/blog" className="note-back">
          <ArrowLeft size={15} aria-hidden /> All notes
        </Link>
        <p className="dotlabel">
          Note {pad3(post.number)}
          {post.tags[0] && <> · {post.tags[0]}</>}
        </p>
        <h1 className="note-title">{post.title}</h1>
        {post.description && <p className="note-lede">{post.description}</p>}
        <p className="note-meta">
          <span>{fmtDate(post.date)}</span>
          <span>{post.minutes} min read</span>
          {post.tags.slice(1).map((t) => (
            <span key={t} className="note-tag">{t}</span>
          ))}
        </p>
        <figure className="note-plate" aria-hidden>
          <PostCover src={post.cover} sizes="(max-width: 999px) 100vw, 460px" priority />
        </figure>
      </header>
      </section>

      <div className="note-grid">
        <aside className="note-side">
          <Toc items={toc} />
        </aside>
        <article className="note-body">
          {toc.length > 2 && (
            <details className="toc-m">
              <summary>On this page</summary>
              <ol>
                {toc
                  .filter((t) => t.depth === 2)
                  .map((t, k) => (
                    <li key={t.id}>
                      <a href={`#${t.id}`}>
                        <span>{String(k + 1).padStart(2, "0")}</span>
                        {t.text}
                      </a>
                    </li>
                  ))}
              </ol>
            </details>
          )}
          {content}
        </article>
      </div>

      <nav className="note-pager" aria-label="More notes">
        {older ? (
          <Link href={`/blog/${older.slug}`} className="note-pager__a">
            <ArrowLeft size={15} aria-hidden />
            <span><small>Previous</small>{older.title}</span>
          </Link>
        ) : <span />}
        {newer ? (
          <Link href={`/blog/${newer.slug}`} className="note-pager__a note-pager__a--next">
            <span><small>Next</small>{newer.title}</span>
            <ArrowRight size={15} aria-hidden />
          </Link>
        ) : (
          <Link href="/blog" className="note-pager__a note-pager__a--next">
            <span><small>Back to</small>All notes</span>
            <ArrowRight size={15} aria-hidden />
          </Link>
        )}
      </nav>
    </main>
  );
}
