import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  Youtube,
  Tv,
  Columns2,
  ListOrdered,
  BookOpen,
  Maximize,
  Repeat,
  LogOut,
  HardDrive,
  Film,
  Video,
  Play,
} from 'lucide-react';
import { LessonItem, Aula, StudentUser } from '../types';
import { extractYoutubeVideoId, extractDriveId, detectVideoInfo } from '../utils/formatters';
import { YoutubePlayerPanel } from './YoutubePlayerPanel';

interface ClassroomViewerProps {
  item: LessonItem;
  currentAula?: Aula;
  currentUser?: StudentUser | null;
  onLogout?: () => void;
  onBack: () => void;
  onSelectItem: (item: LessonItem) => void;
}

export const ClassroomViewer: React.FC<ClassroomViewerProps> = ({
  item,
  currentAula,
  currentUser,
  onLogout,
  onBack,
  onSelectItem,
}) => {
  // Current active PDF and YouTube index when multiple links are provided in Col C or Col D
  const [selectedPdfIndex, setSelectedPdfIndex] = useState(0);
  const [selectedYtIndex, setSelectedYtIndex] = useState(0);

  // Layout mode: 'split' | 'floating' | 'pdf-only' | 'video-only'
  const [layoutMode, setLayoutMode] = useState<'split' | 'floating' | 'pdf-only' | 'video-only'>('split');

  // Reset indices if item changes
  useEffect(() => {
    setSelectedPdfIndex(0);
    setSelectedYtIndex(0);
  }, [item.id]);

  const handleToggleNextVideo = () => {
    if (item.youtubeLinks.length > 1) {
      setSelectedYtIndex((prev) => (prev + 1) % item.youtubeLinks.length);
    }
  };

  const activePdfUrl = item.pdfLinks[selectedPdfIndex] || item.primaryPdfUrl;
  const activeYtUrl = item.youtubeLinks[selectedYtIndex] || item.primaryYoutubeUrl;
  const activeYtId = activeYtUrl ? extractYoutubeVideoId(activeYtUrl) : undefined;

  const driveId = activePdfUrl ? extractDriveId(activePdfUrl) : undefined;
  const isPresentation = activePdfUrl ? activePdfUrl.includes('/presentation/d/') : false;
  const isGoogleDoc = activePdfUrl ? activePdfUrl.includes('/document/d/') : false;

  // Determine the stable embed URL for internal in-app viewing
  const getEmbedSource = () => {
    if (!activePdfUrl) return null;

    if (isPresentation && driveId) {
      // Google Presentations: Clean vector slide embed without auto-advancing or reloading
      return `https://docs.google.com/presentation/d/${driveId}/embed?start=false&loop=false`;
    }

    if (isGoogleDoc && driveId) {
      // Google Docs: Clean embedded preview viewer
      return `https://docs.google.com/document/d/${driveId}/preview`;
    }

    if (driveId) {
      // Google Drive PDF / Document: Native embedded preview viewer
      return `https://drive.google.com/file/d/${driveId}/preview`;
    }

    // Direct PDF or other link: Proxied or universal embedded viewer
    if (typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || !window.location.port)) {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(activePdfUrl)}&embedded=true`;
    }

    return `/api/sheet/pdf-proxy?url=${encodeURIComponent(activePdfUrl)}`;
  };

  const embedSrc = getEmbedSource();

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-stone-900 text-stone-100 select-none pb-[env(safe-area-inset-bottom)]">
      {/* Top Header */}
      <header className="h-16 px-4 sm:px-6 bg-stone-900 border-b border-stone-800 flex items-center justify-between gap-3 shrink-0 z-30">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar às Aulas</span>
          </button>

          <div className="h-6 w-px bg-stone-800 shrink-0 hidden sm:block" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                {item.aulaName}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 hidden md:inline">
                {item.subject}
              </span>
              <h1 className="text-sm font-bold text-white truncate">{item.title}</h1>
            </div>
            <p className="text-[11px] text-stone-400 truncate hidden sm:block">
              Material de estudo integrado • {item.pdfLinks.length} material(is) • {item.youtubeLinks.length} vídeo(s)
            </p>
          </div>
        </div>

        {/* Center: Multi-link Tabs (if more than 1 PDF or 1 Video exists) */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          {item.pdfLinks.length > 1 && (
            <div className="flex items-center bg-stone-800/80 p-1 rounded-xl border border-stone-700 text-xs">
              <span className="px-2 text-[11px] text-stone-400 font-semibold flex items-center gap-1">
                <FileText className="w-3 h-3 text-amber-400" /> Materiais:
              </span>
              {item.pdfLinks.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPdfIndex(idx)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    selectedPdfIndex === idx
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  Material {idx + 1}
                </button>
              ))}
            </div>
          )}

          {item.youtubeLinks.length > 1 && (
            <div className="flex items-center bg-stone-800/80 p-1 rounded-xl border border-stone-700 text-xs gap-1">
              <span className="px-2 text-[11px] text-stone-400 font-semibold flex items-center gap-1">
                <Video className="w-3 h-3 text-amber-400" /> Vídeos:
              </span>
              {item.youtubeLinks.map((_, idx) => {
                const vid = item.videos?.[idx];
                const vidInfo = detectVideoInfo(vid?.url || item.youtubeLinks[idx]);
                const isDrive = vid?.type === 'drive' || vidInfo?.type === 'drive';

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedYtIndex(idx)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      selectedYtIndex === idx
                        ? isDrive
                          ? 'bg-sky-600 text-white font-bold shadow-xs'
                          : 'bg-rose-600 text-white font-bold shadow-xs'
                        : 'text-stone-300 hover:text-white hover:bg-stone-700/50'
                    }`}
                  >
                    {isDrive ? (
                      <HardDrive className="w-3 h-3 text-sky-200" />
                    ) : (
                      <Play className="w-3 h-3 text-rose-200" />
                    )}
                    <span>Vídeo {idx + 1}</span>
                  </button>
                );
              })}
              <button
                onClick={handleToggleNextVideo}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-600 text-amber-300 hover:text-white font-bold transition-all border border-amber-500/30 cursor-pointer ml-1"
                title="Clique para alternar para o próximo vídeo desta aula"
              >
                <Repeat className="w-3 h-3" />
                <span>Alternar Vídeo</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Layout Switcher Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-stone-800/80 p-0.5 rounded-xl border border-stone-700 text-xs">
            <button
              onClick={() => setLayoutMode('split')}
              className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                layoutMode === 'split'
                  ? 'bg-stone-700 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Dividir Tela (Material e Vídeo lado a lado)"
            >
              <Columns2 className="w-4 h-4" />
              <span className="hidden xl:inline text-[11px] font-semibold">Dividir</span>
            </button>

            <button
              onClick={() => setLayoutMode('floating')}
              className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                layoutMode === 'floating'
                  ? 'bg-stone-700 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Vídeo Flutuante (Picture-in-Picture)"
            >
              <Tv className="w-4 h-4" />
              <span className="hidden xl:inline text-[11px] font-semibold">Flutuante</span>
            </button>

            <button
              onClick={() => setLayoutMode('pdf-only')}
              className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                layoutMode === 'pdf-only'
                  ? 'bg-stone-700 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Apenas Lista/Material em tela cheia"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden xl:inline text-[11px] font-semibold">Material</span>
            </button>

            <button
              onClick={() => setLayoutMode('video-only')}
              className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                layoutMode === 'video-only'
                  ? 'bg-stone-700 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Apenas Vídeo em destaque"
            >
              <Film className="w-4 h-4" />
              <span className="hidden xl:inline text-[11px] font-semibold">Vídeo</span>
            </button>
          </div>

          {currentUser && (
            <div className="flex items-center gap-2 border-l border-stone-800 pl-2">
              <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-stone-800/60 border border-stone-700 text-xs">
                <div className="w-5 h-5 rounded-full bg-amber-400 text-stone-950 font-bold flex items-center justify-center text-[10px]">
                  {currentUser.firstName?.[0] || 'A'}
                </div>
                <span className="font-semibold text-stone-300 max-w-[120px] truncate">
                  {currentUser.firstName}
                </span>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition-colors cursor-pointer"
                  title="Sair da conta"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Secondary Sub-header for Mobile if multiple links exist */}
      {(item.pdfLinks.length > 1 || item.youtubeLinks.length > 1) && (
        <div className="lg:hidden px-4 py-2 bg-stone-850 border-b border-stone-800 flex items-center gap-3 overflow-x-auto text-xs shrink-0">
          {item.pdfLinks.length > 1 && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-stone-400 text-[11px]">Materiais:</span>
              {item.pdfLinks.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPdfIndex(idx)}
                  className={`px-2 py-0.5 rounded text-xs ${
                    selectedPdfIndex === idx ? 'bg-amber-500 text-black font-bold' : 'bg-stone-800 text-stone-300'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          )}
          {item.youtubeLinks.length > 1 && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-stone-400 text-[11px] font-semibold">Vídeos:</span>
              {item.youtubeLinks.map((_, idx) => {
                const vid = item.videos?.[idx];
                const vidInfo = detectVideoInfo(vid?.url || item.youtubeLinks[idx]);
                const isDrive = vid?.type === 'drive' || vidInfo?.type === 'drive';

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedYtIndex(idx)}
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      selectedYtIndex === idx
                        ? isDrive
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-rose-600 text-white shadow-xs'
                        : 'bg-stone-800 text-stone-300'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
              <button
                onClick={handleToggleNextVideo}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-600/30 text-amber-300 font-bold border border-amber-500/40"
              >
                <Repeat className="w-3 h-3" />
                <span>Alternar</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Study Canvas Stage */}
      <main className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
        {/* PDF / Exercise List Stage - Preserved in DOM to prevent reload/flicker */}
        <section
          className={`flex-1 min-h-0 flex flex-col overflow-hidden transition-all relative ${
            layoutMode === 'video-only'
              ? 'hidden'
              : layoutMode === 'split'
              ? 'w-full md:w-[56%] lg:w-[55%] xl:w-[56%] md:h-full'
              : 'w-full h-full'
          }`}
        >
          {embedSrc ? (
            <div className="flex-1 w-full h-full bg-stone-950 flex flex-col overflow-hidden">
              {/* Internal Study Banner */}
              <div className="px-4 py-2 bg-stone-900 border-b border-stone-800 flex items-center justify-between text-xs text-stone-300 shrink-0">
                <div className="flex items-center gap-2">
                  {isPresentation ? (
                    <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span className="font-semibold text-stone-100 truncate">
                    {isPresentation ? 'Slides e Material Interativo' : 'Material Didático em PDF'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      if (layoutMode === 'pdf-only') {
                        setLayoutMode('split');
                      } else {
                        setLayoutMode('pdf-only');
                      }
                    }}
                    className="p-1 rounded text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                    title={layoutMode === 'pdf-only' ? 'Voltar para tela dividida' : 'Expandir material'}
                  >
                    <Maximize className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Embedded Document Frame */}
              <div className="flex-1 relative w-full h-full bg-stone-950 overflow-hidden">
                <iframe
                  key={embedSrc}
                  src={embedSrc}
                  className="w-full h-full border-0 bg-stone-950 block"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  title={item.title}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-stone-950 text-stone-400">
              <FileText className="w-16 h-16 text-stone-700 mb-4" />
              <h3 className="text-base font-bold text-stone-200">Nenhum material cadastrado nesta aula</h3>
              <p className="text-xs text-stone-500 max-w-sm mt-1">
                Insira o link da apresentação ou PDF no arquivo cont.txt do GitHub.
              </p>
            </div>
          )}
        </section>

        {/* Video Player Panel - Split View */}
        {layoutMode === 'split' && (
          <aside className="w-full md:w-[44%] lg:w-[45%] xl:w-[44%] h-auto md:h-full border-b md:border-b-0 md:border-l border-stone-800 bg-stone-900 flex flex-col overflow-hidden z-20 shrink-0 order-first md:order-last">
            <YoutubePlayerPanel
              youtubeUrl={activeYtUrl}
              youtubeVideoId={activeYtId}
              youtubeLinks={item.youtubeLinks}
              videos={item.videos}
              selectedVideoIndex={selectedYtIndex}
              onSelectVideoIndex={setSelectedYtIndex}
              onToggleNextVideo={handleToggleNextVideo}
              documentTitle={`${item.title} (${item.aulaName})`}
              layoutMode="split"
              onToggleLayoutMode={() => setLayoutMode('floating')}
              onClose={() => setLayoutMode('pdf-only')}
            />
          </aside>
        )}

        {/* Video Player - Full Video Mode */}
        {layoutMode === 'video-only' && (
          <section className="w-full h-full flex flex-col bg-stone-950">
            <YoutubePlayerPanel
              youtubeUrl={activeYtUrl}
              youtubeVideoId={activeYtId}
              youtubeLinks={item.youtubeLinks}
              videos={item.videos}
              selectedVideoIndex={selectedYtIndex}
              onSelectVideoIndex={setSelectedYtIndex}
              onToggleNextVideo={handleToggleNextVideo}
              documentTitle={`${item.title} (${item.aulaName})`}
              layoutMode="video-only"
              onToggleLayoutMode={() => setLayoutMode('split')}
              onClose={() => setLayoutMode('split')}
            />
          </section>
        )}
      </main>

      {/* Bottom aula playlist footer (if currentAula has multiple items) */}
      {currentAula && currentAula.items.length > 1 && (
        <footer className="h-12 bg-stone-950 border-t border-stone-800 px-4 flex items-center justify-between gap-4 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-stone-400">
            <ListOrdered className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-stone-300">Tópicos desta Aula ({currentAula.items.length}):</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {currentAula.items.map((otherItem) => (
              <button
                key={otherItem.id}
                onClick={() => onSelectItem(otherItem)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  otherItem.id === item.id
                    ? 'bg-amber-500 text-stone-950'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white'
                }`}
              >
                <span>{otherItem.title}</span>
                {otherItem.youtubeLinks.length > 0 && <Youtube className="w-3 h-3 text-rose-500" />}
                {otherItem.pdfLinks.length > 0 && <FileText className="w-3 h-3 text-amber-300" />}
              </button>
            ))}
          </div>
        </footer>
      )}

      {/* Video Player Panel - Floating (Picture in Picture) - Placed at root so it is never clipped by main overflow */}
      {layoutMode === 'floating' && (
        <YoutubePlayerPanel
          youtubeUrl={activeYtUrl}
          youtubeVideoId={activeYtId}
          youtubeLinks={item.youtubeLinks}
          videos={item.videos}
          selectedVideoIndex={selectedYtIndex}
          onSelectVideoIndex={setSelectedYtIndex}
          onToggleNextVideo={handleToggleNextVideo}
          documentTitle={`${item.title} (${item.aulaName})`}
          layoutMode="floating"
          onToggleLayoutMode={() => setLayoutMode('split')}
          onClose={() => setLayoutMode('pdf-only')}
          hasFooter={Boolean(currentAula && currentAula.items.length > 1)}
        />
      )}
    </div>
  );
};
