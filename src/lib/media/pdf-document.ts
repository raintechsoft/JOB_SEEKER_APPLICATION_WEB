import type { PDFDocumentProxy } from "pdfjs-dist";

const documents = new Map<string, Promise<PDFDocumentProxy | null>>();

export function isPdfAttachment(item: { name?: string; src: string }) {
  const name = item.name ?? "";
  return (
    /\.pdf$/i.test(name) ||
    /\.pdf($|\?)/i.test(item.src) ||
    /^data:application\/pdf/i.test(item.src) ||
    /^blob:/i.test(item.src) && /\.pdf$/i.test(name)
  );
}

export async function loadPdfDocument(src: string): Promise<PDFDocumentProxy | null> {
  const existing = documents.get(src);
  if (existing) return existing;
  const pending = (async () => {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const response = await fetch(src, { credentials: "include" });
    if (!response.ok) return null;
    const data = new Uint8Array(await response.arrayBuffer());
    return pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  })().catch(() => null);
  documents.set(src, pending);
  return pending;
}

export async function renderPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  maxWidth: number,
  zoom = 1,
) {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const fit = maxWidth / base.width;
  const scale = Math.min(4, Math.max(0.4, fit * zoom));
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d");
  if (!context) return;
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
}
