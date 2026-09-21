import { PdfDocument } from '../types';
import { buildStandardPdf, getSampleDocumentsData } from './pdfGenerator';
import { extractYoutubeVideoId } from './formatters';

const DB_NAME = 'pdf_library_platform_db';
const DB_VERSION = 2;
const STORE_NAME = 'documents';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Convert blob to base64 for server upload
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Validate Google Drive link via server API
export async function validateGoogleDriveLink(url: string): Promise<{
  success: boolean;
  fileId?: string;
  sizeBytes?: number;
  error?: string;
}> {
  try {
    const res = await fetch('/api/documents/preview-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Erro ao validar link' };
    }
    return {
      success: true,
      fileId: data.fileId,
      sizeBytes: data.sizeBytes,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor para validar o link do Google Drive.',
    };
  }
}

// Fetch all documents from server (shared library for all users), syncing with local cache
export async function getAllDocuments(): Promise<PdfDocument[]> {
  const samples = getSampleDocumentsData();

  try {
    const res = await fetch('/api/documents');
    if (res.ok) {
      const serverDocs = (await res.json()) as PdfDocument[];

      // Cache locally into IndexedDB
      try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const doc of serverDocs) {
          store.put(doc);
        }
      } catch (dbErr) {
        console.warn('Falha ao cachear no IndexedDB:', dbErr);
      }

      // Populate blobs for sample docs if needed
      for (const doc of serverDocs) {
        if (!doc.blob && (!doc.sourceType || doc.sourceType === 'sample')) {
          const sample = samples.find((s) => s.id === doc.id);
          const pages = doc.pagesData || (sample ? sample.pages : []);
          if (pages.length > 0) {
            doc.blob = buildStandardPdf(doc.title, doc.author || 'Autor', pages);
            doc.pagesData = pages;
          }
        }
      }

      serverDocs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      return serverDocs;
    }
  } catch (serverErr) {
    console.warn('Servidor inacessível, utilizando cache local do IndexedDB:', serverErr);
  }

  // Fallback to IndexedDB
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const docs = request.result as PdfDocument[];
      for (const doc of docs) {
        if (!doc.blob && (!doc.sourceType || doc.sourceType === 'sample')) {
          const sample = samples.find((s) => s.id === doc.id);
          const pages = doc.pagesData || (sample ? sample.pages : []);
          if (pages.length > 0) {
            doc.blob = buildStandardPdf(doc.title, doc.author || 'Autor', pages);
            doc.pagesData = pages;
          }
        }
      }
      docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      resolve(docs);
    };
    request.onerror = () => reject(request.error);
  });
}

// Fetch a document's PDF blob either from memory, server /api/documents/:id/pdf, or generation
export async function getDocumentPdfBlob(doc: PdfDocument): Promise<Blob> {
  if (doc.blob) {
    return doc.blob;
  }

  // If it has a server-side PDF (Google Drive or server cache)
  try {
    const res = await fetch(`/api/documents/${doc.id}/pdf`);
    if (res.ok) {
      const blob = await res.blob();
      doc.blob = blob;
      return blob;
    }
  } catch (err) {
    console.warn('Erro ao baixar PDF da rota /api:', err);
  }

  // Fallback for sample documents
  const samples = getSampleDocumentsData();
  const sample = samples.find((s) => s.id === doc.id);
  const pages = doc.pagesData || (sample ? sample.pages : []);
  if (pages.length > 0) {
    const blob = buildStandardPdf(doc.title, doc.author || 'Autor', pages);
    doc.blob = blob;
    return blob;
  }

  throw new Error('Não foi possível carregar o arquivo PDF.');
}

// Save document to server (shared for all visitors) and local IndexedDB
export async function saveDocument(doc: PdfDocument): Promise<PdfDocument> {
  let createdDoc = doc;

  try {
    let payload: any = {
      title: doc.title,
      author: doc.author,
      category: doc.category,
      description: doc.description,
      tags: doc.tags,
      sourceType: doc.sourceType || (doc.googleDriveUrl ? 'google-drive' : 'upload'),
      googleDriveUrl: doc.googleDriveUrl,
      youtubeUrl: doc.youtubeUrl,
      youtubeVideoId: doc.youtubeVideoId,
    };

    if (doc.sourceType === 'upload' && doc.blob) {
      payload.fileBase64 = await blobToBase64(doc.blob);
    }

    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const serverDoc = (await res.json()) as PdfDocument;
      createdDoc = { ...serverDoc, blob: doc.blob };
    } else {
      const errData = await res.json();
      throw new Error(errData.error || 'Erro ao salvar documento no servidor');
    }
  } catch (err: any) {
    console.warn('Erro ao salvar no servidor, mantendo localmente:', err);
    // If user provided a google drive URL and it failed on server, propagate error
    if (doc.sourceType === 'google-drive') {
      throw err;
    }
  }

  // Save to IndexedDB
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(createdDoc);
    request.onsuccess = () => resolve(createdDoc);
    request.onerror = () => reject(request.error);
  });
}

// Update document metadata
export async function updateDocument(id: string, updates: Partial<PdfDocument>): Promise<void> {
  const mergedUpdates = { ...updates };
  if (mergedUpdates.youtubeUrl !== undefined) {
    if (mergedUpdates.youtubeUrl && mergedUpdates.youtubeUrl.trim()) {
      mergedUpdates.youtubeUrl = mergedUpdates.youtubeUrl.trim();
      mergedUpdates.youtubeVideoId = extractYoutubeVideoId(mergedUpdates.youtubeUrl) || undefined;
    } else {
      mergedUpdates.youtubeUrl = undefined;
      mergedUpdates.youtubeVideoId = undefined;
    }
  }

  try {
    await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mergedUpdates),
    });
  } catch {
    // ignore server update error for transient fields
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const existing = getReq.result as PdfDocument | undefined;
      if (!existing) {
        resolve();
        return;
      }
      const updated = { ...existing, ...mergedUpdates };
      if (!mergedUpdates.youtubeUrl) {
        delete updated.youtubeUrl;
        delete updated.youtubeVideoId;
      }
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

// Delete document from shared server library and local IndexedDB
export async function deleteDocument(id: string): Promise<void> {
  try {
    await fetch(`/api/documents/${id}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Erro ao deletar no servidor:', err);
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function seedInitialDocuments(): Promise<PdfDocument[]> {
  return await getAllDocuments();
}

export async function resetToDefaultSamples(): Promise<PdfDocument[]> {
  return await getAllDocuments();
}
