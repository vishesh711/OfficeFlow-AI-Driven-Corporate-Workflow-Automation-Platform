export interface Document {
  documentId: string;
  organizationId: string;
  name: string;
  originalName: string;
  description?: string;
  mimeType: string;
  size: number;
  storageKey: string;
  version: number;
  tags: string[];
  metadata: Record<string, any>;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface DocumentVersion {
  versionId: string;
  documentId: string;
  version: number;
  storageKey: string;
  size: number;
  checksum: string;
  uploadedBy: string;
  createdAt: Date;
  changeLog?: string;
}

export interface DocumentAccess {
  accessId: string;
  documentId: string;
  userId?: string;
  role?: string;
  organizationId: string;
  permissions: DocumentPermission[];
  expiresAt?: Date;
  createdAt: Date;
  createdBy: string;
}

export interface DocumentPermission {
  action: 'read' | 'write' | 'delete' | 'share';
  granted: boolean;
}

export interface DocumentUploadRequest {
  organizationId: string;
  name: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  uploadedBy: string;
  file: Express.Multer.File;
  permissions?: DocumentPermission[];
  expiresAt?: Date;
}

export interface DocumentDownloadRequest {
  documentId: string;
  userId?: string;
  organizationId: string;
  version?: number;
}

export interface DocumentSearchQuery {
  organizationId: string;
  query?: string;
  tags?: string[];
  mimeTypes?: string[];
  uploadedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface DocumentSearchResult {
  documents: Document[];
  total: number;
  hasMore: boolean;
}

export interface SecureUrl {
  url: string;
  expiresAt: Date;
  accessToken?: string;
}

export interface StorageProvider {
  name: string;
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  generatePresignedUrl(key: string, expiresIn: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}

export interface DocumentStats {
  totalDocuments: number;
  totalSize: number;
  documentsByType: Record<string, number>;
  uploadsByMonth: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
}