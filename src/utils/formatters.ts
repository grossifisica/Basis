export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function getCategoryBadge(category: string): { bg: string; text: string; dot: string } {
  switch (category.toLowerCase()) {
    case 'manuais':
      return { bg: 'bg-emerald-50 border-emerald-200 text-emerald-800', text: 'text-emerald-700', dot: 'bg-emerald-500' };
    case 'design':
      return { bg: 'bg-amber-50 border-amber-200 text-amber-800', text: 'text-amber-700', dot: 'bg-amber-500' };
    case 'seguranca':
    case 'segurança':
      return { bg: 'bg-rose-50 border-rose-200 text-rose-800', text: 'text-rose-700', dot: 'bg-rose-500' };
    case 'produtividade':
      return { bg: 'bg-sky-50 border-sky-200 text-sky-800', text: 'text-sky-700', dot: 'bg-sky-500' };
    case 'artigos':
      return { bg: 'bg-indigo-50 border-indigo-200 text-indigo-800', text: 'text-indigo-700', dot: 'bg-indigo-500' };
    case 'livros':
      return { bg: 'bg-violet-50 border-violet-200 text-violet-800', text: 'text-violet-700', dot: 'bg-violet-500' };
    case 'educacao':
    case 'educação':
      return { bg: 'bg-teal-50 border-teal-200 text-teal-800', text: 'text-teal-700', dot: 'bg-teal-500' };
    default:
      return { bg: 'bg-stone-100 border-stone-200 text-stone-800', text: 'text-stone-700', dot: 'bg-stone-500' };
  }
}

export function extractDriveId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Pattern 1: /file/d/FILE_ID, /document/d/FILE_ID, /presentation/d/FILE_ID, /spreadsheets/d/FILE_ID
  const fileDMatch = trimmed.match(/\/(?:file|document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch) return fileDMatch[1];

  // Pattern 2: id=FILE_ID
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];

  // Pattern 3: /open?id=FILE_ID
  const openMatch = trimmed.match(/\/open\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  // Pattern 4: /d/FILE_ID
  const shortDMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (shortDMatch) return shortDMatch[1];

  // Pattern 5: Raw file ID
  if (/^[a-zA-Z0-9_-]{20,45}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function extractYoutubeVideoId(input: string): string | null {
  if (!input) return null;
  let trimmed = input.trim();

  // If user pasted an iframe tag, extract the src URL first
  const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (iframeMatch) {
    trimmed = iframeMatch[1];
  }

  // Pattern 1: youtu.be/VIDEO_ID
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (shortMatch) return shortMatch[1];

  // Pattern 2: youtube.com/watch?v=VIDEO_ID (supports any query parameters before/after)
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (watchMatch) return watchMatch[1];

  // Pattern 3: youtube.com/embed/VIDEO_ID
  const embedMatch = trimmed.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  if (embedMatch) return embedMatch[1];

  // Pattern 4: youtube.com/live/VIDEO_ID, /shorts/VIDEO_ID, or /v/VIDEO_ID
  const liveMatch = trimmed.match(/youtube\.com\/(?:live|shorts|v)\/([a-zA-Z0-9_-]{11})/i);
  if (liveMatch) return liveMatch[1];

  // Pattern 5: Direct 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function getYoutubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1`;
}

export function getYoutubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function getDriveVideoEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function getDriveThumbnailUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
}

export type VideoProviderType = 'youtube' | 'drive' | 'other';

export interface VideoDetails {
  type: VideoProviderType;
  id?: string;
  youtubeVideoId?: string;
  driveFileId?: string;
  embedUrl: string;
  thumbnailUrl?: string;
  providerLabel: string;
}

export function detectVideoInfo(input?: string): VideoDetails | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Check 1: YouTube video ID or URL
  const ytId = extractYoutubeVideoId(trimmed);
  if (ytId) {
    return {
      type: 'youtube',
      id: ytId,
      youtubeVideoId: ytId,
      embedUrl: getYoutubeEmbedUrl(ytId),
      thumbnailUrl: getYoutubeThumbnailUrl(ytId),
      providerLabel: 'YouTube',
    };
  }

  // Check 2: Google Drive file ID or URL
  const driveId = extractDriveId(trimmed);
  if (driveId) {
    return {
      type: 'drive',
      id: driveId,
      driveFileId: driveId,
      embedUrl: getDriveVideoEmbedUrl(driveId),
      thumbnailUrl: getDriveThumbnailUrl(driveId),
      providerLabel: 'Google Drive',
    };
  }

  // Check 3: Standard web URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return {
      type: 'other',
      embedUrl: trimmed,
      providerLabel: 'Vídeo Web',
    };
  }

  return null;
}


