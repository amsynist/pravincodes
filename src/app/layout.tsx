import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted (OFL): Outfit (headings + wordmark), Geist (text), Geist Mono (small metadata)
const head = localFont({ src: "./fonts/Outfit-Variable.woff2", variable: "--font-head", weight: "100 900", display: "swap" });
const sans = localFont({ src: "./fonts/Geist-Variable.woff2", variable: "--font-sans", weight: "100 900", display: "swap" });
const mono = localFont({ src: "./fonts/GeistMono-Variable.woff2", variable: "--font-mono", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: "Praveen — AI Full-Stack Engineer",
  description:
    "Praveen builds AI systems that listen, reason and ship: voice agents, retrieval pipelines, and the infrastructure behind them.",
};

export const viewport: Viewport = {
  themeColor: "#04050c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${head.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        <link rel="preload" as="image" href="/seq/lg/001.webp" />
      </head>
      <body>{children}</body>
    </html>
  );
}
