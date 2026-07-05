import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The internal MVP console lives in this same app under /dce (src/app/dce).
  // M1's document-processing pipeline runs server-side in route handlers under
  // /dce/api; these native/heavy libraries must stay external to the bundler.
  serverExternalPackages: [
    "pdfjs-dist",
    "@napi-rs/canvas",
    "tesseract.js",
    "mammoth",
    "xlsx",
    "@anthropic-ai/sdk",
  ],
};

export default nextConfig;
