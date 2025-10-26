import { Pool } from 'pg';
import {
  Document,
  DocumentVersion,
  DocumentAccess,
  DocumentSearchQuery,
  DocumentSearchResult,
  DocumentStats,
} from '../types/document-types';
import { getConnection } from '@officeflow/database';
import { logger } from '../utils/logger';

export class DocumentRepository {
  private db: Pool;

  constructor() {
    this.db = getConnection();
  }

  public async createDocument(document: Document): Promise<void> {
    const query = `
      INSERT INTO documents (
        document_id, organization_id, name, original_name, description, mime_type,
        size, storage_key, version, tags, metadata, uploaded_by, created_at, updated_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `;

    const values = [
      document.documentId,
      document.organizationId,
      document.name,
      document.originalName,
      document.description,
      document.mimeType,
      document.size,
      document.storageKey,
      document.version,
      JSON.stringify(document.tags),
      JSON.stringify(document.metadata),
      document.uploadedBy,
      document.createdAt,
      document.updatedAt,
      document.isActive,
    ];

    try {
      await this.db.query(query, values);
      logger.info('Document created in database', { documentId: document.documentId });
    } catch (error) {
      logger.error('Failed to create document in database', {
        error: error.message,
        documentId: document.documentId,
      });
      throw error;
    }
  }

  public async getDocument(documentId: string): Promise<Document | null> {
    const query = `
      SELECT document_id, organization_id, name, original_name, description, mime_type,
             size, storage_key, version, tags, metadata, uploaded_by, created_at, updated_at, is_active
      FROM documents 
      WHERE document_id = $1
    `;

    try {
      const result = await this.db.query(query, [documentId]);
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return this.mapRowToDocument(row);
    } catch (error) {
      logger.error('Failed to get document from database', {
        error: error.message,
        documentId,
      });
      throw error;
    }
  }

  public async updateDocument(documentId: string, updates: Partial<Document>): Promise<Document> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const dbColumn = this.camelToSnake(key);
        if (key === 'tags' || key === 'metadata') {
          setClause.push(`${dbColumn} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          setClause.push(`${dbColumn} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    values.push(documentId);
    const query = `
      UPDATE documents 
      SET ${setClause.join(', ')}
      WHERE document_id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, values);
      if (result.rows.length === 0) {
        throw new Error(`Document ${documentId} not found`);
      }

      logger.info('Document updated in database', { documentId });
      return this.mapRowToDocument(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update document in database', {
        error: error.message,
        documentId,
      });
      throw error;
    }
  }

  public async searchDocuments(query: DocumentSearchQuery): Promise<DocumentSearchResult> {
    const conditions = ['d.organization_id = $1', 'd.is_active = true'];
    const values: any[] = [query.organizationId];
    let paramIndex = 2;

    if (query.query) {
      conditions.push(`(d.name ILIKE $${paramIndex} OR d.description ILIKE $${paramIndex})`);
      values.push(`%${query.query}%`);
      paramIndex++;
    }

    if (query.tags && query.tags.length > 0) {
      conditions.push(`d.tags ?| $${paramIndex}`);
      values.push(query.tags);
      paramIndex++;
    }

    if (query.mimeTypes && query.mimeTypes.length > 0) {
      conditions.push(`d.mime_type = ANY($${paramIndex})`);
      values.push(query.mimeTypes);
      paramIndex++;
    }

    if (query.uploadedBy) {
      conditions.push(`d.uploaded_by = $${paramIndex}`);
      values.push(query.uploadedBy);
      paramIndex++;
    }

    if (query.dateFrom) {
      conditions.push(`d.created_at >= $${paramIndex}`);
      values.push(query.dateFrom);
      paramIndex++;
    }

    if (query.dateTo) {
      conditions.push(`d.created_at <= $${paramIndex}`);
      values.push(query.dateTo);
      paramIndex++;
    }

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM documents d
      WHERE ${conditions.join(' AND ')}
    `;

    const searchQuery = `
      SELECT d.document_id, d.organization_id, d.name, d.original_name, d.description, d.mime_type,
             d.size, d.storage_key, d.version, d.tags, d.metadata, d.uploaded_by, d.created_at, d.updated_at, d.is_active
      FROM documents d
      WHERE ${conditions.join(' AND ')}
      ORDER BY d.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    try {
      const [countResult, searchResult] = await Promise.all([
        this.db.query(countQuery, values),
        this.db.query(searchQuery, [...values, limit, offset]),
      ]);

      const total = parseInt(countResult.rows[0].total);
      const documents = searchResult.rows.map(row => this.mapRowToDocument(row));

      return {
        documents,
        total,
        hasMore: offset + documents.length < total,
      };
    } catch (error) {
      logger.error('Failed to search documents', {
        error: error.message,
        organizationId: query.organizationId,
      });
      throw error;
    }
  }

  public async createDocumentVersion(version: DocumentVersion): Promise<void> {
    const query = `
      INSERT INTO document_versions (
        version_id, document_id, version, storage_key, size, checksum, uploaded_by, created_at, change_log
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    const values = [
      version.versionId,
      version.documentId,
      version.version,
      version.storageKey,
      version.size,
      version.checksum,
      version.uploadedBy,
      version.createdAt,
      version.changeLog,
    ];

    try {
      await this.db.query(query, values);
      logger.info('Document version created', { versionId: version.versionId });
    } catch (error) {
      logger.error('Failed to create document version', {
        error: error.message,
        versionId: version.versionId,
      });
      throw error;
    }
  }

  public async getDocumentVersion(documentId: string, version: number): Promise<DocumentVersion | null> {
    const query = `
      SELECT version_id, document_id, version, storage_key, size, checksum, uploaded_by, created_at, change_log
      FROM document_versions 
      WHERE document_id = $1 AND version = $2
    `;

    try {
      const result = await this.db.query(query, [documentId, version]);
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        versionId: row.version_id,
        documentId: row.document_id,
        version: row.version,
        storageKey: row.storage_key,
        size: row.size,
        checksum: row.checksum,
        uploadedBy: row.uploaded_by,
        createdAt: row.created_at,
        changeLog: row.change_log,
      };
    } catch (error) {
      logger.error('Failed to get document version', {
        error: error.message,
        documentId,
        version,
      });
      throw error;
    }
  }

  public async createDocumentAccess(access: DocumentAccess): Promise<void> {
    const query = `
      INSERT INTO document_access (
        access_id, document_id, user_id, role, organization_id, permissions, expires_at, created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    const values = [
      access.accessId,
      access.documentId,
      access.userId,
      access.role,
      access.organizationId,
      JSON.stringify(access.permissions),
      access.expiresAt,
      access.createdAt,
      access.createdBy,
    ];

    try {
      await this.db.query(query, values);
      logger.info('Document access created', { accessId: access.accessId });
    } catch (error) {
      logger.error('Failed to create document access', {
        error: error.message,
        accessId: access.accessId,
      });
      throw error;
    }
  }

  public async getDocumentAccess(documentId: string): Promise<DocumentAccess[]> {
    const query = `
      SELECT access_id, document_id, user_id, role, organization_id, permissions, expires_at, created_at, created_by
      FROM document_access 
      WHERE document_id = $1
    `;

    try {
      const result = await this.db.query(query, [documentId]);
      return result.rows.map(row => ({
        accessId: row.access_id,
        documentId: row.document_id,
        userId: row.user_id,
        role: row.role,
        organizationId: row.organization_id,
        permissions: JSON.parse(row.permissions || '[]'),
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        createdBy: row.created_by,
      }));
    } catch (error) {
      logger.error('Failed to get document access', {
        error: error.message,
        documentId,
      });
      throw error;
    }
  }

  public async getDocumentStats(organizationId: string): Promise<DocumentStats> {
    const queries = {
      total: `
        SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size
        FROM documents 
        WHERE organization_id = $1 AND is_active = true
      `,
      byType: `
        SELECT mime_type, COUNT(*) as count
        FROM documents 
        WHERE organization_id = $1 AND is_active = true
        GROUP BY mime_type
      `,
      byMonth: `
        SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as count
        FROM documents 
        WHERE organization_id = $1 AND is_active = true
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
        LIMIT 12
      `,
      topTags: `
        SELECT tag, COUNT(*) as count
        FROM documents d, jsonb_array_elements_text(d.tags) as tag
        WHERE d.organization_id = $1 AND d.is_active = true
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 10
      `,
    };

    try {
      const [totalResult, byTypeResult, byMonthResult, topTagsResult] = await Promise.all([
        this.db.query(queries.total, [organizationId]),
        this.db.query(queries.byType, [organizationId]),
        this.db.query(queries.byMonth, [organizationId]),
        this.db.query(queries.topTags, [organizationId]),
      ]);

      const documentsByType: Record<string, number> = {};
      byTypeResult.rows.forEach(row => {
        documentsByType[row.mime_type] = parseInt(row.count);
      });

      const uploadsByMonth: Record<string, number> = {};
      byMonthResult.rows.forEach(row => {
        const month = new Date(row.month).toISOString().substring(0, 7);
        uploadsByMonth[month] = parseInt(row.count);
      });

      const topTags = topTagsResult.rows.map(row => ({
        tag: row.tag,
        count: parseInt(row.count),
      }));

      return {
        totalDocuments: parseInt(totalResult.rows[0].count),
        totalSize: parseInt(totalResult.rows[0].total_size),
        documentsByType,
        uploadsByMonth,
        topTags,
      };
    } catch (error) {
      logger.error('Failed to get document stats', {
        error: error.message,
        organizationId,
      });
      throw error;
    }
  }

  private mapRowToDocument(row: any): Document {
    return {
      documentId: row.document_id,
      organizationId: row.organization_id,
      name: row.name,
      originalName: row.original_name,
      description: row.description,
      mimeType: row.mime_type,
      size: row.size,
      storageKey: row.storage_key,
      version: row.version,
      tags: JSON.parse(row.tags || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}