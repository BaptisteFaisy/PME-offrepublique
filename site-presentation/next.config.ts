import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Multi-Zones: this marketing site is the default zone owning "/*". It proxies
  // the internal MVP (a separate Next.js app with basePath "/dce") under /dce.
  // MVP_ORIGIN is the MVP frontend zone's URL, baked into the routes manifest at
  // BUILD time — it must be set before `next build` on Railway. When unset (e.g.
  // local site-only dev), /dce simply 404s here instead of breaking the build.
  async rewrites() {
    const mvp = process.env.MVP_ORIGIN;
    if (!mvp) return [];
    return [
      { source: "/dce", destination: `${mvp}/dce` },
      { source: "/dce/:path*", destination: `${mvp}/dce/:path*` },
    ];
  },
};

export default nextConfig;
