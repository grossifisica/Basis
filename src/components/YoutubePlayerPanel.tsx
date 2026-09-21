import React, { useState } from 'react';
import {
  Youtube,
  X,
  Maximize2,
  Minimize2,
  LayoutTemplate,
  Film,
  Repeat,
  ChevronRight,
  PlayCircle,
  ListVideo,
  HardDrive,
  Video,
  ExternalLink,
} from 'lucide-react';
import { detectVideoInfo, VideoDetails } from '../utils/formatters';

export interface VideoItem {
  url: string;
  id?: string;
  title: string;
  type?: 'youtube' | 'drive' | 'other';
  driveFileId?: string;
  youtubeVideoId?: string;
  embedUrl?: string;
  thumbnailUrl?: string;
}

interface YoutubePlayerPanelProps {
  youtubeUrl?: string;
  youtubeVideoId?: string;
  youtubeLinks?: string[];
  videos?: VideoItem[];
  selectedVideoIndex?: number;
  onSelectVideoIndex?: (index: number) => void;
  onToggleNextVideo?: () => void;
  documentTitle: string;
  layoutMode: 'split' | 'floating' | 'video-only';
  onToggleLayoutMode: () => void;
  onClose: () => void;
  onAddTimestampNote?: (timestampNote: string) => void;
  hasFooter?: boolean;
}

export const YoutubePlayerPanel: React.FC<YoutubePlayerPanelProps> = ({
  youtubeUrl,
  youtubeVideoId,
  youtubeLinks = [],
  videos = [],
  selectedVideoIndex = 0,
  onSelectVideoIndex,
  onToggleNextVideo,
  documentTitle,
  layoutMode,
  onToggleLayoutMode,
  onClose,
  onAddTimestampNote,
  hasFooter = false,
}) => {
  const [isFloatingExpanded, setIsFloatingExpanded] = useState(false);
  const currentVideoItem = videos[selectedVideoIndex];
  const currentRawUrl =
    currentVideoItem?.url ||
    youtubeLinks[selectedVideoIndex] ||
    youtubeUrl ||
    (youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : '');

  // Detect video info (Google Drive, YouTube, or direct)
  const detectedInfo: VideoDetails | null = detectVideoInfo(currentRawUrl);
  const activeEmbedUrl = currentVideoItem?.embedUrl || detectedInfo?.embedUrl || null;
  const isDriveVideo =
    currentVideoItem?.type === 'drive' ||
    detectedInfo?.type === 'drive' ||
    Boolean(currentVideoItem?.driveFileId);
  const isYoutubeVideo =
    currentVideoItem?.type === 'youtube' ||
    detectedInfo?.type === 'youtube' ||
    Boolean(currentVideoItem?.youtubeVideoId);

  const totalVideos = Math.max(youtubeLinks.length, videos.length);
  const hasMultipleVideos = totalVideos > 1;
  const currentVideoTitle = currentVideoItem?.title || `Vídeo ${selectedVideoIndex + 1}`;

  return (
    <div
      id="youtube-player-panel"
      className={`flex flex-col bg-stone-900 text-stone-100 transition-all ${
        layoutMode === 'floating'
          ? `fixed z-50 ${
              isFloatingExpanded
                ? 'w-[540px] sm:w-[640px] md:w-[720px]'
                : 'w-[380px] sm:w-[480px] md:w-[520px]'
            } max-w-[calc(100vw-24px)] rounded-xl border border-stone-700/90 shadow-2xl shadow-stone-950/90 overflow-hidden ${
              hasFooter
                ? 'bottom-16 sm:bottom-16 right-3 sm:right-6'
                : 'bottom-4 sm:bottom-6 right-3 sm:right-6'
            }`
          : 'w-full h-full border-0 overflow-hidden'
      }`}
    >
      {/* Panel Header */}
      <div className="bg-stone-950/95 border-b border-stone-800 px-3.5 py-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${
              isDriveVideo
                ? 'bg-sky-500/20 border-sky-400/30 text-sky-400'
                : 'bg-red-600/20 border-red-500/30 text-red-500'
            }`}
          >
            {isDriveVideo ? (
              <HardDrive className="w-3.5 h-3.5" />
            ) : isYoutubeVideo ? (
              <Youtube className="w-3.5 h-3.5" />
            ) : (
              <Video className="w-3.5 h-3.5 text-amber-400" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
              <span className="truncate max-w-[130px] sm:max-w-[220px]">
                {layoutMode === 'floating'
                  ? currentVideoTitle
                  : 'Vídeo'}
              </span>
              {hasMultipleVideos && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-stone-800 text-stone-300 border border-stone-700 shrink-0">
                  {selectedVideoIndex + 1}/{totalVideos}
                </span>
              )}
            </h4>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Alternar Vídeo Button in Header */}
          {hasMultipleVideos && onToggleNextVideo && (
            <button
              onClick={onToggleNextVideo}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-white text-[11px] font-bold transition-all shadow-xs shrink-0 cursor-pointer ${
                isDriveVideo
                  ? 'bg-sky-600 hover:bg-sky-500'
                  : 'bg-red-600 hover:bg-red-500'
              }`}
              title="Alternar para o próximo vídeo"
            >
              <Repeat className="w-3 h-3" />
              <span className="hidden sm:inline">Próximo</span>
            </button>
          )}

          {/* Open original link in new tab */}
          {currentRawUrl && (
            <a
              href={currentRawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              title="Abrir vídeo em nova guia (Google Drive / YouTube)"
            >
              <ExternalLink className="w-3.5 h-3.5 text-stone-300 hover:text-amber-400" />
            </a>
          )}

          {/* If floating, allow expanding/reducing the floating size */}
          {layoutMode === 'floating' && (
            <button
              onClick={() => setIsFloatingExpanded(!isFloatingExpanded)}
              className="p-1.5 rounded-md text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              title={isFloatingExpanded ? 'Reduzir tamanho do player' : 'Expandir tamanho do player'}
            >
              {isFloatingExpanded ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Toggle Layout (Floating PiP vs Split) */}
          <button
            onClick={onToggleLayoutMode}
            className="p-1.5 rounded-md text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            title={
              layoutMode === 'split'
                ? 'Mudar para Mini Player Flutuante (PiP)'
                : 'Mudar para Divisão Lado a Lado'
            }
          >
            {layoutMode === 'split' ? (
              <LayoutTemplate className="w-3.5 h-3.5" />
            ) : (
              <LayoutTemplate className="w-3.5 h-3.5 text-amber-400" />
            )}
          </button>

          {/* Close / Minimize Panel */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
            title="Ocultar player de vídeo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Multi-video quick switch bar (if more than 1 video) */}
      {hasMultipleVideos && (
        <div className="bg-stone-950 px-3 py-1.5 border-b border-stone-800/80 flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            <span className="text-[11px] text-stone-400 font-semibold shrink-0 flex items-center gap-1">
              <ListVideo className="w-3.5 h-3.5 text-amber-400" /> Alternar:
            </span>
            {Array.from({ length: totalVideos }).map((_, idx) => {
              const videoItem = videos[idx];
              const videoUrl = videoItem?.url || youtubeLinks[idx] || '';
              const videoInfo = detectVideoInfo(videoUrl);
              const isItemDrive = videoItem?.type === 'drive' || videoInfo?.type === 'drive';

              return (
                <button
                  key={idx}
                  onClick={() => onSelectVideoIndex && onSelectVideoIndex(idx)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedVideoIndex === idx
                      ? isItemDrive
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-red-600 text-white shadow-xs'
                      : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                  }`}
                >
                  {isItemDrive ? (
                    <HardDrive className="w-3 h-3 text-sky-200" />
                  ) : (
                    <Youtube className="w-3 h-3 text-red-200" />
                  )}
                  <span>Vídeo {idx + 1}</span>
                </button>
              );
            })}
          </div>

          {onToggleNextVideo && (
            <button
              onClick={onToggleNextVideo}
              title="Avançar para o próximo vídeo"
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-[11px] font-semibold transition-colors border border-stone-700 cursor-pointer"
            >
              <span>Próximo</span>
              <ChevronRight className="w-3 h-3 text-amber-400" />
            </button>
          )}
        </div>
      )}

      {/* Panel Content */}
      <div
        className={`flex flex-col bg-stone-900 ${
          layoutMode === 'floating' ? 'w-full' : 'flex-1 overflow-y-auto'
        }`}
      >
        {activeEmbedUrl ? (
          /* Active Embed Iframe Player (Supports Google Drive & YouTube) */
          <div
            className={`flex flex-col ${
              layoutMode === 'floating' ? 'w-full' : 'flex-1 min-h-0'
            }`}
          >
            {/* Aspect Ratio Responsive Video Frame */}
            <div
              className={`relative w-full bg-black shrink-0 overflow-hidden shadow-inner ${
                layoutMode === 'video-only'
                  ? 'flex-1 h-full min-h-0'
                  : 'w-full aspect-video'
              }`}
            >
              <iframe
                id="active-video-iframe-player"
                key={activeEmbedUrl}
                src={activeEmbedUrl}
                title={`Vídeo: ${documentTitle} - ${currentVideoTitle}`}
                className="absolute inset-0 w-full h-full border-0 block"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>

            {/* Quick Controls & Student Helpers (Visible when in Split Mode) */}
            {layoutMode === 'split' && (
              <div className="p-3 space-y-2.5 flex-1 overflow-y-auto">
                {/* Active Video Info & Quick Switch */}
                {hasMultipleVideos && (
                  <div className="bg-stone-950/90 p-3 rounded-xl border border-stone-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs pb-1.5 border-b border-stone-800/80">
                      <span className="font-bold text-stone-200 flex items-center gap-1.5">
                        <ListVideo className="w-4 h-4 text-amber-500" />
                        Vídeos Disponíveis nesta Aula ({totalVideos})
                      </span>
                      {onToggleNextVideo && (
                        <button
                          onClick={onToggleNextVideo}
                          className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                        >
                          <Repeat className="w-3 h-3" />
                          <span>Alternar para o próximo</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {Array.from({ length: totalVideos }).map((_, idx) => {
                        const itemVideo = videos[idx];
                        const itemUrl = itemVideo?.url || youtubeLinks[idx] || '';
                        const itemInfo = detectVideoInfo(itemUrl);
                        const isDrive = itemVideo?.type === 'drive' || itemInfo?.type === 'drive';
                        const itemTitle = itemVideo?.title || `Vídeo ${idx + 1}`;
                        const isCurrent = selectedVideoIndex === idx;

                        return (
                          <button
                            key={idx}
                            onClick={() => onSelectVideoIndex && onSelectVideoIndex(idx)}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-xs text-left transition-all cursor-pointer ${
                              isCurrent
                                ? isDrive
                                  ? 'bg-sky-600/20 border border-sky-500/40 text-white font-bold'
                                  : 'bg-red-600/20 border border-red-500/40 text-white font-bold'
                                : 'bg-stone-900/60 hover:bg-stone-800/80 border border-stone-800 text-stone-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isDrive ? (
                                <HardDrive
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isCurrent ? 'text-sky-400' : 'text-stone-500'
                                  }`}
                                />
                              ) : (
                                <PlayCircle
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isCurrent ? 'text-red-400' : 'text-stone-500'
                                  }`}
                                />
                              )}
                              <span className="truncate">
                                Vídeo {idx + 1}: {itemTitle}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 font-semibold">
                                {isDrive ? 'Google Drive' : 'YouTube'}
                              </span>
                              {isCurrent && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded text-white font-semibold ${
                                    isDrive ? 'bg-sky-600' : 'bg-red-500'
                                  }`}
                                >
                                  Reproduzindo
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-stone-400 py-1 border-b border-stone-800/60">
                  <span className="font-semibold text-stone-300">
                    Vídeo
                  </span>
                </div>

                {onAddTimestampNote && (
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAddTimestampNote('Anotação durante o vídeo')}
                      className="px-2.5 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-[11px] text-stone-300 font-medium transition-colors cursor-pointer"
                    >
                      + Anotação com minuto
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Empty State when no video is registered in spreadsheet */
          <div className="p-6 flex-1 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-800/80 border border-stone-700 flex items-center justify-center text-stone-500">
              <Film className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-xs">
              <h3 className="text-xs font-bold text-stone-200">
                Nenhum vídeo disponível nesta aula
              </h3>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Insira o link do vídeo (Google Drive ou YouTube) no arquivo cont.txt do GitHub.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
