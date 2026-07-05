// Pipeline step 1 — recursive unzip + dedup (server-only).
//
// A DCE arrives as a ZIP (often with nested ZIPs) or as loose files. We walk it
// recursively, keep only the formats we can parse (PDF/DOCX/XLSX + image files
// handled via OCR), and drop byte-identical duplicates (the same annexe shipped
// in several sub-folders is common).

import crypto from "node:crypto";

import { unzipSync } from "fflate";

import { IMAGE_EXTS } from "./extract";

const SUPPORTED = [".pdf", ".docx", ".xlsx", ...IMAGE_EXTS];
const MAX_ZIP_DEPTH = 8;

export type ExtractedFile = {
  filename: string; // archive-relative path, or the upload name
  content: Buffer;
  sha256: string;
};

function isSupported(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED.some((s) => lower.endsWith(s));
}

function isIgnored(name: string): boolean {
  const base = name.split("/").pop() ?? name;
  return name.includes("__MACOSX") || base.startsWith("._") || base.startsWith(".");
}

function looksLikeZip(buf: Buffer): boolean {
  // Local file header "PK\x03\x04" or empty-archive "PK\x05\x06".
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 3 || buf[2] === 5);
}

export function extractUpload(data: Buffer, originalFilename: string): ExtractedFile[] {
  const seen = new Set<string>();
  const out: ExtractedFile[] = [];

  function add(name: string, content: Buffer) {
    const digest = crypto.createHash("sha256").update(content).digest("hex");
    if (seen.has(digest)) return;
    seen.add(digest);
    out.push({ filename: name, content, sha256: digest });
  }

  function walkZip(blob: Buffer, prefix: string, depth: number) {
    if (depth > MAX_ZIP_DEPTH) return;
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(new Uint8Array(blob));
    } catch {
      return; // not a valid zip; skip
    }
    for (const [entryName, bytes] of Object.entries(entries)) {
      if (!bytes || bytes.length === 0) continue; // directory entry
      if (isIgnored(entryName)) continue;
      const name = prefix ? `${prefix}/${entryName}` : entryName;
      const content = Buffer.from(bytes);
      const lower = entryName.toLowerCase();
      if (lower.endsWith(".zip")) {
        walkZip(content, name, depth + 1);
      } else if (isSupported(lower)) {
        add(name, content);
      }
    }
  }

  if (originalFilename.toLowerCase().endsWith(".zip") || looksLikeZip(data)) {
    walkZip(data, "", 0);
  } else if (isSupported(originalFilename)) {
    add(originalFilename, data);
  }

  return out;
}
