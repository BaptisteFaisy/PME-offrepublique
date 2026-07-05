// Pipeline steps 3-4 — text extraction with page anchoring (server-only).
//
// - PDF: native text via pdfjs-dist, one logical page per PDF page. Pages that
//   come back near-empty are treated as scanned images: the page is rasterized
//   (pdfjs + @napi-rs/canvas) and read by the autonomous Tesseract OCR engine
//   (see ocr.ts). A failed OCR never sinks the rest of the DCE — the page is
//   kept and flagged (CDC §6).
// - Image files (jpg/png/tiff/webp/bmp): OCR'd directly, single logical page.
// - DOCX: mammoth (raw text), single logical page (DOCX has no page model).
// - XLSX: SheetJS, one logical page per worksheet.

import type { DceSettings } from "./config";
import { ocrImage } from "./ocr";

export type PageText = { pageNumber: number; text: string; ocrUsed: boolean };
export type ExtractResult = { pages: PageText[]; warnings: string[] };

// Image file extensions handled directly by OCR (whole file = one page).
export const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".bmp"];

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
    let ocrCount = 0;
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
      let text = parts.join("").replace(/[ \t]+\n/g, "\n").trim();
      let ocrUsed = false;

      if (text.length < settings.ocrMinChars) {
        // Sparse page -> likely scanned. Rasterize it and OCR the image.
        if (settings.ocrEnabled && ocrCount < settings.ocrMaxPages) {
          try {
            const { createCanvas } = await import("@napi-rs/canvas");
            const viewport = page.getViewport({ scale: settings.ocrScale });
            const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
            const ctx = canvas.getContext("2d");
            await page.render({
              canvasContext: ctx as unknown as CanvasRenderingContext2D,
              canvas: canvas as unknown as HTMLCanvasElement,
              viewport,
            }).promise;
            const ocrText = await ocrImage(canvas.toBuffer("image/png"));
            ocrCount++;
            if (ocrText.length > text.length) {
              text = ocrText;
              ocrUsed = true;
            }
            if (!ocrText) {
              result.warnings.push(`${filename} p.${i}: page scannée — OCR sans texte lisible.`);
            }
          } catch (err) {
            result.warnings.push(`${filename} p.${i}: OCR échoué (${String(err)}).`);
          }
        } else {
          const why = settings.ocrEnabled ? "quota OCR du document atteint" : "OCR désactivé";
          result.warnings.push(
            `${filename} p.${i}: peu ou pas de texte — page probablement scannée (${why}).`,
          );
        }
      }

      result.pages.push({ pageNumber: i, text, ocrUsed });
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

async function extractImage(
  content: Buffer,
  filename: string,
  settings: DceSettings,
): Promise<ExtractResult> {
  const result: ExtractResult = { pages: [], warnings: [] };
  if (!settings.ocrEnabled) {
    result.pages.push({ pageNumber: 1, text: "", ocrUsed: false });
    result.warnings.push(`${filename}: image non lue (OCR désactivé).`);
    return result;
  }
  try {
    const text = await ocrImage(content);
    result.pages.push({ pageNumber: 1, text, ocrUsed: true });
    if (!text) {
      result.warnings.push(`${filename}: image sans texte lisible (OCR vide).`);
    }
  } catch (err) {
    result.pages.push({ pageNumber: 1, text: "", ocrUsed: false });
    result.warnings.push(`${filename}: OCR de l'image échoué (${String(err)}).`);
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
  if (IMAGE_EXTS.some((ext) => lower.endsWith(ext))) {
    return extractImage(content, filename, settings);
  }
  return { pages: [], warnings: [`${filename}: format non supporté`] };
}
