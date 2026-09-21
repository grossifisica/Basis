export function extractGoogleDriveFileId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Pattern 1: /file/d/FILE_ID or /document/d/FILE_ID or /presentation/d/FILE_ID or /spreadsheets/d/FILE_ID
  const fileDMatch = trimmed.match(/\/(?:file|document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]{20,})/);
  if (fileDMatch) return fileDMatch[1];

  // Pattern 2: id=FILE_ID or ?id=FILE_ID or &id=FILE_ID
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (idMatch) return idMatch[1];

  // Pattern 3: /open?id=FILE_ID
  const openMatch = trimmed.match(/\/open\?[^#]*id=([a-zA-Z0-9_-]{20,})/);
  if (openMatch) return openMatch[1];

  // Pattern 4: /d/FILE_ID
  const shortDMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (shortDMatch) return shortDMatch[1];

  // Pattern 5: Raw file ID
  if (/^[a-zA-Z0-9_-]{25,45}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

// Fast in-memory cache for PDF buffers to eliminate repeated slow downloads and flickering
const pdfBufferCache = new Map<string, { buffer: Buffer; size: number; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour cache

export async function fetchGoogleDrivePdfBuffer(
  fileId: string
): Promise<{ buffer: Buffer; size: number } | null> {
  const cached = pdfBufferCache.get(fileId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { buffer: cached.buffer, size: cached.size };
  }

  const candidateUrls = [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://drive.google.com/uc?id=${fileId}&export=download`,
    `https://docs.google.com/document/d/${fileId}/export?format=pdf`,
    `https://docs.google.com/presentation/d/${fileId}/export/pdf`,
  ];

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/pdf,*/*;q=0.9',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      const setCookies = response.headers.get('set-cookie') || '';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Verify if it's a PDF (magic number %PDF-)
      const magic = buffer.slice(0, 5).toString('ascii');
      if (magic.startsWith('%PDF')) {
        pdfBufferCache.set(fileId, { buffer, size: buffer.length, timestamp: Date.now() });
        return { buffer, size: buffer.length };
      }

      // If it returned HTML with confirm token
      if (contentType.includes('text/html') || buffer.slice(0, 10).toString().includes('<html')) {
        const html = buffer.toString('utf-8');

        // Try to follow confirm link or form action if Google Drive virus warning page was returned
        const confirmMatch =
          html.match(/href="(\/download\?[^"]*confirm=[^"]*)"/) ||
          html.match(/href="(https:\/\/drive\.usercontent\.google\.com\/download\?[^"]*)"/) ||
          html.match(/action="([^"]*download[^"]*)"/);

        if (confirmMatch) {
          let nextUrl = confirmMatch[1].replace(/&amp;/g, '&');
          if (nextUrl.startsWith('/')) {
            nextUrl = `https://drive.google.com${nextUrl}`;
          }

          // If confirm token is an input in the form
          if (!nextUrl.includes('confirm=')) {
            const tokenMatch = html.match(/name="confirm"\s+value="([^"]+)"/);
            if (tokenMatch) {
              nextUrl += (nextUrl.includes('?') ? '&' : '?') + `confirm=${tokenMatch[1]}`;
            }
          }

          const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'application/pdf,*/*;q=0.9',
          };
          if (setCookies) {
            headers['Cookie'] = setCookies;
          }

          const secondResp = await fetch(nextUrl, {
            headers,
            redirect: 'follow',
          });

          if (secondResp.ok) {
            const secondBuf = Buffer.from(await secondResp.arrayBuffer());
            if (secondBuf.slice(0, 5).toString('ascii').startsWith('%PDF')) {
              pdfBufferCache.set(fileId, { buffer: secondBuf, size: secondBuf.length, timestamp: Date.now() });
              return { buffer: secondBuf, size: secondBuf.length };
            }
          }
        }
      }
    } catch {
      // Continue to next candidate URL
    }
  }

  // If binary cannot be directly fetched by server (common due to Google Drive bot protection),
  // return null so the application seamlessly falls back to Google Drive's native embed viewer
  return null;
}
