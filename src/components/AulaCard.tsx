import React, { useState } from 'react';
import {
  FileText,
  Youtube,
  Play,
  BookOpen,
  ChevronRight,
  HardDrive,
  Video,
} from 'lucide-react';
import { LessonItem } from '../types';
import { getCategoryBadge, detectVideoInfo } from '../utils/formatters';

interface AulaCardProps {
  item: LessonItem;
  onOpenClassroom: (item: LessonItem) => void;
}

export const AulaCard: React.FC<AulaCardProps> = ({ item, onOpenClassroom }) => {
  const [thumbError, setThumbError] = useState(false);
  const badgeStyle = getCategoryBadge(item.subject);

  const primaryVideo = item.videos?.[0];
  const primaryRawUrl = item.youtubeLinks[0] || item.primaryYoutubeUrl || '';
  const videoInfo = detectVideoInfo(primaryRawUrl);
  const isDrive = primaryVideo?.type === 'drive' || videoInfo?.type === 'drive';

  const rawThumbnailUrl =
    primaryVideo?.thumbnailUrl || videoInfo?.thumbnailUrl || null;
  const thumbnailUrl = !thumbError ? rawThumbnailUrl : null;

  return (
    <div
      id={`aula-card-${item.id}`}
      className="group relative bg-white rounded-2xl border border-stone-200/90 hover:border-amber-400/80 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden"
    >
      {/* Visual Header / Thumbnail banner */}
      <div className="relative h-44 bg-gradient-to-br from-stone-900 via-stone-850 to-stone-950 overflow-hidden flex items-center justify-center">
        {thumbnailUrl ? (
          <>
            <img
              src={thumbnailUrl}
              alt={item.title}
              onError={() => setThumbError(true)}
              className="w-full h-full object-cover opacity-75 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/30 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-6 text-stone-600 bg-[radial-gradient(#292524_1px,transparent_1px)] [background-size:16px_16px]">
            <div className="w-16 h-16 rounded-2xl bg-stone-800/80 border border-stone-700 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <BookOpen className="w-8 h-8" />
            </div>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-black/70 backdrop-blur-md text-amber-300 border border-amber-500/30 shadow-xs">
            {item.aulaName}
          </span>
          {item.subject && item.subject !== item.title && (
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-md border border-white/20 shadow-xs ${badgeStyle.bg} ${badgeStyle.text}`}
            >
              {item.subject}
            </span>
          )}
        </div>

        {/* Center Hover Play Action */}
        <button
          onClick={() => onOpenClassroom(item)}
          className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200 z-10 cursor-pointer"
          title="Abrir Aula"
        >
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </button>

        {/* Bottom indicators on the image */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] text-white/90 z-10">
          <div className="flex items-center gap-2">
            {item.pdfLinks.length > 0 && (
              <span className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-amber-300">
                <FileText className="w-3 h-3" />
                {item.pdfLinks.length} {item.pdfLinks.length === 1 ? 'Lista PDF' : 'Listas PDF'}
              </span>
            )}
            {item.youtubeLinks.length > 0 && (
              <span
                className={`flex items-center gap-1 backdrop-blur-md px-2 py-0.5 rounded border ${
                  isDrive
                    ? 'bg-sky-950/80 text-sky-300 border-sky-800/40'
                    : 'bg-rose-950/80 text-rose-300 border-rose-800/40'
                }`}
              >
                {isDrive ? (
                  <HardDrive className="w-3 h-3 text-sky-400" />
                ) : (
                  <Youtube className="w-3 h-3 text-rose-400" />
                )}
                {item.youtubeLinks.length}{' '}
                {item.youtubeLinks.length === 1 ? 'Vídeo' : 'Vídeos'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3
            onClick={() => onOpenClassroom(item)}
            className="font-bold text-stone-900 text-base leading-snug group-hover:text-amber-700 transition-colors cursor-pointer line-clamp-2"
          >
            {item.title}
          </h3>
        </div>

        {/* Action Button */}
        <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between gap-2">
          <button
            onClick={() => onOpenClassroom(item)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-stone-900 hover:bg-stone-800 text-amber-400 hover:text-amber-300 transition-all shadow-xs group-hover:shadow-md"
          >
            <span>Acessar Aula & Exercícios</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
