export function extractGoogleDriveFileId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const fileDMatch = trimmed.match(/\/(?:file|document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]{20,})/);
  if (fileDMatch) return fileDMatch[1];
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (idMatch) return idMatch[1];
  const openMatch = trimmed.match(/\/open\?[^#]*id=([a-zA-Z0-9_-]{20,})/);
  if (openMatch) return openMatch[1];
  const shortDMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (shortDMatch) return shortDMatch[1];
  if (/^[a-zA-Z0-9_-]{25,45}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const targetUrl = (req.query.url as string) || '';
  const driveIdParam = (req.query.driveId as string) || '';
  const driveId = driveIdParam || extractGoogleDriveFileId(targetUrl);

  if (!driveId && !targetUrl) {
    return res.status(400).json({ error: 'URL ou driveId ausente' });
  }

  // If Google Drive file ID
  if (driveId) {
    const candidateUrls = [
      `https://drive.usercontent.google.com/download?id=${driveId}&export=download&authuser=0&confirm=t`,
      `https://drive.google.com/uc?export=download&id=${driveId}&confirm=t`,
      `https://docs.google.com/document/d/${driveId}/export?format=pdf`,
    ];

    for (const u of candidateUrls) {
      try {
        const fetchRes = await fetch(u, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'application/pdf,*/*;q=0.9',
          },
          redirect: 'follow',
        });

        if (fetchRes.ok) {
          const buf = Buffer.from(await fetchRes.arrayBuffer());
          if (buf.slice(0, 5).toString('ascii').startsWith('%PDF')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', buf.length);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.send(buf);
          }
        }
      } catch (err) {
        // continue to next candidate
      }
    }
  }

  // Redirect to embedded viewer
  const redirectUrl = driveId
    ? `https://drive.google.com/file/d/${driveId}/preview`
    : `https://docs.google.com/viewer?url=${encodeURIComponent(targetUrl)}&embedded=true`;

  return res.redirect(302, redirectUrl);
}
