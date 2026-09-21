import { SheetDataState } from '../types';
import { DEFAULT_SHEET_DATA } from '../data/defaultSheetData';
import { fetchGitHubContent } from './githubContentParser';

const CACHE_STORAGE_KEY = 'didatic_classroom_github_content_v2';

export async function fetchSheetData(): Promise<SheetDataState> {
  // 1. Live fetch from GitHub (raw with anti-cache timestamp and API fallback)
  try {
    const liveData = await fetchGitHubContent();
    if (liveData && Array.isArray(liveData.aulas) && liveData.aulas.length > 0) {
      try {
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(liveData));
      } catch {
        // ignore quota
      }
      return liveData;
    }
  } catch (gitErr) {
    console.warn('Direct GitHub fetch failed, attempting server or local fallback:', gitErr);
  }

  // 2. Try server endpoint (for full-stack or Vercel serverless proxy if available)
  try {
    const response = await fetch(`/api/sheet/data?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
    });
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const data = await response.json();
      if (data && Array.isArray(data.aulas) && data.aulas.length > 0) {
        try {
          localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(data));
        } catch {
          // ignore
        }
        return data;
      }
    }
  } catch {
    // ignore
  }

  // 3. Fallback to browser cache if previously fetched
  try {
    const local = localStorage.getItem(CACHE_STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && Array.isArray(parsed.aulas) && parsed.aulas.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  // 4. Static fallback data from cont.txt so the app never shows blank/error state
  return DEFAULT_SHEET_DATA;
}

export async function triggerSheetSync(): Promise<SheetDataState> {
  // Force clear browser cache to guarantee immediate reflection of GitHub changes
  try {
    localStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    // ignore
  }

  // Live re-fetch from GitHub cont.txt
  try {
    const freshData = await fetchGitHubContent();
    if (freshData && Array.isArray(freshData.aulas) && freshData.aulas.length > 0) {
      try {
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(freshData));
      } catch {
        // ignore
      }
      return freshData;
    }
  } catch (err) {
    console.warn('Direct GitHub sync error, falling back to fetchSheetData():', err);
  }

  return fetchSheetData();
}

