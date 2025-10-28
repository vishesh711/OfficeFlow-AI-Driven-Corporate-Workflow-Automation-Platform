import {
  Document,
  DocumentVersion,
  DocumentAccess,
  DocumentUploadRequest,
  DocumentDownloadRequest,
  DocumentSearchQuery,
  DocumentSearchResult,
  SecureUrl,
  StorageProvider,
  DocumentStats,
} from '../types/document-types';
import { DocumentRepository } from '../repositories/document-repository';
import { MinioStorageProvider } from '../storage/minio-provider';
import { S3StorageProvider } from '../storage/s3-provider';
import { getDocumentConfig } from '../config/document-config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import path from 'path';
import mime from 'mime-types';
import sharp from 'sharp';
import fs from 'fs';

export class DocumentService {
  private storageProvider: StorageProvider;
  private documentRepository: DocumentRepository;
  private config = getDocumentConfig();

  constructor() {
    this.documentRepository = new DocumentRepository();
    this.initializeStorageProvider();
  }

  private initializeStorageProvider(): void {
    if (this.config.storageProvider === 'minio' && this.config.minio) {
      this.storageProvider = new MinioStorageProvider(this.config.minio, this.config.storageBucket);
    } else if (this.config.storageProvider === 's3' && this.config.aws) {
      this.storageProvider = new S3StorageProvider(this.config.aws, this.config.aws.bucket);
    } else {
      throw new Error('Invalid storage provider configuration');
    }
  }

  public async initialize(): Promise<void> {
    await this.storageProvider.initialize();

    // Ensure temp directory exists
    if (!fs.existsSync(this.config.tempDir)) {
      fs.mkdirSync(this.config.tempDir, { recursive: true });
    }
  }

  public async uploadDocument(request: DocumentUploadRequest): Promise<Document> {
    try {
      // Validate file
      this.validateFile(request.file);

      // Generate document ID and storage key
      const documentId = uuidv4();
      const fileExtension = path.extname(request.file.originalname);
      const storageKey = `${request.organizationId}/${documentId}${fileExtension}`;

      // Calculate checksum
      const checksum = crypto.createHash('sha256').update(request.file.buffer).digest('hex');

      // Upload file to storage
      await this.storageProvider.upload(storageKey, request.file.buffer, request.file.mimetype);

      // Create document record
      const document: Document = {
        documentId,
        organizationId: request.organizationId,
        name: request.name,
        originalName: request.file.originalname,
        description: request.description,
        mimeType: request.file.mimetype,
        size: request.file.size,
        storageKey,
        version: 1,
        tags: request.tags || [],
        metadata: {
          ...request.metadata,
          checksum,
          uploadedFrom: 'api',
        },
        uploadedBy: request.uploadedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      // Save to database
      await this.documentRepository.createDocument(document);

      // Create initial version
      const version: DocumentVersion = {
        versionId: uuidv4(),
        documentId,
        version: 1,
        storageKey,
        size: request.file.size,
        checksum,
        uploadedBy: request.uploadedBy,
        createdAt: new Date(),
        changeLog: 'Initial upload',
      };

      await this.documentRepository.createDocumentVersion(version);

      // Set up access permissions
      if (request.permissions) {
        const access: DocumentAccess = {
          accessId: uuidv4(),
          documentId,
          organizationId: request.organizationId,
          permissions: request.permissions,
          expiresAt: request.expiresAt,
          createdAt: new Date(),
          createdBy: request.uploadedBy,
        };

        await this.documentRepository.createDocumentAccess(access);
      }

      // Generate thumbnail for images
      if (this.isImageFile(request.file.mimetype)) {
        await this.generateThumbnail(document);
      }

      logger.info('Document uploaded successfully', {
        documentId,
        name: request.name,
        size: request.file.size,
        organizationId: request.organizationId,
      });

      return document;
    } catch (error) {
      logger.error('Failed to upload document', {
        error: error.message,
        name: request.name,
        organizationId: request.organizationId,
      });
      throw error;
    }
  }

  public async downloadDocument(
    request: DocumentDownloadRequest
  ): Promise<{ buffer: Buffer; document: Document }> {
    try {
      // Check access permissions
      const hasAccess = await this.checkDocumentAccess(
        request.documentId,
        request.userId,
        request.organizationId,
        'read'
      );

      if (!hasAccess) {
        throw new Error('Access denied');
      }

      // Get document
      const document = await this.documentRepository.getDocument(request.documentId);
      if (!document || !document.isActive) {
        throw new Error('Document not found');
      }

      let storageKey = document.storageKey;

      // If specific version requested
      if (request.version && request.version !== document.version) {
        const version = await this.documentRepository.getDocumentVersion(
          request.documentId,
          request.version
        );
        if (!version) {
          throw new Error('Document version not found');
        }
        storageKey = version.storageKey;
      }

      // Download from storage
      const buffer = await this.storageProvider.download(storageKey);

      logger.info('Document downloaded', {
        documentId: request.documentId,
        version: request.version || document.version,
        size: buffer.length,
      });

      return { buffer, document };
    } catch (error) {
      logger.error('Failed to download document', {
        error: error.message,
        documentId: request.documentId,
      });
      throw error;
    }
  }

  public async generateSecureUrl(
    documentId: string,
    userId: string | undefined,
    organizationId: string,
    expiresInHours: number = 24
  ): Promise<SecureUrl> {
    try {
      // Check access permissions
      const hasAccess = await this.checkDocumentAccess(documentId, userId, organizationId, 'read');
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      // Get document
      const document = await this.documentRepository.getDocument(documentId);
      if (!document || !document.isActive) {
        throw new Error('Document not found');
      }

      // Generate presigned URL
      const expiresIn = expiresInHours * 3600; // Convert to seconds
      const url = await this.storageProvider.generatePresignedUrl(document.storageKey, expiresIn);

      const secureUrl: SecureUrl = {
        url,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };

      logger.info('Generated secure URL', {
        documentId,
        expiresInHours,
      });

      return secureUrl;
    } catch (error) {
      logger.error('Failed to generate secure URL', {
        error: error.message,
        documentId,
      });
      throw error;
    }
  }

  public async searchDocuments(query: DocumentSearchQuery): Promise<DocumentSearchResult> {
    try {
      return await this.documentRepository.searchDocuments(query);
    } catch (error) {
      logger.error('Failed to search documents', {
        error: error.message,
        organizationId: query.organizationId,
      });
      throw error;
    }
  }

  public async updateDocument(
    documentId: string,
    updates: Partial<Document>,
    userId: string
  ): Promise<Document> {
    try {
      // Check access permissions
      const hasAccess = await this.checkDocumentAccess(
        documentId,
        userId,
        updates.organizationId!,
        'write'
      );
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      const updatedDocument = await this.documentRepository.updateDocument(documentId, {
        ...updates,
        updatedAt: new Date(),
      });

      logger.info('Document updated', { documentId });
      return updatedDocument;
    } catch (error) {
      logger.error('Failed to update document', {
        error: error.message,
        documentId,
      });
      throw error;
    }
  }

  public async deleteDocument(
    documentId: string,
    userId: string,
    organizationId: string
  ): Promise<void> {
    try {
      // Check access permissions
      const hasAccess = await this.checkDocumentAccess(
        documentId,
        userId,
        organizationId,
        'delete'
      );
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      // Get document
      const document = await this.documentRepository.getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Soft delete in database
      await this.documentRepository.updateDocument(documentId, {
        isActive: false,
        updatedAt: new Date(),
      });

      // Optionally delete from storage (uncomment if hard delete is preferred)
      // await this.storageProvider.delete(document.storageKey);

      logger.info('Document deleted', { documentId });
    } catch (error) {
      logger.error('Failed to delete document', {
        error: error.message,
        documentId,
      });
      throw error;
    }
  }

  public async getDocumentStats(organizationId: string): Promise<DocumentStats> {
    try {
      return await this.documentRepository.getDocumentStats(organizationId);
    } catch (error) {
      logger.error('Failed to get document stats', {
        error: error.message,
        organizationId,
      });
      throw error;
    }
  }

  private async checkDocumentAccess(
    documentId: string,
    userId: string | undefined,
    organizationId: string,
    action: 'read' | 'write' | 'delete' | 'share'
  ): Promise<boolean> {
    try {
      // Get document access rules
      const accessRules = await this.documentRepository.getDocumentAccess(documentId);

      // If no specific access rules, check organization membership
      if (accessRules.length === 0) {
        return true; // Default allow for organization members
      }

      // Check specific access rules
      for (const rule of accessRules) {
        if (rule.organizationId !== organizationId) {
          continue;
        }

        // Check if access has expired
        if (rule.expiresAt && rule.expiresAt < new Date()) {
          continue;
        }

        // Check user-specific access
        if (rule.userId && rule.userId !== userId) {
          continue;
        }

        // Check permission
        const permission = rule.permissions.find((p) => p.action === action);
        if (permission && permission.granted) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to check document access', {
        error: error.message,
        documentId,
        userId,
        action,
      });
      return false;
    }
  }

  private validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
    }

    // Check file type
    const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
    if (!this.config.allowedFileTypes.includes(fileExtension)) {
      throw new Error(`File type '${fileExtension}' is not allowed`);
    }

    // Validate MIME type
    const expectedMimeType = mime.lookup(file.originalname);
    if (expectedMimeType && expectedMimeType !== file.mimetype) {
      throw new Error('File MIME type does not match file extension');
    }
  }

  private isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private async generateThumbnail(document: Document): Promise<void> {
    try {
      // Download original image
      const buffer = await this.storageProvider.download(document.storageKey);

      // Generate thumbnail
      const thumbnailBuffer = await sharp(buffer)
        .resize(this.config.thumbnailSize, this.config.thumbnailSize, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Upload thumbnail
      const thumbnailKey = `thumbnails/${document.documentId}.jpg`;
      await this.storageProvider.upload(thumbnailKey, thumbnailBuffer, 'image/jpeg');

      // Update document metadata
      await this.documentRepository.updateDocument(document.documentId, {
        metadata: {
          ...document.metadata,
          thumbnailKey,
        },
      });

      logger.info('Thumbnail generated', {
        documentId: document.documentId,
        thumbnailKey,
      });
    } catch (error) {
      logger.error('Failed to generate thumbnail', {
        error: error.message,
        documentId: document.documentId,
      });
      // Don't throw error as thumbnail generation is optional
    }
  }
}
