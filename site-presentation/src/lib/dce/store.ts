// Light file-based store for M1 (server-only).
//
// One JSON record per upload under DCE_DATA_DIR/<uploadId>/record.json. Writes
// are atomic (temp + rename) so a concurrent status poll never reads a partial
// file. For a 2-user internal tool this is plenty; point DCE_DATA_DIR at a
// Railway volume so records survive redeploys.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { Fiche, GoNoGo } from "@/lib/api";

import { getSettings } from "./config";

export type UploadStatus = "received" | "processing" | "ready" | "failed";

export type StoredPage = { page_number: number; text: string; ocr_used: boolean };
export type StoredPiece = {
  id: string;
  filename: string;
  piece_type: string;
  page_count: number;
  pages: StoredPage[];
};
export type StoredFiche = {
  fiche: Fiche;
  gonogo: GoNoGo;
  warnings: string[];
  model: string | null;
};
export type StoredUpload = {
  id: string;
  original_filename: string;
  status: UploadStatus;
  error: string | null;
  created_at: string;
  pieces: StoredPiece[];
  fiche: StoredFiche | null;
};

export function newId(): string {
  return crypto.randomUUID();
}

function recordPath(id: string): string {
  return path.join(getSettings().dataDir, id, "record.json");
}

async function writeRecord(rec: StoredUpload): Promise<void> {
  const file = recordPath(rec.id);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rec), "utf8");
  await fs.rename(tmp, file);
}

export async function createUpload(id: string, originalFilename: string): Promise<StoredUpload> {
  const rec: StoredUpload = {
    id,
    original_filename: originalFilename,
    status: "received",
    error: null,
    created_at: new Date().toISOString(),
    pieces: [],
    fiche: null,
  };
  await writeRecord(rec);
  return rec;
}

/** Persist the raw upload bytes so the parse job is replayable across restarts. */
export async function saveRaw(id: string, data: Buffer): Promise<void> {
  const file = path.join(getSettings().dataDir, id, "upload.bin");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

export async function readRaw(id: string): Promise<Buffer> {
  return fs.readFile(path.join(getSettings().dataDir, id, "upload.bin"));
}

export async function getUpload(id: string): Promise<StoredUpload | null> {
  try {
    const raw = await fs.readFile(recordPath(id), "utf8");
    return JSON.parse(raw) as StoredUpload;
  } catch {
    return null;
  }
}

export async function saveUpload(rec: StoredUpload): Promise<void> {
  await writeRecord(rec);
}

/** Merge-patch a stored upload; returns null if it does not exist. */
export async function patchUpload(
  id: string,
  patch: Partial<StoredUpload>,
): Promise<StoredUpload | null> {
  const rec = await getUpload(id);
  if (!rec) return null;
  const next = { ...rec, ...patch };
  await writeRecord(next);
  return next;
}
