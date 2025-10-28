/**
 * Audit log repository implementation
 */

import { AuditLogEntity, AuditLogRepository, UUID } from '@officeflow/types';
import { BaseRepository } from './base';
import { auditLogSchema, createAuditLogSchema } from '../validation/schemas';

export class AuditLogRepositoryImpl
  extends BaseRepository<AuditLogEntity>
  implements AuditLogRepository
{
  constructor() {
    super(
      'audit_logs',
      'audit_id',
      createAuditLogSchema,
      createAuditLogSchema // Audit logs are immutable, no updates
    );
  }

  /**
   * Find audit logs by organization
   */
  async findByOrganization(orgId: UUID): Promise<AuditLogEntity[]> {
    return this.findAll(
      { org_id: orgId },
      {
        orderBy: 'created_at',
        orderDirection: 'DESC',
      }
    );
  }

  /**
   * Find audit logs by entity
   */
  async findByEntity(entityType: string, entityId: UUID): Promise<AuditLogEntity[]> {
    return this.findAll(
      {
        entity_type: entityType,
        entity_id: entityId,
      },
      {
        orderBy: 'created_at',
        orderDirection: 'DESC',
      }
    );
  }

  /**
   * Find audit logs by actor
   */
  async findByActor(actorId: UUID): Promise<AuditLogEntity[]> {
    return this.findAll(
      { actor_id: actorId },
      {
        orderBy: 'created_at',
        orderDirection: 'DESC',
      }
    );
  }

  /**
   * Find audit logs by date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<AuditLogEntity[]> {
    const query = `
      SELECT * FROM audit_logs 
      WHERE created_at >= $1 AND created_at <= $2
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [startDate, endDate]);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find audit logs by action
   */
  async findByAction(orgId: UUID, action: string): Promise<AuditLogEntity[]> {
    return this.findAll(
      {
        org_id: orgId,
        action,
      },
      {
        orderBy: 'created_at',
        orderDirection: 'DESC',
      }
    );
  }

  /**
   * Log an audit event
   */
  async logEvent(
    orgId: UUID,
    entityType: string,
    entityId: UUID,
    action: string,
    actorId?: UUID,
    actorType: string = 'user',
    changes?: any,
    metadata?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLogEntity> {
    return this.create({
      org_id: orgId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor_id: actorId,
      actor_type: actorType,
      changes,
      metadata: metadata || {},
      ip_address: ipAddress,
      user_agent: userAgent,
    } as any);
  }

  /**
   * Get audit statistics for organization
   */
  async getAuditStats(
    orgId: UUID,
    days: number = 30
  ): Promise<{
    totalEvents: number;
    eventsByAction: Array<{ action: string; count: number }>;
    eventsByEntityType: Array<{ entityType: string; count: number }>;
    topActors: Array<{ actorId: UUID; count: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total events
    const totalQuery = `
      SELECT COUNT(*) as total_events
      FROM audit_logs 
      WHERE org_id = $1 AND created_at >= $2
    `;
    const totalResult = await this.pool.query(totalQuery, [orgId, startDate]);

    // Events by action
    const actionQuery = `
      SELECT action, COUNT(*) as count
      FROM audit_logs 
      WHERE org_id = $1 AND created_at >= $2
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `;
    const actionResult = await this.pool.query(actionQuery, [orgId, startDate]);

    // Events by entity type
    const entityQuery = `
      SELECT entity_type, COUNT(*) as count
      FROM audit_logs 
      WHERE org_id = $1 AND created_at >= $2
      GROUP BY entity_type
      ORDER BY count DESC
      LIMIT 10
    `;
    const entityResult = await this.pool.query(entityQuery, [orgId, startDate]);

    // Top actors
    const actorQuery = `
      SELECT actor_id, COUNT(*) as count
      FROM audit_logs 
      WHERE org_id = $1 AND created_at >= $2 AND actor_id IS NOT NULL
      GROUP BY actor_id
      ORDER BY count DESC
      LIMIT 10
    `;
    const actorResult = await this.pool.query(actorQuery, [orgId, startDate]);

    return {
      totalEvents: parseInt(totalResult.rows[0].total_events, 10),
      eventsByAction: actionResult.rows.map((row) => ({
        action: row.action,
        count: parseInt(row.count, 10),
      })),
      eventsByEntityType: entityResult.rows.map((row) => ({
        entityType: row.entity_type,
        count: parseInt(row.count, 10),
      })),
      topActors: actorResult.rows.map((row) => ({
        actorId: row.actor_id,
        count: parseInt(row.count, 10),
      })),
    };
  }

  /**
   * Search audit logs
   */
  async search(
    orgId: UUID,
    filters: {
      entityType?: string;
      action?: string;
      actorId?: UUID;
      startDate?: Date;
      endDate?: Date;
    },
    limit: number = 100
  ): Promise<AuditLogEntity[]> {
    let query = 'SELECT * FROM audit_logs WHERE org_id = $1';
    const params: any[] = [orgId];
    let paramIndex = 2;

    if (filters.entityType) {
      query += ` AND entity_type = $${paramIndex++}`;
      params.push(filters.entityType);
    }

    if (filters.action) {
      query += ` AND action = $${paramIndex++}`;
      params.push(filters.action);
    }

    if (filters.actorId) {
      query += ` AND actor_id = $${paramIndex++}`;
      params.push(filters.actorId);
    }

    if (filters.startDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Cleanup old audit logs (for compliance)
   */
  async cleanup(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const query = `
      DELETE FROM audit_logs 
      WHERE created_at < $1
    `;

    const result = await this.pool.query(query, [cutoffDate]);
    return result.rowCount || 0;
  }

  /**
   * Override update method to prevent modifications
   */
  async update(id: UUID, updates: Partial<AuditLogEntity>): Promise<AuditLogEntity | null> {
    throw new Error('Audit logs are immutable and cannot be updated');
  }

  /**
   * Override delete method to prevent deletions (except for cleanup)
   */
  async delete(id: UUID): Promise<boolean> {
    throw new Error('Individual audit logs cannot be deleted. Use cleanup() for bulk deletion.');
  }
}
