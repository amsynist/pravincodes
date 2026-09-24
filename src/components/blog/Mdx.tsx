import type { ComponentProps, ReactNode } from "react";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypePrettyCode from "rehype-pretty-code";
import GithubSlugger from "github-slugger";
import { Link2 } from "lucide-react";
import CodeBlock from "./CodeBlock";
import { Tabs, Tab } from "./Tabs";
import { Note, Tip, Warn, Specs, Step, Download } from "./Callout";
import { notesTheme } from "./theme";
import type { TocItem } from "./Toc";

/* Headings carry a hover anchor so any section can be linked to directly. */
function heading(Tag: "h2" | "h3") {
  const H = ({ id, children, ...rest }: ComponentProps<"h2">) => (
    <Tag id={id} {...rest}>
      <a href={`#${id}`} className="anchor" aria-label="Link to this section">
        <Link2 size={15} aria-hidden />
      </a>
      {children}
    </Tag>
  );
  H.displayName = Tag.toUpperCase();
  return H;
}

const Ext = ({ href = "", children, ...rest }: ComponentProps<"a">) => {
  const external = /^https?:\/\//.test(href);
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} {...rest}>
      {children}
    </a>
  );
};

const Table = (p: ComponentProps<"table">) => (
  <div className="table-wrap">
    <table {...p} />
  </div>
);

export const mdxComponents = {
  h2: heading("h2"),
  h3: heading("h3"),
  a: Ext,
  pre: CodeBlock,
  table: Table,
  Tabs,
  Tab,
  Note,
  Tip,
  Warn,
  Specs,
  Step,
  Download,
};

export async function renderMdx(source: string): Promise<ReactNode> {
  const { content } = await compileMDX({
    source,
    components: mdxComponents,
    options: {
      // posts are our own files: allow {…} props such as <Specs items={[…]} /> and <Step n={1} />
      blockJS: false,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          // build-time highlighting (zero JS in the browser); ```bash title="setup.sh" {3-4}```
          [rehypePrettyCode, { theme: notesTheme, keepBackground: false, defaultLang: "plaintext" }],
        ],
      },
    },
  });
  return content;
}

/** Table of contents from the source's ## / ### headings (same slugs rehype-slug gives them). */
export function tocFrom(source: string): TocItem[] {
  const slugger = new GithubSlugger();
  const out: TocItem[] = [];
  let fence = false;
  for (const line of source.split("\n")) {
    if (/^\s*```/.test(line)) fence = !fence;
    if (fence) continue;
    const m = /^(##|###)\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const text = m[2].replace(/`/g, "").replace(/\*\*/g, "");
    out.push({ id: slugger.slug(text), text, depth: m[1] === "##" ? 2 : 3 });
  }
  return out;
}
