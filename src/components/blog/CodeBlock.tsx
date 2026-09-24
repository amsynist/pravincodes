"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Check, Copy } from "lucide-react";

const SHELL = new Set(["bash", "sh", "shell", "zsh", "powershell", "ps1", "fish"]);

/**
 * A code block as a terminal card: language (or file name, from ```lang title="…"```) on the
 * left, Copy on the right. Shell blocks get a `$` on each command line — drawn with CSS, so
 * it's never selected or copied: what you paste runs as-is.
 */
export default function CodeBlock(props: ComponentProps<"pre"> & { "data-language"?: string }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const lang = (props["data-language"] ?? "").toLowerCase();
  const shell = SHELL.has(lang);

  // mark the lines that start a command (not continuation lines after "\", comments or blanks)
  useEffect(() => {
    if (!shell || !ref.current) return;
    let prevContinues = false;
    ref.current.querySelectorAll<HTMLElement>("[data-line]").forEach((line) => {
      const text = line.textContent ?? "";
      const isCmd = !prevContinues && text.trim() !== "" && !text.trim().startsWith("#");
      if (isCmd) line.setAttribute("data-prompt", "");
      prevContinues = /\\\s*$/.test(text) || /(&&|\|)\s*$/.test(text);
    });
  }, [shell]);

  const copy = async () => {
    const code = ref.current?.querySelector("code")?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(code.replace(/\n$/, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked (http / old browser): the text is still selectable */
    }
  };

  return (
    <>
      <div className="code__bar">
        <span className="code__lang">{lang || "text"}</span>
        <button type="button" className="code__copy" onClick={copy} aria-label={copied ? "Copied" : "Copy code"}>
          {copied ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre ref={ref} {...props} data-shell={shell ? "" : undefined} />
    </>
  );
}
