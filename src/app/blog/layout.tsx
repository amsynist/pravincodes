import type { ReactNode } from "react";
import Link from "next/link";
import { identity, contact } from "@/data/portfolio";
import "./blog.css";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="notes">
      <header className="notes-nav">
        <Link href="/" className="brand notes-nav__brand" aria-label="Back to the portfolio">
          {identity.first.toUpperCase()}
          <sup>®</sup>
        </Link>
        <nav className="notes-nav__links">
          <Link href="/blog" className="notes-nav__link">Notes</Link>
          <a href={`mailto:${contact.email}`} className="notes-nav__link">Contact</a>
          <Link href="/" className="notes-nav__pill">Portfolio</Link>
        </nav>
      </header>
      {children}
      <footer className="notes-foot">
        <p>
          © {new Date().getFullYear()} {identity.first} · Notes on what I build and learn ·{" "}
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
        </p>
      </footer>
    </div>
  );
}
