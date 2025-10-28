import { Router, Request, Response } from 'express';
import multer from 'multer';
import { DocumentService } from '../services/document-service';
import { DocumentUploadRequest, DocumentSearchQuery } from '../types/document-types';
import { logger } from '../utils/logger';
import { getDocumentConfig } from '../config/document-config';

const router = Router();
const documentService = new DocumentService();
const config = getDocumentConfig();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    if (fileExtension && config.allowedFileTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${fileExtension}' is not allowed`));
    }
  },
});

// Upload document
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided',
      });
    }

    const uploadRequest: DocumentUploadRequest = {
      organizationId: req.body.organizationId,
      name: req.body.name || req.file.originalname,
      description: req.body.description,
      tags: req.body.tags ? JSON.parse(req.body.tags) : undefined,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined,
      uploadedBy: req.body.uploadedBy,
      file: req.file,
      permissions: req.body.permissions ? JSON.parse(req.body.permissions) : undefined,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
    };

    const document = await documentService.uploadDocument(uploadRequest);

    res.status(201).json({
      success: true,
      document,
    });
  } catch (error) {
    logger.error('Document upload API error', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Download document
router.get('/download/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { userId, organizationId, version } = req.query;

    const downloadRequest = {
      documentId,
      userId: userId as string,
      organizationId: organizationId as string,
      version: version ? parseInt(version as string) : undefined,
    };

    const { buffer, document } = await documentService.downloadDocument(downloadRequest);

    res.set({
      'Content-Type': document.mimeType,
      'Content-Length': buffer.length.toString(),
      'Content-Disposition': `attachment; filename="${document.originalName}"`,
    });

    res.send(buffer);
  } catch (error) {
    logger.error('Document download API error', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Generate secure URL
router.post('/secure-url/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { userId, organizationId, expiresInHours } = req.body;

    const secureUrl = await documentService.generateSecureUrl(
      documentId,
      userId,
      organizationId,
      expiresInHours || 24
    );

    res.json({
      success: true,
      secureUrl,
    });
  } catch (error) {
    logger.error('Secure URL generation API error', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Search documents
router.post('/search', async (req: Request, res: Response) => {
  try {
    const searchQuery: DocumentSearchQuery = {
      organizationId: req.body.organizationId,
      query: req.body.query,
      tags: req.body.tags,
      mimeTypes: req.body.mimeTypes,
      uploadedBy: req.body.uploadedBy,
      dateFrom: req.body.dateFrom ? new Date(req.body.dateFrom) : undefined,
      dateTo: req.body.dateTo ? new Date(req.body.dateTo) : undefined,
      limit: req.body.limit || 50,
      offset: req.body.offset || 0,
    };

    const result = await documentService.searchDocuments(searchQuery);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Document search API error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get document details
router.get('/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { userId, organizationId } = req.query;

    // Check access first
    const hasAccess = await documentService['checkDocumentAccess'](
      documentId,
      userId as string,
      organizationId as string,
      'read'
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const document = await documentService['documentRepository'].getDocument(documentId);

    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    res.json({
      success: true,
      document,
    });
  } catch (error) {
    logger.error('Get document API error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update document
router.put('/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { userId, ...updates } = req.body;

    const document = await documentService.updateDocument(documentId, updates, userId);

    res.json({
      success: true,
      document,
    });
  } catch (error) {
    logger.error('Document update API error', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete document
router.delete('/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { userId, organizationId } = req.body;

    await documentService.deleteDocument(documentId, userId, organizationId);

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    logger.error('Document deletion API error', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get document statistics
router.get('/stats/:organizationId', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const stats = await documentService.getDocumentStats(organizationId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Document stats API error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      status: 'healthy',
      storage: config.storageProvider,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
