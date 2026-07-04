import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The internal MVP console lives in this same app under /dce (src/app/dce),
  // served on the same origin as the marketing site. No zones/rewrites needed.
};

export default nextConfig;
