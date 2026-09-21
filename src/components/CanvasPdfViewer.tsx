import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileText,
  StretchHorizontal,
  Sidebar,
  RefreshCw
} from 'lucide-react';
import { DocumentPageData } from '../types';
import {
  loadRealPdf,
  renderPageToCanvas,
  PdfEngineDocument,
  PageRenderTask
} from '../utils/pdfCanvasEngine';

interface CanvasPdfViewerProps {
  blob?: Blob | null;
  title: string;
  author?: string;
  pages?: DocumentPageData[];
  initialPage?: number;
  onPageChange?: (page: number, total: number) => void;
  onDownload?: () => void;
}

// Fallback 2D canvas renderer if binary PDF parser fails on a corrupt file
function renderFallbackPage(
  canvas: HTMLCanvasElement,
  page: DocumentPageData,
  pageIndex: number,
  totalPages: number,
  docTitle: string,
  docAuthor: string,
  scale: number,
  rotation: number
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const baseWidth = 595;
  const baseHeight = 842;
  const isRotated = rotation === 90 || rotation === 270;
  const canvasWidth = (isRotated ? baseHeight : baseWidth) * scale;
  const canvasHeight = (isRotated ? baseWidth : baseHeight) * scale;

  canvas.width = Math.floor(canvasWidth * dpr);
  canvas.height = Math.floor(canvasHeight * dpr);
  canvas.style.width = `${Math.floor(canvasWidth)}px`;
  canvas.style.height = `${Math.floor(canvasHeight)}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (rotation !== 0) {
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(
      (isRotated ? -canvasHeight : -canvasWidth) / 2,
      (isRotated ? -canvasWidth : -canvasHeight) / 2
    );
  }

  const s = scale;
  const marginX = 40 * s;

  // Header banner
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, baseWidth * s, 36 * s);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(0, 36 * s);
  ctx.lineTo(baseWidth * s, 36 * s);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = `600 ${10 * s}px sans-serif`;
  ctx.fillText(docTitle.substring(0, 45).toUpperCase(), marginX, 22 * s);

  ctx.fillStyle = '#64748b';
  ctx.font = `500 ${10 * s}px sans-serif`;
  const pageTag = `Página ${pageIndex} / ${totalPages}`;
  ctx.fillText(pageTag, baseWidth * s - marginX - ctx.measureText(pageTag).width, 22 * s);

  let currentY = 64 * s;

  if (pageIndex === 1) {
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${18 * s}px sans-serif`;
    ctx.fillText(docTitle, marginX, currentY);
    currentY += 26 * s;

    if (docAuthor) {
      ctx.fillStyle = '#64748b';
      ctx.font = `normal ${11 * s}px sans-serif`;
      ctx.fillText(`Autor: ${docAuthor}`, marginX, currentY);
      currentY += 18 * s;
    }

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(marginX, currentY);
    ctx.lineTo(marginX + 60 * s, currentY);
    ctx.stroke();
    currentY += 24 * s;
  }

  if (page.sections && page.sections.length > 0) {
    for (const section of page.sections) {
      if (currentY > (baseHeight - 60) * s) break;
      if (section.heading) {
        ctx.fillStyle = '#1e293b';
        ctx.font = `bold ${13 * s}px sans-serif`;
        ctx.fillText(section.heading, marginX, currentY);
        currentY += 18 * s;
      }
      ctx.fillStyle = '#334155';
      ctx.font = `normal ${11 * s}px sans-serif`;
      for (const p of section.paragraphs) {
        if (currentY > (baseHeight - 50) * s) break;
        ctx.fillText(p, marginX, currentY);
        currentY += 16 * s;
      }
      currentY += 10 * s;
    }
  }

  ctx.restore();
}

/**
 * Isolated Component per Page to strictly guarantee:
 * 1) No concurrent render() operations on the same canvas.
 * 2) Prior in-flight renders are safely cancelled on zoom/rotate/page change.
 */
interface PdfPageCanvasItemProps {
  pageNum: number;
  totalPages: number;
  docTitle: string;
  docAuthor: string;
  pdfDoc: PdfEngineDocument | null;
  pageData?: DocumentPageData;
  scale: number;
  rotation: number;
  isRealPdf: boolean;
  onPageRef?: (pageNum: number, el: HTMLDivElement | null) => void;
}

const PdfPageCanvasItem: React.FC<PdfPageCanvasItemProps> = ({
  pageNum,
  totalPages,
  docTitle,
  docAuthor,
  pdfDoc,
  pageData,
  scale,
  rotation,
  isRealPdf,
  onPageRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const activeTaskRef = useRef<PageRenderTask | null>(null);

  useEffect(() => {
    if (onPageRef) {
      onPageRef(pageNum, wrapperRef.current);
    }
    return () => {
      if (onPageRef) {
        onPageRef(pageNum, null);
      }
    };
  }, [pageNum, onPageRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Cancel previous render task if still in flight
    if (activeTaskRef.current) {
      activeTaskRef.current.cancel();
      activeTaskRef.current = null;
    }

    // 2. If real PDF is loaded, use PDF.js render engine
    if (isRealPdf && pdfDoc) {
      const task = renderPageToCanvas(pdfDoc, pageNum, canvas, scale, rotation);
      activeTaskRef.current = task;
      task.promise.catch((err) => {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Erro renderizando página ${pageNum} via PDF.js:`, err);
        }
      });
    } else {
      // Fallback 2D canvas drawing
      const fallbackData = pageData || {
        headerTitle: docTitle,
        sections: [
          {
            heading: docTitle,
            paragraphs: ['Visualizando documento incorporado no aplicativo.'],
          },
        ],
      };
      renderFallbackPage(canvas, fallbackData, pageNum, totalPages, docTitle, docAuthor, scale, rotation);
    }

    return () => {
      if (activeTaskRef.current) {
        activeTaskRef.current.cancel();
        activeTaskRef.current = null;
      }
    };
  }, [pageNum, pdfDoc, isRealPdf, scale, rotation, pageData, totalPages, docTitle, docAuthor]);

  return (
    <div
      ref={wrapperRef}
      id={`canvas-page-wrapper-${pageNum}`}
      className="relative bg-white shadow-2xl rounded-lg overflow-hidden border border-stone-300 transition-all flex flex-col items-center"
    >
      {/* Header badge with page indicator */}
      <div className="w-full bg-stone-100 border-b border-stone-200 px-3 py-1 flex items-center justify-between text-[10px] text-stone-600 select-none">
        <span className="font-semibold text-stone-800">
          {docTitle.substring(0, 40)}
        </span>
        <span className="bg-stone-200 px-2 py-0.5 rounded font-mono font-bold">
          Página {pageNum} / {totalPages}
        </span>
      </div>

      <canvas ref={canvasRef} className="block mx-auto" />
    </div>
  );
};

export const CanvasPdfViewer: React.FC<CanvasPdfViewerProps> = ({
  blob,
  title,
  author = '',
  pages = [],
  initialPage = 1,
  onPageChange,
}) => {
  const [scale, setScale] = useState(1.15);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(pages.length > 0 ? pages.length : 1);
  const [renderMode, setRenderMode] = useState<'continuous' | 'single'>('continuous');
  const [showThumbnails, setShowThumbnails] = useState(false);

  // PDF engine state
  const [pdfDoc, setPdfDoc] = useState<PdfEngineDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRealPdf, setIsRealPdf] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageElementRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const handlePageRef = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      pageElementRefs.current.set(pageNum, el);
    } else {
      pageElementRefs.current.delete(pageNum);
    }
  }, []);

  // Load the PDF into memory
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    async function loadDocument() {
      if (blob) {
        try {
          const doc = await loadRealPdf(blob);
          if (isCancelled) return;
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setIsRealPdf(true);
          setIsLoading(false);
          return;
        } catch (err: any) {
          console.warn('Falha ao carregar binário PDF com motor principal, usando renderizador de contingência:', err);
        }
      }

      // Fallback if blob loading failed or blob is not present
      if (isCancelled) return;
      setIsRealPdf(false);
      setPdfDoc(null);
      const count = pages.length > 0 ? pages.length : 1;
      setTotalPages(count);
      setIsLoading(false);
    }

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [blob, pages]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const next = currentPage - 1;
      setCurrentPage(next);
      if (onPageChange) onPageChange(next, totalPages);
      if (renderMode === 'continuous') {
        const target = pageElementRefs.current.get(next);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      if (onPageChange) onPageChange(next, totalPages);
      if (renderMode === 'continuous') {
        const target = pageElementRefs.current.get(next);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.15, 2.5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.15, 0.5));

  const handleFitWidth = () => {
    if (!containerRef.current) return;
    const availableWidth = containerRef.current.clientWidth - (showThumbnails ? 220 : 64);
    const calculatedScale = Math.max(0.6, Math.min(2.0, availableWidth / 620));
    setScale(parseFloat(calculatedScale.toFixed(2)));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const jumpToPage = (pageNum: number) => {
    setCurrentPage(pageNum);
    if (onPageChange) onPageChange(pageNum, totalPages);
    if (renderMode === 'continuous') {
      const target = pageElementRefs.current.get(pageNum);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-900 overflow-hidden select-none">
      {/* Canvas Controls Toolbar */}
      <div className="h-12 bg-stone-950 border-b border-stone-800 px-3 sm:px-4 flex items-center justify-between gap-2 text-xs text-stone-300 shrink-0">
        {/* Left: Mode Toggle & Navigation */}
        <div className="flex items-center gap-2">
          {/* Thumbnails Sidebar Toggle */}
          <button
            id="canvas-toggle-thumbnails-btn"
            onClick={() => setShowThumbnails(!showThumbnails)}
            className={`p-1.5 rounded-lg border transition-colors ${
              showThumbnails
                ? 'bg-amber-400 text-stone-950 border-amber-400 font-bold'
                : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white'
            }`}
            title="Mostrar / Ocultar miniaturas"
          >
            <Sidebar className="w-4 h-4" />
          </button>

          {/* Continuous vs Single Page Mode */}
          <div className="flex items-center bg-stone-900 p-0.5 rounded-lg border border-stone-800">
            <button
              id="canvas-render-mode-continuous-btn"
              onClick={() => setRenderMode('continuous')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                renderMode === 'continuous'
                  ? 'bg-amber-400 text-stone-950 font-bold shadow-xs'
                  : 'text-stone-400 hover:text-white'
              }`}
              title="Rolagem vertical contínua de todas as páginas"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Contínuo</span>
            </button>
            <button
              id="canvas-render-mode-single-btn"
              onClick={() => setRenderMode('single')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                renderMode === 'single'
                  ? 'bg-amber-400 text-stone-950 font-bold shadow-xs'
                  : 'text-stone-400 hover:text-white'
              }`}
              title="Exibição de uma página por vez"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Página Única</span>
            </button>
          </div>

          {/* Page Indicator & Navigator */}
          <div className="flex items-center gap-1 bg-stone-900 px-2 py-0.5 rounded-lg border border-stone-800">
            <button
              id="canvas-prev-page-btn"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="p-1 rounded text-stone-300 hover:text-white disabled:opacity-30"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-semibold px-1 whitespace-nowrap">
              {currentPage} / {totalPages}
            </span>
            <button
              id="canvas-next-page-btn"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className="p-1 rounded text-stone-300 hover:text-white disabled:opacity-30"
              title="Próxima página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Zoom & Rotation Controls */}
        <div className="flex items-center gap-1.5">
          <button
            id="canvas-zoom-out-btn"
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white transition-colors"
            title="Diminuir Zoom (-15%)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-[11px] font-semibold text-stone-300 px-1 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            id="canvas-zoom-in-btn"
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white transition-colors"
            title="Aumentar Zoom (+15%)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            id="canvas-fit-width-btn"
            onClick={handleFitWidth}
            className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white transition-colors hidden sm:inline-flex items-center gap-1"
            title="Ajustar à Largura da Tela"
          >
            <StretchHorizontal className="w-4 h-4" />
            <span className="text-[10px] hidden md:inline">Ajustar</span>
          </button>

          <button
            id="canvas-rotate-btn"
            onClick={handleRotate}
            className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white transition-colors"
            title="Girar 90 graus"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Body: Sidebar (Thumbnails) + Canvas Scroll Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Thumbnails Sidebar */}
        {showThumbnails && (
          <aside className="w-44 sm:w-52 bg-stone-950 border-r border-stone-800 flex flex-col shrink-0 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-stone-800">
            <div className="text-[11px] font-semibold text-stone-400 px-1 uppercase tracking-wider">
              Páginas ({totalPages})
            </div>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={`thumb-${pageNum}`}
                onClick={() => jumpToPage(pageNum)}
                className={`w-full text-left rounded-lg p-2 transition-all border ${
                  currentPage === pageNum
                    ? 'bg-amber-400/10 border-amber-400 shadow-xs'
                    : 'bg-stone-900 border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="aspect-[1/1.4] bg-white rounded flex items-center justify-center text-stone-900 text-xs font-bold shadow-xs mb-1.5">
                  <span className="text-stone-500 font-mono text-xs">{pageNum}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span
                    className={
                      currentPage === pageNum ? 'text-amber-400 font-bold' : 'text-stone-400'
                    }
                  >
                    Pág. {pageNum}
                  </span>
                  {currentPage === pageNum && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  )}
                </div>
              </button>
            ))}
          </aside>
        )}

        {/* Canvas Scroll Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center bg-stone-950/70 scrollbar-thin scrollbar-thumb-stone-800"
        >
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-3" />
              <p className="text-sm font-semibold text-stone-200">
                Renderizando documento PDF no aplicativo...
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Processando páginas em alta definição com o motor embed
              </p>
            </div>
          ) : renderMode === 'single' ? (
            /* Single Page View */
            <div className="flex flex-col items-center my-auto">
              <PdfPageCanvasItem
                key={`single-${currentPage}`}
                pageNum={currentPage}
                totalPages={totalPages}
                docTitle={title}
                docAuthor={author}
                pdfDoc={pdfDoc}
                pageData={pages[currentPage - 1] || pages[0]}
                scale={scale}
                rotation={rotation}
                isRealPdf={isRealPdf}
              />
              <div className="mt-3 text-xs text-stone-400 font-medium">
                Página {currentPage} de {totalPages}
              </div>
            </div>
          ) : (
            /* Continuous Multi-Page Scroll View */
            <div className="flex flex-col items-center w-full max-w-4xl space-y-8 pb-12">
              {Array.from({ length: totalPages }, (_, idx) => {
                const pageNum = idx + 1;
                return (
                  <PdfPageCanvasItem
                    key={`continuous-${pageNum}`}
                    pageNum={pageNum}
                    totalPages={totalPages}
                    docTitle={title}
                    docAuthor={author}
                    pdfDoc={pdfDoc}
                    pageData={pages[idx]}
                    scale={scale}
                    rotation={rotation}
                    isRealPdf={isRealPdf}
                    onPageRef={handlePageRef}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
