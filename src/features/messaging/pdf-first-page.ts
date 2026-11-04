type PdfPreview = { image: string; pages: number };

const cache = new Map<string, Promise<PdfPreview | null>>();

async function renderFirstPage(data: ArrayBuffer): Promise<PdfPreview | null> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: Uint8Array.from(new Uint8Array(data)), isEvalSupported: false }).promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(1.4, 520 / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) return { image: "", pages: pdf.numPages };
    await page.render({ canvasContext: context, viewport }).promise;
    return { image: canvas.toDataURL("image/jpeg", 0.72), pages: pdf.numPages };
  } finally {
    void pdf.destroy();
  }
}

export function previewPdf(id: string, blob: Blob) {
  const existing = cache.get(id);
  if (existing) return existing;
  const pending = blob
    .arrayBuffer()
    .then(renderFirstPage)
    .catch(() => null);
  cache.set(id, pending);
  return pending;
}
