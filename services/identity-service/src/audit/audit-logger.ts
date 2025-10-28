/**
 * Audit logging service for identity operations
 */

import { Logger } from 'winston';
import { Pool } from 'pg';

export interface AuditEvent {
  id?: string;
  organizationId: string;
  employeeId: string;
  actorId: string;
  actorType: 'system' | 'user' | 'service';
  action: IdentityAction;
  resource: string;
  resourceType: 'user_account' | 'group' | 'license' | 'permission';
  provider: string;
  status: 'success' | 'failed' | 'partial';
  details: AuditDetails;
  metadata: Record<string, any>;
  timestamp: Date;
  correlationId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type IdentityAction =
  | 'account.create'
  | 'account.update'
  | 'account.disable'
  | 'account.enable'
  | 'account.delete'
  | 'group.assign'
  | 'group.remove'
  | 'license.assign'
  | 'license.revoke'
  | 'permission.grant'
  | 'permission.revoke'
  | 'password.reset'
  | 'mfa.enable'
  | 'mfa.disable'
  | 'oauth.authorize'
  | 'oauth.revoke';

export interface AuditDetails {
  before?: Record<string, any>;
  after?: Record<string, any>;
  changes?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  duration?: number;
  retryCount?: number;
}

export interface ComplianceReport {
  organizationId: string;
  reportType:
    | 'access_review'
    | 'provisioning_audit'
    | 'deprovisioning_audit'
    | 'permission_changes';
  startDate: Date;
  endDate: Date;
  events: AuditEvent[];
  summary: {
    totalEvents: number;
    successfulOperations: number;
    failedOperations: number;
    uniqueUsers: number;
    uniqueActors: number;
  };
  generatedAt: Date;
  generatedBy: string;
}

export class AuditLogger {
  private logger: Logger;
  private db: Pool;

  constructor(db: Pool, logger: Logger) {
    this.db = db;
    this.logger = logger;
  }

  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
    };

    try {
      // Store in database
      await this.storeAuditEvent(auditEvent);

      // Log to application logs for real-time monitoring
      this.logger.info('Identity audit event', {
        eventId: auditEvent.id,
        organizationId: auditEvent.organizationId,
        action: auditEvent.action,
        resource: auditEvent.resource,
        status: auditEvent.status,
        actorId: auditEvent.actorId,
        correlationId: auditEvent.correlationId,
      });

      return auditEvent.id!;
    } catch (error) {
      this.logger.error('Failed to log audit event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event: {
          organizationId: auditEvent.organizationId,
          action: auditEvent.action,
          resource: auditEvent.resource,
        },
      });
      throw error;
    }
  }

  async logAccountCreation(
    organizationId: string,
    employeeId: string,
    actorId: string,
    provider: string,
    userDetails: Record<string, any>,
    result: { success: boolean; userId?: string; error?: string },
    correlationId: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent({
      organizationId,
      employeeId,
      actorId,
      actorType: 'system',
      action: 'account.create',
      resource: result.userId || userDetails.email,
      resourceType: 'user_account',
      provider,
      status: result.success ? 'success' : 'failed',
      details: {
        after: result.success ? userDetails : undefined,
        error: result.error
          ? {
              code: 'ACCOUNT_CREATION_FAILED',
              message: result.error,
            }
          : undefined,
      },
      metadata: {
        ...metadata,
        userEmail: userDetails.email,
        department: userDetails.department,
        role: userDetails.role,
      },
      correlationId,
    });
  }

  async logAccountUpdate(
    organizationId: string,
    employeeId: string,
    actorId: string,
    provider: string,
    userId: string,
    changes: Array<{ field: string; oldValue: any; newValue: any }>,
    result: { success: boolean; error?: string },
    correlationId: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent({
      organizationId,
      employeeId,
      actorId,
      actorType: 'system',
      action: 'account.update',
      resource: userId,
      resourceType: 'user_account',
      provider,
      status: result.success ? 'success' : 'failed',
      details: {
        changes,
        error: result.error
          ? {
              code: 'ACCOUNT_UPDATE_FAILED',
              message: result.error,
            }
          : undefined,
      },
      metadata,
      correlationId,
    });
  }

  async logAccountDeactivation(
    organizationId: string,
    employeeId: string,
    actorId: string,
    provider: string,
    userId: string,
    reason: string,
    result: { success: boolean; error?: string },
    correlationId: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent({
      organizationId,
      employeeId,
      actorId,
      actorType: 'system',
      action: 'account.disable',
      resource: userId,
      resourceType: 'user_account',
      provider,
      status: result.success ? 'success' : 'failed',
      details: {
        before: { active: true },
        after: result.success ? { active: false, reason } : undefined,
        error: result.error
          ? {
              code: 'ACCOUNT_DEACTIVATION_FAILED',
              message: result.error,
            }
          : undefined,
      },
      metadata: {
        ...metadata,
        deactivationReason: reason,
      },
      correlationId,
    });
  }

  async logGroupAssignment(
    organizationId: string,
    employeeId: string,
    actorId: string,
    provider: string,
    userId: string,
    groups: string[],
    result: {
      success: boolean;
      successfulGroups?: string[];
      failedGroups?: Array<{ group: string; error: string }>;
    },
    correlationId: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const status = result.success
      ? 'success'
      : result.successfulGroups && result.successfulGroups.length > 0
        ? 'partial'
        : 'failed';

    return this.logEvent({
      organizationId,
      employeeId,
      actorId,
      actorType: 'system',
      action: 'group.assign',
      resource: userId,
      resourceType: 'group',
      provider,
      status,
      details: {
        after: {
          assignedGroups: result.successfulGroups || [],
          requestedGroups: groups,
        },
        error:
          result.failedGroups && result.failedGroups.length > 0
            ? {
                code: 'GROUP_ASSIGNMENT_PARTIAL_FAILURE',
                message: 'Some group assignments failed',
                details: result.failedGroups,
              }
            : undefined,
      },
      metadata: {
        ...metadata,
        totalGroups: groups.length,
        successfulGroups: result.successfulGroups?.length || 0,
        failedGroups: result.failedGroups?.length || 0,
      },
      correlationId,
    });
  }

  async logLicenseAssignment(
    organizationId: string,
    employeeId: string,
    actorId: string,
    provider: string,
    userId: string,
    licenses: string[],
    result: { success: boolean; assignedLicenses?: string[]; error?: string },
    correlationId: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent({
      organizationId,
      employeeId,
      actorId,
      actorType: 'system',
      action: 'license.assign',
      resource: userId,
      resourceType: 'license',
      provider,
      status: result.success ? 'success' : 'failed',
      details: {
        after: result.success ? { licenses: result.assignedLicenses || licenses } : undefined,
        error: result.error
          ? {
              code: 'LICENSE_ASSIGNMENT_FAILED',
              message: result.error,
            }
          : undefined,
      },
      metadata: {
        ...metadata,
        requestedLicenses: licenses,
        assignedLicenses: result.assignedLicenses || [],
      },
      correlationId,
    });
  }

  async getAuditTrail(
    organizationId: string,
    filters: {
      employeeId?: string;
      actorId?: string;
      action?: IdentityAction;
      provider?: string;
      startDate?: Date;
      endDate?: Date;
      status?: 'success' | 'failed' | 'partial';
    } = {},
    limit: number = 100,
    offset: number = 0
  ): Promise<{ events: AuditEvent[]; total: number }> {
    try {
      let query = `
        SELECT * FROM identity_audit_events 
        WHERE organization_id = $1
      `;
      const params: any[] = [organizationId];
      let paramIndex = 2;

      // Add filters
      if (filters.employeeId) {
        query += ` AND employee_id = $${paramIndex}`;
        params.push(filters.employeeId);
        paramIndex++;
      }

      if (filters.actorId) {
        query += ` AND actor_id = $${paramIndex}`;
        params.push(filters.actorId);
        paramIndex++;
      }

      if (filters.action) {
        query += ` AND action = $${paramIndex}`;
        params.push(filters.action);
        paramIndex++;
      }

      if (filters.provider) {
        query += ` AND provider = $${paramIndex}`;
        params.push(filters.provider);
        paramIndex++;
      }

      if (filters.status) {
        query += ` AND status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.startDate) {
        query += ` AND timestamp >= $${paramIndex}`;
        params.push(filters.startDate);
        paramIndex++;
      }

      if (filters.endDate) {
        query += ` AND timestamp <= $${paramIndex}`;
        params.push(filters.endDate);
        paramIndex++;
      }

      // Get total count
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
      const countResult = await this.db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Add ordering and pagination
      query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);
      const events = result.rows.map((row) => this.mapRowToAuditEvent(row));

      return { events, total };
    } catch (error) {
      this.logger.error('Failed to retrieve audit trail', {
        organizationId,
        filters,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async generateComplianceReport(
    organizationId: string,
    reportType: ComplianceReport['reportType'],
    startDate: Date,
    endDate: Date,
    generatedBy: string
  ): Promise<ComplianceReport> {
    try {
      // Get relevant audit events
      const { events } = await this.getAuditTrail(
        organizationId,
        { startDate, endDate },
        10000 // Large limit for comprehensive report
      );

      // Filter events based on report type
      const filteredEvents = this.filterEventsForReport(events, reportType);

      // Generate summary statistics
      const summary = {
        totalEvents: filteredEvents.length,
        successfulOperations: filteredEvents.filter((e) => e.status === 'success').length,
        failedOperations: filteredEvents.filter((e) => e.status === 'failed').length,
        uniqueUsers: new Set(filteredEvents.map((e) => e.employeeId)).size,
        uniqueActors: new Set(filteredEvents.map((e) => e.actorId)).size,
      };

      const report: ComplianceReport = {
        organizationId,
        reportType,
        startDate,
        endDate,
        events: filteredEvents,
        summary,
        generatedAt: new Date(),
        generatedBy,
      };

      this.logger.info('Compliance report generated', {
        organizationId,
        reportType,
        eventsCount: filteredEvents.length,
        generatedBy,
      });

      return report;
    } catch (error) {
      this.logger.error('Failed to generate compliance report', {
        organizationId,
        reportType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async storeAuditEvent(event: AuditEvent): Promise<void> {
    const query = `
      INSERT INTO identity_audit_events (
        id, organization_id, employee_id, actor_id, actor_type, action,
        resource, resource_type, provider, status, details, metadata,
        timestamp, correlation_id, session_id, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `;

    const values = [
      event.id,
      event.organizationId,
      event.employeeId,
      event.actorId,
      event.actorType,
      event.action,
      event.resource,
      event.resourceType,
      event.provider,
      event.status,
      JSON.stringify(event.details),
      JSON.stringify(event.metadata),
      event.timestamp,
      event.correlationId,
      event.sessionId,
      event.ipAddress,
      event.userAgent,
    ];

    await this.db.query(query, values);
  }

  private mapRowToAuditEvent(row: any): AuditEvent {
    return {
      id: row.id,
      organizationId: row.organization_id,
      employeeId: row.employee_id,
      actorId: row.actor_id,
      actorType: row.actor_type,
      action: row.action,
      resource: row.resource,
      resourceType: row.resource_type,
      provider: row.provider,
      status: row.status,
      details: JSON.parse(row.details || '{}'),
      metadata: JSON.parse(row.metadata || '{}'),
      timestamp: new Date(row.timestamp),
      correlationId: row.correlation_id,
      sessionId: row.session_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
    };
  }

  private filterEventsForReport(
    events: AuditEvent[],
    reportType: ComplianceReport['reportType']
  ): AuditEvent[] {
    switch (reportType) {
      case 'access_review':
        return events.filter(
          (e) =>
            e.action.includes('group.') ||
            e.action.includes('permission.') ||
            e.action.includes('license.')
        );

      case 'provisioning_audit':
        return events.filter(
          (e) =>
            e.action === 'account.create' ||
            e.action === 'group.assign' ||
            e.action === 'license.assign'
        );

      case 'deprovisioning_audit':
        return events.filter(
          (e) =>
            e.action === 'account.disable' ||
            e.action === 'account.delete' ||
            e.action === 'group.remove' ||
            e.action === 'license.revoke'
        );

      case 'permission_changes':
        return events.filter(
          (e) => e.action.includes('permission.') || e.action.includes('group.')
        );

      default:
        return events;
    }
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
