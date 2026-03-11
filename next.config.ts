import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // Static HTML export for Firebase Hosting
  // Rewrites only apply during `next dev` — static export ignores them.
  // Mirrors the Firebase Hosting rewrite: /news/** → /news.html
  async rewrites() {
    return [
      {
        source: "/news/:slug*",
        destination: "/news",
      },
    ];
  },
};

export default nextConfig;
