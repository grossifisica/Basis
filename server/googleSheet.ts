import fs from 'fs';
import path from 'path';
import { extractGoogleDriveFileId } from './drive';
import { extractYoutubeVideoId } from './storage';

export interface LessonVideo {
  url: string;
  id?: string;
  title: string;
  type?: 'youtube' | 'drive' | 'other';
  driveFileId?: string;
  youtubeVideoId?: string;
  embedUrl?: string;
  thumbnailUrl?: string;
}

export interface LessonItem {
  id: string;
  aulaName: string;
  aulaIndex: number;
  rowNumber: number;
  title: string;
  subject: string;
  pdfLinks: string[];
  youtubeLinks: string[];
  videoLinks?: string[];
  videos?: LessonVideo[];
  primaryPdfUrl?: string;
  primaryYoutubeUrl?: string;
  primaryYoutubeId?: string;
  primaryDriveVideoId?: string;
  primaryVideoType?: 'youtube' | 'drive' | 'other';
  primaryVideoEmbedUrl?: string;
  driveFileId?: string;
}

export interface Aula {
  id: string;
  name: string;
  gid: string;
  items: LessonItem[];
  totalPdfs: number;
  totalVideos: number;
  subjects: string[];
}

export interface GoogleSheetConfig {
  sheetUrl: string;
  spreadsheetId: string;
  lastSyncedAt?: string;
  status: 'connected' | 'error' | 'idle';
  statusMessage?: string;
  totalAulas: number;
  totalItems: number;
}

export interface SheetDataState {
  config: GoogleSheetConfig;
  aulas: Aula[];
  allItems: LessonItem[];
  subjects: string[];
  lastSyncedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'sheet-config.json');
const CACHE_FILE = path.join(DATA_DIR, 'sheet-data.json');
const LOCAL_CONT_PATH = path.join(process.cwd(), 'public', 'cont.txt');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const GITHUB_REPO_URL = 'https://github.com/grossifisica/Basis/blob/main/cont.txt';
export const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/grossifisica/Basis/main/cont.txt';

// Initial sample data
const DEFAULT_INITIAL_ITEM: LessonItem = {
  id: 'aula-item-1',
  aulaName: 'Notação científica',
  aulaIndex: 0,
  rowNumber: 1,
  title: 'Notação científica',
  subject: 'Matemática Básica',
  pdfLinks: ['https://docs.google.com/presentation/d/1U3um1skYp1MurFec_oLjOOYwkVRmNNnRodid5Scs-K8/edit?usp=sharing'],
  youtubeLinks: ['https://drive.google.com/file/d/1eHfavuK0C6kRzl6IBvkUDxn0npVZKBtK/view?usp=sharing'],
  videoLinks: ['https://drive.google.com/file/d/1eHfavuK0C6kRzl6IBvkUDxn0npVZKBtK/view?usp=sharing'],
  primaryPdfUrl: 'https://docs.google.com/presentation/d/1U3um1skYp1MurFec_oLjOOYwkVRmNNnRodid5Scs-K8/edit?usp=sharing',
  primaryYoutubeUrl: 'https://drive.google.com/file/d/1eHfavuK0C6kRzl6IBvkUDxn0npVZKBtK/view?usp=sharing',
  primaryDriveVideoId: '1eHfavuK0C6kRzl6IBvkUDxn0npVZKBtK',
  primaryVideoType: 'drive',
  primaryVideoEmbedUrl: 'https://drive.google.com/file/d/1eHfavuK0C6kRzl6IBvkUDxn0npVZKBtK/preview',
  driveFileId: '1U3um1skYp1MurFec_oLjOOYwkVRmNNnRodid5Scs-K8',
  videos: [
    {
      url: 'https://drive.google.com/file/d/1eHfavuK0C6kRzl6IBvkUDxn0npVZKBtK/view?usp=sharing',
      id: '1eHfavuK0C6kRzl6IBvkUDxn0npVZKBtK',
      title: 'Notação científica - Vídeo 1',
      type: 'drive',
      driveFileId: '1eHfavuK0C6kRzl6IBvkUDxn0npVZKBtK',
      embedUrl: 'https://drive.google.com/file/d/1eHfavuK0C6kRzl6IBvkUDxn0npVZKBtK/preview',
      thumbnailUrl: 'https://drive.google.com/thumbnail?id=1eHfavuK0C6kRzl6IBvkUDxn0npVZKBtK&sz=w800',
    },
  ],
};

const DEFAULT_INITIAL_AULA: Aula = {
  id: 'aula-1',
  name: 'Notação científica',
  gid: '1',
  items: [DEFAULT_INITIAL_ITEM],
  totalPdfs: 1,
  totalVideos: 1,
  subjects: ['Matemática Básica'],
};

export function extractSpreadsheetId(_url: string): string | null {
  return 'github-grossifisica-basis';
}

export function getSheetConfig(): GoogleSheetConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return {
        ...data,
        sheetUrl: GITHUB_REPO_URL,
        spreadsheetId: 'github-grossifisica-basis',
      };
    }
  } catch (err) {
    console.error('Error reading sheet config:', err);
  }

  return {
    sheetUrl: GITHUB_REPO_URL,
    spreadsheetId: 'github-grossifisica-basis',
    status: 'connected',
    statusMessage: 'Conectado ao repositório GitHub',
    totalAulas: 1,
    totalItems: 1,
  };
}

export function saveSheetConfig(config: GoogleSheetConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Error saving sheet config:', err);
  }
}

export function getCachedSheetData(): SheetDataState | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      return data;
    }
  } catch (err) {
    console.error('Error reading cached sheet data:', err);
  }
  return null;
}

export function saveCachedSheetData(data: SheetDataState): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving cached sheet data:', err);
  }
}

function detectServerVideoInfo(url?: string) {
  if (!url) return null;
  const ytId = extractYoutubeVideoId(url);
  if (ytId) {
    return {
      type: 'youtube' as const,
      id: ytId,
      youtubeVideoId: ytId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    };
  }

  const driveId = extractGoogleDriveFileId(url);
  if (driveId) {
    return {
      type: 'drive' as const,
      id: driveId,
      driveFileId: driveId,
      embedUrl: `https://drive.google.com/file/d/${driveId}/preview`,
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`,
    };
  }

  return {
    type: 'other' as const,
    id: undefined,
    embedUrl: url,
    thumbnailUrl: undefined,
  };
}

// Main sync function: parses lines from cont.txt (GitHub or disk)
export async function syncGoogleSpreadsheet(_providedUrl?: string): Promise<SheetDataState> {
  const config = getSheetConfig();

  try {
    let contText: string = '';

    // 1. Fetch latest raw text from GitHub
    try {
      const response = await fetch(`${GITHUB_RAW_URL}?_t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (response.ok) {
        contText = await response.text();
        try {
          fs.writeFileSync(LOCAL_CONT_PATH, contText);
        } catch {
          // ignore
        }
      }
    } catch (fetchErr) {
      console.warn('Network fetch for GitHub cont.txt failed, will attempt disk fallback:', fetchErr);
    }

    // 2. Fallback to local cont.txt if network fetch failed
    if (!contText && fs.existsSync(LOCAL_CONT_PATH)) {
      contText = fs.readFileSync(LOCAL_CONT_PATH, 'utf-8');
    }

    if (!contText || contText.trim().length === 0) {
      throw new Error('Não foi possível carregar o arquivo cont.txt.');
    }

    const lines = contText.split(/\r?\n/);
    const aulas: Aula[] = [];
    const allItems: LessonItem[] = [];
    const subjectsSet = new Set<string>();

    let aulaCounter = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const rawLine = lines[lineIdx].trim();
      if (!rawLine || rawLine.startsWith('#') || rawLine.startsWith('//')) {
        continue;
      }

      aulaCounter++;
      const parts = rawLine.split('|').map((p) => p.trim());
      const title = parts[0] || `Aula ${aulaCounter}`;

      const pdfField = parts[1] || '';
      const pdfLinks = pdfField
        ? pdfField
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const videoField = parts[2] || '';
      const videoLinks = videoField
        ? videoField
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const detectedVideos: LessonVideo[] = videoLinks.map((url, vidIdx) => {
        const info = detectServerVideoInfo(url);
        return {
          url,
          id: info?.id || `video-${aulaCounter}-${vidIdx + 1}`,
          title: `${title} - Vídeo ${vidIdx + 1}`,
          type: info?.type || 'other',
          driveFileId: (info as any)?.driveFileId,
          youtubeVideoId: (info as any)?.youtubeVideoId,
          embedUrl: info?.embedUrl,
          thumbnailUrl: info?.thumbnailUrl,
        };
      });

      const primaryPdfUrl = pdfLinks[0] || undefined;
      const primaryVideo = detectedVideos[0];
      const primaryDriveId = primaryPdfUrl ? (extractGoogleDriveFileId(primaryPdfUrl) || undefined) : undefined;

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

      aulas.push({
        id: `aula-${aulaCounter}`,
        name: title,
        gid: String(aulaCounter),
        items: [item],
        totalPdfs: pdfLinks.length,
        totalVideos: detectedVideos.length,
        subjects: [item.subject],
      });
    }

    if (aulas.length === 0) {
      throw new Error('Nenhuma aula encontrada no arquivo cont.txt.');
    }

    const updatedConfig: GoogleSheetConfig = {
      sheetUrl: GITHUB_REPO_URL,
      spreadsheetId: 'github-grossifisica-basis',
      lastSyncedAt: new Date().toISOString(),
      status: 'connected',
      statusMessage: `Sincronizado com sucesso! ${aulas.length} aula(s) carregada(s) do GitHub.`,
      totalAulas: aulas.length,
      totalItems: allItems.length,
    };

    saveSheetConfig(updatedConfig);

    const fullState: SheetDataState = {
      config: updatedConfig,
      aulas,
      allItems,
      subjects: Array.from(subjectsSet),
      lastSyncedAt: new Date().toISOString(),
    };

    saveCachedSheetData(fullState);
    return fullState;
  } catch (err: any) {
    console.error('Error syncing GitHub cont.txt:', err);
    const errConfig: GoogleSheetConfig = {
      ...config,
      sheetUrl: GITHUB_REPO_URL,
      spreadsheetId: 'github-grossifisica-basis',
      status: 'error',
      statusMessage: `Erro ao sincronizar do GitHub: ${err.message || 'Verifique o link.'}`,
    };
    saveSheetConfig(errConfig);

    const previous = getCachedSheetData();
    if (previous && previous.aulas.length > 0) {
      previous.config = errConfig;
      return previous;
    }

    return {
      config: errConfig,
      aulas: [DEFAULT_INITIAL_AULA],
      allItems: [DEFAULT_INITIAL_ITEM],
      subjects: ['Matemática Básica'],
      lastSyncedAt: new Date().toISOString(),
    };
  }
}

// Get latest sheet data, automatically revalidating if cache is older than 20s
let lastRevalidationTime = 0;
export async function getLatestSheetData(): Promise<SheetDataState> {
  const cached = getCachedSheetData();
  const now = Date.now();

  // If we have cached data and it's less than 20 seconds old, return immediately
  if (cached && now - lastRevalidationTime < 20000 && cached.aulas.length > 0) {
    return cached;
  }

  lastRevalidationTime = now;
  try {
    const fresh = await syncGoogleSpreadsheet();
    return fresh;
  } catch (err) {
    console.warn('Auto-revalidation failed, returning cached data:', err);
    if (cached) return cached;
  }

  if (cached) return cached;

  const initial: SheetDataState = {
    config: getSheetConfig(),
    aulas: [DEFAULT_INITIAL_AULA],
    allItems: [DEFAULT_INITIAL_ITEM],
    subjects: ['Matemática Básica'],
    lastSyncedAt: new Date().toISOString(),
  };
  saveCachedSheetData(initial);
  return initial;
}
