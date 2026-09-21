import fs from 'fs';
import path from 'path';
import { extractGoogleDriveFileId, fetchGoogleDrivePdfBuffer } from './drive';

export interface ServerDocument {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  sizeBytes: number;
  totalPages?: number;
  uploadedAt: string;
  isCustomUpload?: boolean;
  sourceType: 'google-drive' | 'upload' | 'sample';
  googleDriveUrl?: string;
  googleDriveFileId?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  tags: string[];
  lastReadAt?: string;
  progressPercent?: number;
  isFavorite?: boolean;
  notes?: Array<{
    id: string;
    pageNumber?: number;
    text: string;
    createdAt: string;
  }>;
}

export function extractYoutubeVideoId(input?: string): string | null {
  if (!input) return null;
  let trimmed = input.trim();
  const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (iframeMatch) {
    trimmed = iframeMatch[1];
  }
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (shortMatch) return shortMatch[1];
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (watchMatch) return watchMatch[1];
  const embedMatch = trimmed.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  if (embedMatch) return embedMatch[1];
  const liveMatch = trimmed.match(/youtube\.com\/(?:live|shorts|v)\/([a-zA-Z0-9_-]{11})/i);
  if (liveMatch) return liveMatch[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');
const CACHE_DIR = path.join(DATA_DIR, 'pdf-cache');

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// Initial seed documents if none exist
function getInitialSeedDocuments(): ServerDocument[] {
  return [
    {
      id: 'doc-manual-plataforma',
      title: 'Guia Rápido da Biblioteca de PDFs',
      author: 'Equipe de Documentação',
      category: 'Manuais',
      description:
        'Aprenda a consultar o catálogo, ler documentos com o motor embed, adicionar links do Google Drive e compartilhar PDFs para todos.',
      sizeBytes: 42500,
      totalPages: 3,
      uploadedAt: new Date().toISOString(),
      isCustomUpload: false,
      sourceType: 'sample',
      tags: ['Manual', 'Tutorial', 'Google Drive', 'Compartilhamento'],
      isFavorite: true,
      progressPercent: 20,
      youtubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      youtubeVideoId: 'M7lc1UVf-VE',
    },
    {
      id: 'doc-relatorio-ia-2026',
      title: 'Panorama de Inteligência Artificial e Produtividade',
      author: 'Instituto de Tecnologia & Futuro',
      category: 'Artigos',
      description:
        'Análise aprofundada sobre a integração de modelos generativos, automação de fluxos corporativos e leitura digital.',
      sizeBytes: 68400,
      totalPages: 4,
      uploadedAt: new Date(Date.now() - 86400000).toISOString(),
      isCustomUpload: false,
      sourceType: 'sample',
      tags: ['IA', 'Tecnologia', 'Inovação', 'Pesquisa'],
      isFavorite: false,
      progressPercent: 0,
    },
    {
      id: 'doc-guia-design-sistemas',
      title: 'Design Systems e Interfaces Modernas',
      author: 'Laboratório de Experiência do Usuário',
      category: 'Design',
      description:
        'Princípios fundamentais de hierarquia visual, tipografia refinada e padrões de usabilidade para produtos digitais.',
      sizeBytes: 54100,
      totalPages: 3,
      uploadedAt: new Date(Date.now() - 172800000).toISOString(),
      isCustomUpload: false,
      sourceType: 'sample',
      tags: ['Design', 'UI/UX', 'Tipografia', 'Layout'],
      isFavorite: false,
      progressPercent: 0,
    },
  ];
}

export function getAllServerDocuments(): ServerDocument[] {
  ensureDirectories();
  if (!fs.existsSync(DOCUMENTS_FILE)) {
    const initial = getInitialSeedDocuments();
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }

  try {
    const raw = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
    const docs = JSON.parse(raw) as ServerDocument[];
    return docs;
  } catch (err) {
    console.error('Erro lendo documents.json:', err);
    return [];
  }
}

export function saveServerDocument(doc: ServerDocument): void {
  ensureDirectories();
  const docs = getAllServerDocuments();
  const index = docs.findIndex((d) => d.id === doc.id);
  if (index >= 0) {
    docs[index] = doc;
  } else {
    docs.unshift(doc);
  }
  fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(docs, null, 2), 'utf-8');
}

export function deleteServerDocument(id: string): boolean {
  ensureDirectories();
  const docs = getAllServerDocuments();
  const filtered = docs.filter((d) => d.id !== id);
  if (filtered.length !== docs.length) {
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    // Also remove cached file if exists
    const cachePath = path.join(CACHE_DIR, `${id}.pdf`);
    if (fs.existsSync(cachePath)) {
      try {
        fs.unlinkSync(cachePath);
      } catch {
        // ignore
      }
    }
    return true;
  }
  return false;
}

export function getCachedPdfPath(id: string): string | null {
  ensureDirectories();
  const cachePath = path.join(CACHE_DIR, `${id}.pdf`);
  if (fs.existsSync(cachePath)) {
    return cachePath;
  }
  return null;
}

export function savePdfToCache(id: string, buffer: Buffer): string {
  ensureDirectories();
  const cachePath = path.join(CACHE_DIR, `${id}.pdf`);
  fs.writeFileSync(cachePath, buffer);
  return cachePath;
}
