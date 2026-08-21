import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

/** Extract structured plain text from an uploaded resume PDF. */
export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const doc = await getDocument({ data: buf }).promise;
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
      if (str.length > 0) line += " ";
      lastY = y;
    }
    if (line.trim()) parts.push(line.trimEnd());
    parts.push("");
  }
  const text = parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("No selectable text found in that PDF — try a text-based PDF or paste the raw text.");
  return text;
}
