import React from 'react';
import { BookOpen, Plus, LayoutGrid, List, RotateCcw, Search, Sparkles, Columns2 } from 'lucide-react';
import { ViewMode } from '../types';

interface NavbarProps {
  totalCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenUpload: () => void;
  onResetSamples: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalCount,
  viewMode,
  onViewModeChange,
  onOpenUpload,
  onResetSamples,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-900 text-lg tracking-tight">
                  Biblioteca de PDFs
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200">
                  {totalCount} {totalCount === 1 ? 'documento' : 'documentos'}
                </span>
              </div>
              <p className="text-xs text-stone-500 hidden md:block">
                Plataforma de publicação e leitura de documentos digitais
              </p>
            </div>
          </div>

          {/* Quick Search */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="search-input-navbar"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar por título, autor ou etiqueta..."
                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  id="clear-search-btn"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600 font-medium px-1.5 py-0.5"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center bg-stone-100 p-1 rounded-lg border border-stone-200">
              <button
                id="view-mode-embed-btn"
                onClick={() => onViewModeChange('embed')}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 text-xs ${
                  viewMode === 'embed'
                    ? 'bg-amber-400 text-stone-950 font-bold shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Modo Leitor Embed (Visualizador fixo incorporado no app)"
              >
                <Columns2 className="w-4 h-4" />
                <span>Leitor Embed</span>
              </button>
              <button
                id="view-mode-grid-btn"
                onClick={() => onViewModeChange('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-stone-900 shadow-xs font-medium'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Exibição em grade de cartões"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                id="view-mode-list-btn"
                onClick={() => onViewModeChange('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-stone-900 shadow-xs font-medium'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Exibição em lista detalhada"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Reset Samples */}
            <button
              id="reset-samples-btn"
              onClick={onResetSamples}
              className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors border border-transparent hover:border-stone-200"
              title="Restaurar acervo de exemplo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Primary Action: Disponibilizar PDF */}
            <button
              id="upload-pdf-primary-btn"
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Disponibilizar PDF</span>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden pb-3 pt-1">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="search-input-mobile"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por título, autor ou etiqueta..."
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
