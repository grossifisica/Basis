import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { extractGoogleDriveFileId, fetchGoogleDrivePdfBuffer } from './server/drive';
import {
  getAllServerDocuments,
  saveServerDocument,
  deleteServerDocument,
  getCachedPdfPath,
  savePdfToCache,
  ServerDocument,
  extractYoutubeVideoId,
} from './server/storage';
import {
  getLatestSheetData,
  syncGoogleSpreadsheet,
  saveSheetConfig,
  getSheetConfig,
  extractSpreadsheetId,
} from './server/googleSheet';
import {
  authenticateStudent,
  getSession,
  invalidateSession,
} from './server/auth';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON and URL-encoded body parsers (limit 50mb for PDF uploads)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // --- API ROUTES FIRST ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // --- STUDENT AUTHENTICATION API (GOOGLE SHEETS) ---
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      const result = await authenticateStudent(username, password);

      if (!result.success) {
        return res.status(401).json({ error: result.message || 'Credenciais inválidas.' });
      }

      res.json({
        success: true,
        user: result.user,
        token: result.token,
      });
    } catch (err: any) {
      console.error('Error in /api/auth/login:', err);
      res.status(500).json({ error: 'Erro ao validar login.' });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
      const session = getSession(token);

      if (!session) {
        return res.status(401).json({ authenticated: false, error: 'Sessão expirada ou inválida.' });
      }

      res.json({
        authenticated: true,
        user: session.user,
      });
    } catch (err: any) {
      console.error('Error in /api/auth/me:', err);
      res.status(500).json({ error: 'Erro ao verificar sessão.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
      invalidateSession(token);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao efetuar logout.' });
    }
  });

  // --- GOOGLE SPREADSHEET (AULAS / VÍDEOS / PDFS) API ---

  // Get current synchronized sheet data (aulas, items, subjects, status)
  app.get('/api/sheet/data', async (req, res) => {
    try {
      const data = await getLatestSheetData();
      res.json(data);
    } catch (err: any) {
      console.error('Error fetching sheet data:', err);
      res.status(500).json({ error: 'Erro ao carregar dados da planilha Google.' });
    }
  });

  // Force re-synchronization with internal Google Spreadsheet
  app.post('/api/sheet/sync', async (req, res) => {
    try {
      const data = await syncGoogleSpreadsheet();
      res.json(data);
    } catch (err: any) {
      console.error('Error synchronizing sheet:', err);
      res.status(400).json({
        error: err.message || 'Falha ao sincronizar com os conteúdos da aula.',
      });
    }
  });

  // Block external configuration: the sheet is fixed and managed remotely by the creator
  app.post('/api/sheet/config', (req, res) => {
    res.status(403).json({
      error: 'A planilha de aulas é interna e gerenciada exclusivamente pelo criador.',
    });
  });

  // Proxy for Google Drive / Docs / Presentations / PDF links from the sheet
  app.get('/api/sheet/pdf-proxy', async (req, res) => {
    try {
      const targetUrl = (req.query.url as string) || '';
      const driveIdParam = (req.query.driveId as string) || '';
      const driveId = driveIdParam || extractGoogleDriveFileId(targetUrl);

      if (driveId) {
        const driveResult = await fetchGoogleDrivePdfBuffer(driveId);
        if (driveResult?.buffer) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Length', driveResult.buffer.length);
          res.setHeader('Accept-Ranges', 'bytes');
          return res.send(driveResult.buffer);
        }
      }

      // If direct PDF url
      if (targetUrl && (targetUrl.endsWith('.pdf') || targetUrl.includes('.pdf?'))) {
        const fetchRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        if (fetchRes.ok) {
          const buffer = Buffer.from(await fetchRes.arrayBuffer());
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Length', buffer.length);
          return res.send(buffer);
        }
      }

      return res.status(404).json({ error: 'PDF não disponível para stream direto.' });
    } catch (err: any) {
      console.error('Error in pdf-proxy:', err);
      res.status(500).json({ error: 'Erro ao obter PDF.' });
    }
  });

  // Get all documents available for anyone visiting the app
  app.get('/api/documents', (req, res) => {
    try {
      const documents = getAllServerDocuments();
      res.json(documents);
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      res.status(500).json({ error: 'Erro ao carregar documentos compartilhados' });
    }
  });

  // Preview / Validate a Google Drive link before saving
  app.post('/api/documents/preview-drive', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || !url.trim()) {
        return res.status(400).json({ error: 'O link do Google Drive é obrigatório.' });
      }

      const fileId = extractGoogleDriveFileId(url);
      if (!fileId) {
        return res.status(400).json({
          error:
            'Formato de link inválido. Cole o link de compartilhamento do Google Drive (ex: https://drive.google.com/file/d/.../view).',
        });
      }

      // Try fetching buffer in background (non-blocking)
      const downloadResult = await fetchGoogleDrivePdfBuffer(fileId);

      return res.json({
        success: true,
        fileId,
        sizeBytes: downloadResult ? downloadResult.size : 0,
        canDirectDownload: Boolean(downloadResult),
        message: downloadResult
          ? 'Link do Google Drive validado com sucesso! Arquivo PDF pronto.'
          : 'Link do Google Drive reconhecido! O documento será visualizado no leitor integrado dentro do aplicativo.',
      });
    } catch (err: any) {
      console.error('Error in preview-drive:', err);
      res.status(500).json({ error: 'Erro inesperado ao validar o link do Google Drive.' });
    }
  });

  // Add / Publish a new document to the shared library
  app.post('/api/documents', async (req, res) => {
    try {
      const {
        title,
        author,
        category,
        description,
        tags,
        sourceType,
        googleDriveUrl,
        fileBase64,
        youtubeUrl,
        youtubeVideoId,
      } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'O título do documento é obrigatório.' });
      }

      const id = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      let sizeBytes = 0;
      let fileId: string | undefined = undefined;

      if (sourceType === 'google-drive') {
        if (!googleDriveUrl) {
          return res.status(400).json({ error: 'O link do Google Drive é obrigatório.' });
        }

        const extractedId = extractGoogleDriveFileId(googleDriveUrl);
        if (!extractedId) {
          return res.status(400).json({
            error:
              'Link do Google Drive inválido. Use um formato como: https://drive.google.com/file/d/.../view',
          });
        }
        fileId = extractedId;

        // Try to fetch binary from Google Drive and cache on server if accessible
        try {
          const driveResult = await fetchGoogleDrivePdfBuffer(fileId);
          if (driveResult?.buffer) {
            sizeBytes = driveResult.size;
            savePdfToCache(id, driveResult.buffer);
          }
        } catch (fetchErr) {
          console.warn('Download direto do Google Drive não concluído, documento usará o visualizador integrado do Drive:', fetchErr);
        }
      } else if (fileBase64) {
        // Direct file upload encoded in base64
        const buffer = Buffer.from(fileBase64, 'base64');
        sizeBytes = buffer.length;
        savePdfToCache(id, buffer);
      } else {
        return res.status(400).json({
          error: 'É necessário fornecer um link do Google Drive ou um arquivo PDF.',
        });
      }

      const parsedYoutubeId = youtubeVideoId || extractYoutubeVideoId(youtubeUrl);

      const newDoc: ServerDocument = {
        id,
        title: title.trim(),
        author: (author || '').trim() || (sourceType === 'google-drive' ? 'Google Drive' : 'Desconhecido'),
        category: category || 'Geral',
        description:
          (description || '').trim() ||
          (sourceType === 'google-drive'
            ? 'Documento PDF importado via link compartilhado do Google Drive.'
            : 'Documento PDF disponibilizado na biblioteca compartilhada.'),
        sizeBytes,
        totalPages: 1,
        uploadedAt: new Date().toISOString(),
        isCustomUpload: true,
        sourceType: sourceType || 'google-drive',
        googleDriveUrl: sourceType === 'google-drive' ? googleDriveUrl : undefined,
        googleDriveFileId: fileId,
        youtubeUrl: youtubeUrl?.trim() || undefined,
        youtubeVideoId: parsedYoutubeId || undefined,
        tags: Array.isArray(tags) && tags.length > 0 ? tags : [category || 'PDF'],
        isFavorite: false,
        progressPercent: 0,
      };

      saveServerDocument(newDoc);
      res.status(201).json(newDoc);
    } catch (err: any) {
      console.error('Error creating document:', err);
      res.status(400).json({
        error: err.message || 'Ocorreu um erro ao disponibilizar o documento.',
      });
    }
  });

  // Stream PDF binary directly for the reader
  app.get('/api/documents/:id/pdf', async (req, res) => {
    try {
      const { id } = req.params;
      const docs = getAllServerDocuments();
      const doc = docs.find((d) => d.id === id);

      // Check if cached locally on server disk
      const cachedPath = getCachedPdfPath(id);
      if (cachedPath) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Accept-Ranges', 'bytes');
        return fs.createReadStream(cachedPath).pipe(res);
      }

      // If it's a Google Drive document not yet cached or cache cleared
      if (doc?.googleDriveFileId) {
        try {
          const driveResult = await fetchGoogleDrivePdfBuffer(doc.googleDriveFileId);
          if (driveResult?.buffer) {
            savePdfToCache(id, driveResult.buffer);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', driveResult.buffer.length);
            return res.send(driveResult.buffer);
          }
        } catch (fetchErr: any) {
          console.warn('Download direto do Google Drive não concluído:', fetchErr?.message || fetchErr);
        }

        // If direct binary download is not possible (e.g. Google Drive bot-protection/cookie checks),
        // return 404 so the client viewer gracefully uses Google Drive's native iframe preview embed
        return res.status(404).json({
          error:
            'Arquivo binário do Google Drive não pôde ser baixado diretamente pelo servidor. Utilize o visualizador integrado do Google Drive.',
        });
      }

      // If document not found or no file available
      return res.status(404).json({ error: 'Arquivo PDF não encontrado.' });
    } catch (err: any) {
      console.error('Error serving PDF:', err);
      res.status(500).json({ error: 'Erro interno ao servir arquivo PDF.' });
    }
  });

  // Delete a document from the shared library
  app.delete('/api/documents/:id', (req, res) => {
    try {
      const { id } = req.params;
      const deleted = deleteServerDocument(id);
      if (deleted) {
        res.json({ success: true, message: 'Documento removido com sucesso.' });
      } else {
        res.status(404).json({ error: 'Documento não encontrado.' });
      }
    } catch (err: any) {
      console.error('Error deleting document:', err);
      res.status(500).json({ error: 'Erro ao remover documento.' });
    }
  });

  // Update document metadata (favorite, progress, YouTube URL, etc.)
  app.patch('/api/documents/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body || {};
      const docs = getAllServerDocuments();
      const doc = docs.find((d) => d.id === id);

      // Process YouTube video URL and ID if provided
      if (updates.youtubeUrl !== undefined) {
        if (typeof updates.youtubeUrl === 'string' && updates.youtubeUrl.trim()) {
          updates.youtubeUrl = updates.youtubeUrl.trim();
          updates.youtubeVideoId = extractYoutubeVideoId(updates.youtubeUrl) || undefined;
        } else {
          updates.youtubeUrl = undefined;
          updates.youtubeVideoId = undefined;
        }
      }

      if (!doc) {
        // Upsert if not currently in server documents list
        const newDoc: ServerDocument = {
          id,
          title: (updates.title || 'Documento').trim(),
          author: (updates.author || 'Autor').trim(),
          category: updates.category || 'Geral',
          description: updates.description || '',
          sizeBytes: updates.sizeBytes || 0,
          totalPages: updates.totalPages || 1,
          uploadedAt: updates.uploadedAt || new Date().toISOString(),
          isCustomUpload: true,
          sourceType: updates.sourceType || 'sample',
          tags: Array.isArray(updates.tags) ? updates.tags : ['PDF'],
          isFavorite: Boolean(updates.isFavorite),
          progressPercent: updates.progressPercent || 0,
          youtubeUrl: updates.youtubeUrl,
          youtubeVideoId: updates.youtubeVideoId,
        };
        saveServerDocument(newDoc);
        return res.json(newDoc);
      }

      const updatedDoc = { ...doc, ...updates };
      if (!updates.youtubeUrl) {
        delete updatedDoc.youtubeUrl;
        delete updatedDoc.youtubeVideoId;
      }
      saveServerDocument(updatedDoc);
      res.json(updatedDoc);
    } catch (err: any) {
      console.error('Error updating document:', err);
      res.status(500).json({ error: 'Erro ao atualizar documento.' });
    }
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    // Sync latest classroom contents from the fixed Google Sheet on startup
    syncGoogleSpreadsheet().catch((err) =>
      console.warn('Initial background sheet sync notice:', err)
    );
  });
}

startServer();
