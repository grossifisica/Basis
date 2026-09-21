export interface PageSection {
  heading?: string;
  paragraphs: string[];
}

export interface DocumentPageData {
  headerTitle: string;
  sections: PageSection[];
}

export interface PdfDocument {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  sizeBytes: number;
  totalPages?: number;
  uploadedAt: string;
  isCustomUpload?: boolean;
  sourceType?: 'google-drive' | 'upload' | 'sample';
  googleDriveUrl?: string;
  googleDriveFileId?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  blob?: Blob;
  dataUrl?: string;
  tags: string[];
  lastReadAt?: string;
  progressPercent?: number;
  isFavorite?: boolean;
  notes?: DocumentNote[];
  pagesData?: DocumentPageData[];
}

export interface DocumentNote {
  id: string;
  pageNumber?: number;
  text: string;
  createdAt: string;
}

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

export interface StudentUser {
  firstName: string;
  lastName: string;
  fullName: string;
  username: string;
  entryDate?: string;
  phone?: string;
  email?: string;
}

export interface LessonItem {
  id: string;
  aulaName: string; // Nome da aba (ex: "Aula 1", "Aula 2")
  aulaIndex: number;
  rowNumber: number;
  title: string; // Coluna A: Título (ex: "MCU")
  subject: string; // Coluna B: Assunto (ex: "Mecânica")
  pdfLinks: string[]; // Coluna C: Link/links das listas de exercícios em PDF
  youtubeLinks: string[]; // Coluna D: Link/links dos vídeos (Google Drive ou YouTube)
  videoLinks?: string[]; // Alias para todos os links de vídeo
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

export type ViewMode = 'embed' | 'grid' | 'list';

export type CategoryFilter = 'all' | string;

export interface FilterState {
  searchQuery: string;
  category: CategoryFilter;
  sortBy: 'recent' | 'title' | 'size' | 'reading';
  onlyFavorites: boolean;
}
