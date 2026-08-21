/**
 * PDF text extraction via pdfjs-dist.
 *
 * The worker bundle is attached to the global scope and pdf.js runs its
 * built-in main-thread fallback ("fake worker"). This avoids the
 * `?url` asset import, which doesn't survive every dev-server / preview
 * proxy setup — parsing works identically in dev, preview, and prod.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs");
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = "";
    for (const item of content.items as { str?: string; transform?: number[] }[]) {
      const str = item.str ?? "";
      const y = item.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) {
        parts.push(line.trimEnd());
        line = "";
      }
      line += str;
      if (str.endsWith(" ") === false && str.length > 0) line += " ";
      lastY = y;
    }
    if (line.trim()) parts.push(line.trimEnd());
    parts.push("");
  }
  const text = parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("No selectable text found in that PDF — try a text-based PDF or paste the raw text.");
  return text;
}
