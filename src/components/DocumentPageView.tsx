import React, { useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Printer,
  Search,
  BookOpen,
  Layers,
  FileText,
  Download,
  HardDrive,
  Calendar,
  User
} from 'lucide-react';
import { PdfDocument, DocumentPageData } from '../types';
import { formatBytes, formatDate } from '../utils/formatters';

interface DocumentPageViewProps {
  document: PdfDocument;
  pages: DocumentPageData[];
  onPageChange?: (page: number, total: number) => void;
  onDownload?: () => void;
}

export const DocumentPageView: React.FC<DocumentPageViewProps> = ({
  document,
  pages,
  onPageChange,
  onDownload,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>('continuous');
  const [searchTerm, setSearchTerm] = useState('');

  const safePages: DocumentPageData[] =
    pages && pages.length > 0
      ? pages
      : [
          {
            headerTitle: document.title,
            sections: [
              {
                heading: document.title,
                paragraphs: [
                  document.description || 'Documento carregado e pronto para leitura.',
                  `Autor: ${document.author} • Categoria: ${document.category}`,
                ],
              },
            ],
          },
        ];

  const totalPages = safePages.length;

  const handlePrev = () => {
    if (currentPage > 1) {
      const next = currentPage - 1;
      setCurrentPage(next);
      if (onPageChange) onPageChange(next, totalPages);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      if (onPageChange) onPageChange(next, totalPages);
    }
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 15, 160));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 15, 70));
  const handleResetZoom = () => setZoomLevel(100);

  const handlePrint = () => {
    window.print();
  };

  const highlightText = (text: string) => {
    if (!searchTerm.trim()) return text;
    const parts = text.split(new RegExp(`(${searchTerm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={i} className="bg-amber-300 text-stone-900 rounded-xs px-0.5 font-medium">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-900 overflow-hidden select-text">
      {/* Reader Secondary Toolbar */}
      <div className="h-12 bg-stone-950 border-b border-stone-800 px-3 sm:px-4 flex items-center justify-between gap-2 text-xs text-stone-300 shrink-0">
        {/* Left: View Mode Toggle & Page Navigation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-stone-900 p-0.5 rounded-lg border border-stone-800">
            <button
              id="doc-view-continuous-btn"
              onClick={() => setViewMode('continuous')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'continuous'
                  ? 'bg-amber-400 text-stone-950 font-semibold shadow-xs'
                  : 'text-stone-400 hover:text-white'
              }`}
              title="Exibir todas as páginas continuamente"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Rolo Contínuo</span>
            </button>
            <button
              id="doc-view-single-btn"
              onClick={() => setViewMode('single')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'single'
                  ? 'bg-amber-400 text-stone-950 font-semibold shadow-xs'
                  : 'text-stone-400 hover:text-white'
              }`}
              title="Exibir uma página por vez"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Página Única</span>
            </button>
          </div>

          {viewMode === 'single' ? (
            <div className="flex items-center gap-1 bg-stone-900 px-2 py-0.5 rounded-lg border border-stone-800">
              <button
                id="doc-prev-page-btn"
                onClick={handlePrev}
                disabled={currentPage <= 1}
                className="p-1 rounded text-stone-300 hover:text-white disabled:opacity-30"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-semibold px-1">
                {currentPage} / {totalPages}
              </span>
              <button
                id="doc-next-page-btn"
                onClick={handleNext}
                disabled={currentPage >= totalPages}
                className="p-1 rounded text-stone-300 hover:text-white disabled:opacity-30"
                title="Próxima página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-stone-400 font-medium hidden sm:inline-block bg-stone-900 px-2.5 py-1 rounded-lg border border-stone-800">
              {totalPages} {totalPages === 1 ? 'Página formatada' : 'Páginas formatadas'}
            </span>
          )}
        </div>

        {/* Search inside document */}
        <div className="relative max-w-xs w-48 hidden md:block">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="doc-search-text-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar no texto..."
            className="w-full pl-8 pr-3 py-1 bg-stone-900 border border-stone-800 rounded-lg text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        {/* Right: Zoom & Actions */}
        <div className="flex items-center gap-1.5">
          <button
            id="doc-zoom-out-btn"
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white"
            title="Diminuir tamanho do texto"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            onClick={handleResetZoom}
            className="text-[11px] font-semibold text-stone-300 px-1 w-12 text-center hover:text-white"
            title="Redefinir tamanho normal"
          >
            {zoomLevel}%
          </button>

          <button
            id="doc-zoom-in-btn"
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white"
            title="Aumentar tamanho do texto"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            id="doc-print-btn"
            onClick={handlePrint}
            className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white hidden sm:inline-flex"
            title="Imprimir documento"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Pages Canvas Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center bg-stone-950/60 scrollbar-thin scrollbar-thumb-stone-800">
        <div
          className="w-full max-w-3xl space-y-8 transition-all duration-150"
          style={{ fontSize: `${zoomLevel}%` }}
        >
          {safePages.map((page, index) => {
            const pageNum = index + 1;
            if (viewMode === 'single' && pageNum !== currentPage) {
              return null;
            }

            return (
              <article
                key={pageNum}
                id={`document-page-${pageNum}`}
                className="bg-white text-stone-900 rounded-xl shadow-2xl border border-stone-200 overflow-hidden relative"
              >
                {/* Simulated A4 Page Header Bar */}
                <header className="bg-stone-100/90 border-b border-stone-200 px-6 sm:px-8 py-3 flex items-center justify-between text-xs text-stone-600">
                  <div className="flex items-center gap-2 truncate">
                    <BookOpen className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span className="font-semibold text-stone-800 truncate uppercase tracking-wider text-[11px]">
                      {document.title}
                    </span>
                    <span className="text-stone-400">•</span>
                    <span className="text-stone-600 truncate">{page.headerTitle}</span>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold text-stone-700 bg-white px-2 py-0.5 rounded border border-stone-200">
                    Pág. {pageNum} / {totalPages}
                  </span>
                </header>

                {/* Page Content Body */}
                <div className="p-6 sm:p-10 space-y-6">
                  {/* Decorative top title on page 1 */}
                  {pageNum === 1 && (
                    <div className="border-b border-stone-100 pb-5 mb-6">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200 mb-2">
                        {document.category}
                      </span>
                      <h1 className="text-2xl sm:text-3xl font-bold text-stone-950 tracking-tight leading-snug">
                        {highlightText(document.title)}
                      </h1>
                      <div className="flex items-center gap-4 text-xs text-stone-500 mt-2">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {document.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(document.uploadedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3.5 h-3.5" />
                          {formatBytes(document.sizeBytes)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Sections */}
                  {page.sections.map((sec, secIdx) => (
                    <section key={secIdx} className="space-y-3">
                      {sec.heading && (
                        <div className="border-b border-amber-200/80 pb-1.5 pt-2">
                          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
                            {highlightText(sec.heading)}
                          </h2>
                        </div>
                      )}
                      {sec.paragraphs.map((p, pIdx) => (
                        <p
                          key={pIdx}
                          className="text-stone-800 text-sm sm:text-base leading-relaxed text-justify"
                        >
                          {highlightText(p)}
                        </p>
                      ))}
                    </section>
                  ))}
                </div>

                {/* Simulated A4 Page Footer Bar */}
                <footer className="bg-stone-50 border-t border-stone-200 px-6 sm:px-8 py-2.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>Autor: {document.author} • Biblioteca Digital</span>
                  <span>Página {pageNum} de {totalPages}</span>
                </footer>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};
