import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The film frames are immutable: their URLs carry SEQ_VERSION (src/film/seq.ts), so the
        // browser may keep them for a year without ever revalidating. Regenerated frames get a
        // new version and therefore new URLs.
        source: "/seq/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
