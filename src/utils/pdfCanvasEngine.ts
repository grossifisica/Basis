import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

// Connect the worker directly in-memory so there are zero network requests,
// zero blob workers, and zero cross-origin / iframe restrictions!
if (typeof window !== 'undefined') {
  (window as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;
  (globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;
}

export interface PdfEngineDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<any>;
  destroy?: () => void;
}

export interface PageRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

/**
 * Loads a real PDF binary (Blob or ArrayBuffer) into PDF.js in-memory engine.
 */
export async function loadRealPdf(blobOrBuffer: Blob | ArrayBuffer): Promise<PdfEngineDocument> {
  const arrayBuffer =
    blobOrBuffer instanceof Blob ? await blobOrBuffer.arrayBuffer() : blobOrBuffer;

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://unpkg.com/pdfjs-dist@6.3.289/cmaps/',
    cMapPacked: true,
  });

  return await loadingTask.promise;
}

/**
 * Renders a specific page of a PDF directly to an HTML5 Canvas with vector crispness.
 * Returns a cancelable PageRenderTask so that prior renders on the same canvas can be cleanly aborted.
 */
export function renderPageToCanvas(
  pdfDoc: PdfEngineDocument,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
  rotation: number
): PageRenderTask {
  let isCancelled = false;
  let activeRenderTask: any = null;

  const promise = (async () => {
    try {
      const page = await pdfDoc.getPage(pageNumber);
      if (isCancelled) return;

      const viewport = page.getViewport({ scale, rotation });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Clean white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      activeRenderTask = page.render(renderContext);
      await activeRenderTask.promise;
      ctx.restore();
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException') {
        // Expected cancellation when zoom, rotation, or page changes quickly
        return;
      }
      throw err;
    }
  })();

  return {
    promise,
    cancel: () => {
      isCancelled = true;
      if (activeRenderTask) {
        try {
          activeRenderTask.cancel();
        } catch {
          // ignore error on already finished task
        }
      }
    },
  };
}
