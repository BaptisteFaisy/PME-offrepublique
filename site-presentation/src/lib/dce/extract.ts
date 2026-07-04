// Pipeline steps 3-4 — text extraction with page anchoring (server-only).
//
// - PDF: native text via pdfjs-dist, one logical page per PDF page. Pages that
//   come back near-empty are flagged as probably-scanned (OCR is out of scope at
//   MVP — the page is signalled, never silently dropped; CDC §6 robustness).
// - DOCX: mammoth (raw text), single logical page (DOCX has no page model).
// - XLSX: SheetJS, one logical page per worksheet.

import type { DceSettings } from "./config";

export type PageText = { pageNumber: number; text: string; ocrUsed: boolean };
export type ExtractResult = { pages: PageText[]; warnings: string[] };

async function extractPdf(
  content: Buffer,
  filename: string,
  settings: DceSettings,
): Promise<ExtractResult> {
  const result: ExtractResult = { pages: [], warnings: [] };
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch (err) {
    result.warnings.push(`${filename}: moteur PDF indisponible (${String(err)})`);
    return result;
  }

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(content), useSystemFonts: true });
  try {
    const doc = await loadingTask.promise;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const parts: string[] = [];
      for (const item of tc.items) {
        if ("str" in item) {
          parts.push(item.str);
          if (item.hasEOL) parts.push("\n");
        }
      }
      const text = parts.join("").replace(/[ \t]+\n/g, "\n").trim();
      const scanned = text.length < settings.ocrMinChars;
      result.pages.push({ pageNumber: i, text, ocrUsed: false });
      if (scanned) {
        result.warnings.push(
          `${filename} p.${i}: peu ou pas de texte — page probablement scannée (OCR non disponible).`,
        );
      }
      page.cleanup();
    }
  } catch (err) {
    result.warnings.push(`${filename}: PDF illisible (${String(err)})`);
  } finally {
    await loadingTask.destroy().catch(() => {});
  }
  return result;
}

async function extractDocx(content: Buffer, filename: string): Promise<ExtractResult> {
  const result: ExtractResult = { pages: [], warnings: [] };
  try {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer: content });
    result.pages.push({ pageNumber: 1, text: (value ?? "").trim(), ocrUsed: false });
  } catch (err) {
    result.warnings.push(`${filename}: DOCX illisible (${String(err)})`);
  }
  return result;
}

async function extractXlsx(content: Buffer, filename: string): Promise<ExtractResult> {
  const result: ExtractResult = { pages: [], warnings: [] };
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(content, { type: "buffer" });
    wb.SheetNames.forEach((name, index) => {
      const ws = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });
      const lines = [`[Feuille: ${name}]`];
      for (const row of rows) {
        const cells = (row as unknown[]).filter((v) => v != null && v !== "").map((v) => String(v));
        if (cells.length) lines.push(cells.join(" | "));
      }
      result.pages.push({ pageNumber: index + 1, text: lines.join("\n"), ocrUsed: false });
    });
  } catch (err) {
    result.warnings.push(`${filename}: XLSX illisible (${String(err)})`);
  }
  return result;
}

export async function extractText(
  filename: string,
  content: Buffer,
  settings: DceSettings,
): Promise<ExtractResult> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return extractPdf(content, filename, settings);
  if (lower.endsWith(".docx")) return extractDocx(content, filename);
  if (lower.endsWith(".xlsx")) return extractXlsx(content, filename);
  return { pages: [], warnings: [`${filename}: format non supporté`] };
}
