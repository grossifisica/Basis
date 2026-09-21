import { Aula, LessonItem, LessonVideo, SheetDataState } from '../types';
import { detectVideoInfo, extractDriveId, extractYoutubeVideoId } from './formatters';

export const GITHUB_REPO_URL = 'https://github.com/grossifisica/Mb/blob/main/cont.txt';
export const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/grossifisica/Mb/main/cont.txt';
export const GITHUB_API_URL = 'https://api.github.com/repos/grossifisica/Mb/contents/cont.txt';
export const LOCAL_FALLBACK_URL = '/cont.txt';

/**
 * Parses raw text from cont.txt according to the format:
 * Titulo da aula|Link do pdf da aula|Link dos vídeos da aula
 *
 * Videos are separated by semicolon (;) if there are multiple.
 * Each line corresponds to one Aula.
 */
export function parseContText(text: string): SheetDataState {
  const lines = text.split(/\r?\n/);
  const aulas: Aula[] = [];
  const allItems: LessonItem[] = [];
  const subjectsSet = new Set<string>();

  let aulaCounter = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx].trim();
    // Skip empty lines or commented lines
    if (!rawLine || rawLine.startsWith('#') || rawLine.startsWith('//')) {
      continue;
    }

    aulaCounter++;
    // Split by pipe (|)
    const parts = rawLine.split('|').map((p) => p.trim());

    // Field 1: Titulo da aula
    const title = parts[0] || `Aula ${aulaCounter}`;

    // Field 2: Link do pdf da aula (can also support multiple PDFs separated by semicolon)
    const pdfField = parts[1] || '';
    const pdfLinks = pdfField
      ? pdfField
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // Field 3: Link dos vídeos da aula (separated by semicolon if multiple)
    const videoField = parts[2] || '';
    const videoLinks = videoField
      ? videoField
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // Detect video details for each link
    const detectedVideos: LessonVideo[] = videoLinks.map((url, vidIdx) => {
      const info = detectVideoInfo(url);
      return {
        url,
        id: info?.id || `video-${aulaCounter}-${vidIdx + 1}`,
        title: `${title} - Vídeo ${vidIdx + 1}`,
        type: info?.type || 'other',
        driveFileId: info?.driveFileId,
        youtubeVideoId: info?.youtubeVideoId,
        embedUrl: info?.embedUrl,
        thumbnailUrl: info?.thumbnailUrl,
      };
    });

    const primaryPdfUrl = pdfLinks[0] || undefined;
    const primaryVideo = detectedVideos[0];
    const primaryDriveId = primaryPdfUrl ? (extractDriveId(primaryPdfUrl) || undefined) : undefined;

    // Build the LessonItem
    const item: LessonItem = {
      id: `aula-item-${aulaCounter}`,
      aulaName: title,
      aulaIndex: aulaCounter - 1,
      rowNumber: lineIdx + 1,
      title: title,
      subject: 'Matemática Básica',
      pdfLinks: pdfLinks,
      youtubeLinks: videoLinks,
      videoLinks: videoLinks,
      videos: detectedVideos,
      primaryPdfUrl: primaryPdfUrl,
      primaryYoutubeUrl: primaryVideo?.url,
      primaryYoutubeId: primaryVideo?.youtubeVideoId,
      primaryDriveVideoId: primaryVideo?.driveFileId,
      primaryVideoType: primaryVideo?.type,
      primaryVideoEmbedUrl: primaryVideo?.embedUrl,
      driveFileId: primaryDriveId,
    };

    subjectsSet.add(item.subject);
    allItems.push(item);

    // Build the Aula
    const aula: Aula = {
      id: `aula-${aulaCounter}`,
      name: title,
      gid: String(aulaCounter),
      items: [item],
      totalPdfs: pdfLinks.length,
      totalVideos: detectedVideos.length,
      subjects: [item.subject],
    };

    aulas.push(aula);
  }

  const now = new Date().toISOString();

  return {
    config: {
      sheetUrl: GITHUB_REPO_URL,
      spreadsheetId: 'github-grossifisica-mb',
      lastSyncedAt: now,
      status: 'connected',
      statusMessage: `Sincronizado com o GitHub (${aulas.length} aula(s) carregada(s))`,
      totalAulas: aulas.length,
      totalItems: allItems.length,
    },
    aulas,
    allItems,
    subjects: Array.from(subjectsSet),
    lastSyncedAt: now,
  };
}

/**
 * Fetch raw cont.txt from GitHub with anti-cache query parameter.
 * IMPORTANT: We do NOT send custom headers like 'Cache-Control' or 'Pragma'
 * because raw.githubusercontent.com rejects CORS OPTIONS preflight requests with 403 Forbidden.
 * A simple GET with '?_t=timestamp' passes CORS naturally with Access-Control-Allow-Origin: *.
 */
export async function fetchGitHubContent(): Promise<SheetDataState> {
  const cacheBuster = Date.now();

  // 1. Try fetching directly from raw.githubusercontent.com (CORS-friendly simple GET)
  try {
    const rawUrl = `${GITHUB_RAW_URL}?_t=${cacheBuster}`;
    const res = await fetch(rawUrl, {
      cache: 'no-store',
    });

    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 0) {
        return parseContText(text);
      }
    }
  } catch (err) {
    console.warn('Direct GitHub raw fetch failed, trying Vercel/server API...', err);
  }

  // 2. Try Vercel / serverless API endpoint (/api/sheet/data)
  try {
    const apiRes = await fetch(`/api/sheet/data?_t=${cacheBuster}`, {
      cache: 'no-store',
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && Array.isArray(data.aulas) && data.aulas.length > 0) {
        return data;
      }
    }
  } catch (apiErr) {
    console.warn('Server API fetch failed, trying local fallback...', apiErr);
  }

  // 3. Try local fallback file /cont.txt
  try {
    const localRes = await fetch(`${LOCAL_FALLBACK_URL}?_t=${cacheBuster}`, {
      cache: 'no-store',
    });
    if (localRes.ok) {
      const localText = await localRes.text();
      if (localText && localText.trim().length > 0) {
        return parseContText(localText);
      }
    }
  } catch (localErr) {
    console.warn('Local fallback cont.txt fetch failed:', localErr);
  }

  throw new Error('Não foi possível carregar o arquivo cont.txt do GitHub.');
}
