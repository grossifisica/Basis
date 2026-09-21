const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/grossifisica/Basis/main/cont.txt';
const GITHUB_REPO_URL = 'https://github.com/grossifisica/Basis/blob/main/cont.txt';

function extractYoutubeVideoId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

function extractDriveId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
  if (match) return match[1];
  const idParam = url.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
  return idParam ? idParam[1] : null;
}

function detectVideoInfo(url?: string) {
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

  const driveId = extractDriveId(url);
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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0');
  res.setHeader('Pragma', 'no-cache');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const timestamp = Date.now();
    const freshUrl = `${GITHUB_RAW_URL}?_t=${timestamp}`;
    const response = await fetch(freshUrl, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`GitHub raw fetch returned status ${response.status}`);
    }

    const text = await response.text();
    const lines = text.split(/\r?\n/);
    const aulas: any[] = [];
    const allItems: any[] = [];
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

      const detectedVideos = videoLinks.map((url, vidIdx) => {
        const info = detectVideoInfo(url);
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
      const primaryDriveId = primaryPdfUrl ? (extractDriveId(primaryPdfUrl) || undefined) : undefined;

      const item = {
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

    const now = new Date().toISOString();
    return res.status(200).json({
      config: {
        sheetUrl: GITHUB_REPO_URL,
        spreadsheetId: 'github-grossifisica-basis',
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
    });
  } catch (err: any) {
    console.error('Error fetching/parsing GitHub content in /api/sheet/data:', err);
    return res.status(500).json({
      error: 'Erro ao carregar o arquivo cont.txt do GitHub',
      details: err.message || String(err),
    });
  }
}
