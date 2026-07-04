/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Served as a Next.js Multi-Zone under the presentation site's /dce path.
  // basePath puts every route and _next asset under /dce, so the site's
  // rewrite (/dce/:path*) can proxy this whole app without asset collisions.
  // next/link + next/navigation prefix /dce automatically, so app code that
  // navigates to "/" or "/login" needs no change.
  basePath: "/dce",
  // Backend base URL is inlined at build time via NEXT_PUBLIC_API_URL.
};

export default nextConfig;
