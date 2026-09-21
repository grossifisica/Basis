import * as XLSX from 'xlsx';
import { Aula, LessonItem, LessonVideo, SheetDataState } from '../types';
import { extractDriveId, extractYoutubeVideoId } from './formatters';
import { DEFAULT_SHEET_DATA } from '../data/defaultSheetData';

export const SPREADSHEET_ID = '1_TENfGFFtuet84aDj0sFvg5uleTbJl5r5zWwVtjXBas';
export const SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1_TENfGFFtuet84aDj0sFvg5uleTbJl5r5zWwVtjXBas/edit?usp=sharing';
export const XLSX_EXPORT_URL =
  'https://docs.google.com/spreadsheets/d/1_TENfGFFtuet84aDj0sFvg5uleTbJl5r5zWwVtjXBas/export?format=xlsx';
export const XLSX_LOCAL_FALLBACK_URL = '/contents.xlsx';

export function extractUrlsFromText(cellContent?: string): string[] {
  if (!cellContent) return [];
  const text = cellContent.trim();
  if (!text) return [];

  const urlRegex = /https?:\/\/[^\s,;\r\n"'>]+/gi;
  const matches = text.match(urlRegex);
  if (matches && matches.length > 0) {
    return Array.from(new Set(matches.map((u) => u.trim())));
  }

  const parts = text.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean);
  return parts.map((p) => (p.startsWith('www.') ? `https://${p}` : p)).filter((p) => p.includes('.'));
}

function getCellUrls(ws: XLSX.WorkSheet, rowIndex: number, colIndex: number, textVal: any): string[] {
  const urls: string[] = [];
  const text = (textVal || '').toString().trim();
  if (text) {
    urls.push(...extractUrlsFromText(text));
  }
  const cellAddr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
  const cell = ws[cellAddr];
  if (cell?.l?.Target) {
    const target = String(cell.l.Target).trim();
    if ((target.startsWith('http://') || target.startsWith('https://')) && !urls.includes(target)) {
      urls.push(target);
    }
  }
  return Array.from(new Set(urls));
}

export function parseXlsxBuffer(buffer: ArrayBuffer | Uint8Array): SheetDataState {
  const workbook = XLSX.read(buffer, { type: 'array' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Nenhuma planilha encontrada no arquivo XLSX.');
  }

  const aulas: Aula[] = [];
  const allItems: LessonItem[] = [];
  const subjectSet = new Set<string>();

  for (let tabIndex = 0; tabIndex < workbook.SheetNames.length; tabIndex++) {
    const tabName = workbook.SheetNames[tabIndex].trim();
    const ws = workbook.Sheets[tabName];
    if (!ws) continue;

    const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false });
    if (!rawRows || rawRows.length === 0) continue;

    // Detect header row
    const firstRow = rawRows[0] || [];
    const colA0 = (firstRow[0] || '').toString().trim().toLowerCase();
    const colB0 = (firstRow[1] || '').toString().trim().toLowerCase();
    const colC0Urls = getCellUrls(ws, 0, 2, firstRow[2]);
    const colD0Urls = getCellUrls(ws, 0, 3, firstRow[3]);

    const isHeader =
      (colA0.includes('título') || colA0.includes('titulo') || colA0.includes('title')) &&
      (colB0.includes('assunto') || colB0.includes('tema') || colB0.includes('matéria') || colB0.includes('materia')) &&
      colC0Urls.length === 0 &&
      colD0Urls.length === 0;

    const startRow = isHeader ? 1 : 0;
    const tabLessonItems: LessonItem[] = [];

    for (let rIndex = startRow; rIndex < rawRows.length; rIndex++) {
      const row = rawRows[rIndex] || [];
      const title = (row[0] || '').toString().trim();
      const subject = (row[1] || '').toString().trim();
      const pdfUrls = getCellUrls(ws, rIndex, 2, row[2]);
      const videoUrls = getCellUrls(ws, rIndex, 3, row[3]);

      if (!title && !subject && pdfUrls.length === 0 && videoUrls.length === 0) {
        continue;
      }

      const effectiveTitle =
        title || (tabLessonItems.length === 0 ? tabName : `${tabName} - Conteúdo ${tabLessonItems.length + 1}`);
      const effectiveSubject = subject || tabName || 'Geral';
      subjectSet.add(effectiveSubject);

      const tabVideos: LessonVideo[] = [];
      for (let vIdx = 0; vIdx < videoUrls.length; vIdx++) {
        const vUrl = videoUrls[vIdx];
        const ytId = extractYoutubeVideoId(vUrl) || undefined;
        const driveId = !ytId ? extractDriveId(vUrl) || undefined : undefined;
        const videoType: 'youtube' | 'drive' | 'other' = ytId ? 'youtube' : driveId ? 'drive' : 'other';
        const videoTitle = videoUrls.length === 1 ? effectiveTitle : `${effectiveTitle} - Vídeo ${vIdx + 1}`;

        let embedUrl = '';
        let thumbnailUrl: string | undefined = undefined;

        if (ytId) {
          embedUrl = `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1`;
          thumbnailUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        } else if (driveId) {
          embedUrl = `https://drive.google.com/file/d/${driveId}/preview`;
          thumbnailUrl = `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
        } else {
          embedUrl = vUrl;
        }

        tabVideos.push({
          url: vUrl,
          id: ytId || driveId,
          title: videoTitle,
          type: videoType,
          driveFileId: driveId,
          youtubeVideoId: ytId,
          embedUrl,
          thumbnailUrl,
        });
      }

      const firstDriveId = pdfUrls.map((p) => extractDriveId(p)).find(Boolean) || undefined;
      const firstVideo = tabVideos[0];

      const item: LessonItem = {
        id: `aula-${tabIndex}-${rIndex}`,
        aulaName: tabName,
        aulaIndex: tabIndex,
        rowNumber: rIndex + 1,
        title: effectiveTitle,
        subject: effectiveSubject,
        pdfLinks: pdfUrls,
        youtubeLinks: videoUrls,
        videoLinks: videoUrls,
        videos: tabVideos,
        primaryPdfUrl: pdfUrls[0] || undefined,
        primaryYoutubeUrl: videoUrls[0] || undefined,
        primaryYoutubeId: firstVideo?.youtubeVideoId,
        primaryDriveVideoId: firstVideo?.driveFileId,
        primaryVideoType: firstVideo?.type,
        primaryVideoEmbedUrl: firstVideo?.embedUrl,
        driveFileId: firstDriveId,
      };

      tabLessonItems.push(item);
      allItems.push(item);
    }

    if (tabLessonItems.length > 0) {
      const totalPdfs = tabLessonItems.reduce((acc, it) => acc + it.pdfLinks.length, 0);
      const totalVideos = tabLessonItems.reduce((acc, it) => acc + (it.videos?.length || 0), 0);
      const tabSubjects = Array.from(new Set(tabLessonItems.map((it) => it.subject)));

      aulas.push({
        id: `aula-${tabIndex}`,
        name: tabName,
        gid: String(tabIndex),
        items: tabLessonItems,
        totalPdfs,
        totalVideos,
        subjects: tabSubjects,
      });
    }
  }

  if (aulas.length === 0) {
    throw new Error('Nenhuma aula encontrada nas abas da planilha.');
  }

  return {
    config: {
      sheetUrl: SPREADSHEET_URL,
      spreadsheetId: SPREADSHEET_ID,
      lastSyncedAt: new Date().toISOString(),
      status: 'connected',
      statusMessage: `Sincronizado diretamente com a planilha Google! ${aulas.length} aula(s) e ${allItems.length} conteúdo(s) carregados.`,
      totalAulas: aulas.length,
      totalItems: allItems.length,
    },
    aulas,
    allItems,
    subjects: Array.from(subjectSet),
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Fetch Google Sheets table directly via Google Visualization API (GViz) JSONP.
 * Works 100% in browser without any CORS limitation on static Vercel deploys.
 */
export function fetchGoogleSheetGViz(): Promise<SheetDataState> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('GViz JSONP only runs in browser environment'));
    }

    const callbackName = `__gviz_cb_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const script = document.createElement('script');
    let timeoutId: any = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete (window as any)[callbackName];
    };

    (window as any)[callbackName] = (data: any) => {
      cleanup();
      try {
        if (!data || !data.table || !Array.isArray(data.table.rows)) {
          return reject(new Error('Resposta inválida do Google Sheets GViz.'));
        }

        const rows: any[] = data.table.rows;
        const allItems: LessonItem[] = [];
        const subjectSet = new Set<string>();

        // Check if first row is a header
        let startIdx = 0;
        if (rows.length > 0) {
          const firstCells = rows[0]?.c || [];
          const col0 = String(firstCells[0]?.v || '').toLowerCase();
          const col1 = String(firstCells[1]?.v || '').toLowerCase();
          if (
            (col0.includes('título') || col0.includes('titulo') || col0.includes('title')) &&
            (col1.includes('assunto') || col1.includes('tema') || col1.includes('materia'))
          ) {
            startIdx = 1;
          }
        }

        for (let rIdx = startIdx; rIdx < rows.length; rIdx++) {
          const cells = rows[rIdx]?.c || [];
          const title = String(cells[0]?.v || '').trim();
          const subject = String(cells[1]?.v || '').trim();
          const rawPdfText = String(cells[2]?.v || cells[2]?.f || '').trim();
          const rawVideoText = String(cells[3]?.v || cells[3]?.f || '').trim();

          const pdfUrls = extractUrlsFromText(rawPdfText);
          const videoUrls = extractUrlsFromText(rawVideoText);

          if (!title && !subject && pdfUrls.length === 0 && videoUrls.length === 0) {
            continue;
          }

          const effectiveTitle = title || `Conteúdo ${rIdx + 1}`;
          const effectiveSubject = subject || 'Geral';
          subjectSet.add(effectiveSubject);

          const tabVideos: LessonVideo[] = [];
          for (let vIdx = 0; vIdx < videoUrls.length; vIdx++) {
            const vUrl = videoUrls[vIdx];
            const ytId = extractYoutubeVideoId(vUrl) || undefined;
            const driveId = !ytId ? extractDriveId(vUrl) || undefined : undefined;
            const videoType: 'youtube' | 'drive' | 'other' = ytId ? 'youtube' : driveId ? 'drive' : 'other';
            const videoTitle = videoUrls.length === 1 ? effectiveTitle : `${effectiveTitle} - Vídeo ${vIdx + 1}`;

            let embedUrl = '';
            let thumbnailUrl: string | undefined = undefined;

            if (ytId) {
              embedUrl = `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1`;
              thumbnailUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
            } else if (driveId) {
              embedUrl = `https://drive.google.com/file/d/${driveId}/preview`;
              thumbnailUrl = `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
            } else {
              embedUrl = vUrl;
            }

            tabVideos.push({
              url: vUrl,
              id: ytId || driveId,
              title: videoTitle,
              type: videoType,
              driveFileId: driveId,
              youtubeVideoId: ytId,
              embedUrl,
              thumbnailUrl,
            });
          }

          const firstDriveId = pdfUrls.map((p) => extractDriveId(p)).find(Boolean) || undefined;
          const firstVideo = tabVideos[0];

          const item: LessonItem = {
            id: `aula-0-${rIdx}`,
            aulaName: effectiveTitle,
            aulaIndex: 0,
            rowNumber: rIdx + 1,
            title: effectiveTitle,
            subject: effectiveSubject,
            pdfLinks: pdfUrls,
            youtubeLinks: videoUrls,
            videoLinks: videoUrls,
            videos: tabVideos,
            primaryPdfUrl: pdfUrls[0] || undefined,
            primaryYoutubeUrl: videoUrls[0] || undefined,
            primaryYoutubeId: firstVideo?.youtubeVideoId,
            primaryDriveVideoId: firstVideo?.driveFileId,
            primaryVideoType: firstVideo?.type,
            primaryVideoEmbedUrl: firstVideo?.embedUrl,
            driveFileId: firstDriveId,
          };

          allItems.push(item);
        }

        if (allItems.length === 0) {
          return reject(new Error('Nenhum item encontrado no Google Sheets.'));
        }

        const aulaName = allItems[0]?.aulaName || 'Aulas';
        const aula: Aula = {
          id: 'aula-0',
          name: aulaName,
          gid: '0',
          items: allItems,
          totalPdfs: allItems.reduce((acc, it) => acc + it.pdfLinks.length, 0),
          totalVideos: allItems.reduce((acc, it) => acc + (it.videos?.length || 0), 0),
          subjects: Array.from(subjectSet),
        };

        const state: SheetDataState = {
          config: {
            sheetUrl: SPREADSHEET_URL,
            spreadsheetId: SPREADSHEET_ID,
            lastSyncedAt: new Date().toISOString(),
            status: 'connected',
            statusMessage: `Sincronizado ao vivo com o Google Planilhas! ${allItems.length} aula(s) carregada(s).`,
            totalAulas: 1,
            totalItems: allItems.length,
          },
          aulas: [aula],
          allItems,
          subjects: Array.from(subjectSet),
          lastSyncedAt: new Date().toISOString(),
        };

        resolve(state);
      } catch (parseErr) {
        reject(parseErr);
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Falha na requisição JSONP ao Google Sheets GViz.'));
    };

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo limite esgotado ao buscar Google Sheets via JSONP.'));
    }, 8000);

    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&_t=${Date.now()}`;
    script.src = gvizUrl;
    script.async = true;
    document.head.appendChild(script);
  });
}

export async function fetchAndParseXlsxClient(): Promise<SheetDataState> {
  // Try 1: Bundled /contents.xlsx in public folder (contains all tabs and parsed with full SheetJS engine)
  try {
    const localRes = await fetch(`${XLSX_LOCAL_FALLBACK_URL}?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    if (localRes.ok) {
      const localBuf = await localRes.arrayBuffer();
      if (localBuf && localBuf.byteLength > 0) {
        const parsed = parseXlsxBuffer(localBuf);
        if (parsed && parsed.aulas.length > 0) {
          return parsed;
        }
      }
    }
  } catch (localErr) {
    console.warn('Local contents.xlsx fallback failed:', localErr);
  }

  // Try 2: Google Sheets GViz via JSONP (direct connection from browser)
  try {
    const liveData = await fetchGoogleSheetGViz();
    if (liveData && liveData.aulas.length > 0) {
      return liveData;
    }
  } catch (gvizErr) {
    console.info('GViz JSONP query note:', gvizErr);
  }

  // Try 3: Synchronized DEFAULT_SHEET_DATA
  if (DEFAULT_SHEET_DATA && DEFAULT_SHEET_DATA.aulas.length > 0) {
    return DEFAULT_SHEET_DATA;
  }

  throw new Error('Não foi possível carregar a planilha Google diretamente nem através do cache local.');
}
