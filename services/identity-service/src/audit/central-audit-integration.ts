/**
 * Integration with central audit service for cross-system compliance
 */

import { Logger } from 'winston';
// import { Producer } from '@officeflow/kafka';
import { AuditEvent, ComplianceReport } from './audit-logger';

export interface CentralAuditEvent {
  eventId: string;
  service: string;
  organizationId: string;
  timestamp: Date;
  category: 'identity' | 'workflow' | 'data' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  event: AuditEvent;
  correlationId: string;
  tags: string[];
}

export interface AuditMetrics {
  organizationId: string;
  service: string;
  timeWindow: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalEvents: number;
    successRate: number;
    failureRate: number;
    criticalEvents: number;
    topActions: Array<{ action: string; count: number }>;
    topActors: Array<{ actorId: string; count: number }>;
  };
  generatedAt: Date;
}

// Mock Producer interface for when Kafka is not available
interface MockProducer {
  publish(topic: string, message: any, options?: any): Promise<void>;
}

export class CentralAuditIntegration {
  private producer: MockProducer | any;
  private logger: Logger;
  private serviceName = 'identity-service';

  constructor(producer: MockProducer | any, logger: Logger) {
    this.producer = producer || {
      publish: async (topic: string, message: any, options?: any) => {
        logger.debug('Mock Kafka publish', { topic, messageType: typeof message });
      }
    };
    this.logger = logger;
  }

  async publishAuditEvent(
    auditEvent: AuditEvent,
    severity: CentralAuditEvent['severity'] = 'medium',
    tags: string[] = []
  ): Promise<void> {
    try {
      const centralEvent: CentralAuditEvent = {
        eventId: auditEvent.id!,
        service: this.serviceName,
        organizationId: auditEvent.organizationId,
        timestamp: auditEvent.timestamp,
        category: 'identity',
        severity: this.calculateSeverity(auditEvent, severity),
        event: auditEvent,
        correlationId: auditEvent.correlationId,
        tags: [
          ...tags,
          `provider:${auditEvent.provider}`,
          `action:${auditEvent.action}`,
          `status:${auditEvent.status}`,
          `resource_type:${auditEvent.resourceType}`
        ]
      };

      await this.producer.publish('audit.events', centralEvent, {
        key: auditEvent.organizationId,
        headers: {
          'event-type': 'identity-audit',
          'service': this.serviceName,
          'severity': severity,
          'correlation-id': auditEvent.correlationId
        }
      });

      this.logger.debug('Audit event published to central service', {
        eventId: auditEvent.id,
        organizationId: auditEvent.organizationId,
        action: auditEvent.action,
        severity
      });
    } catch (error) {
      this.logger.error('Failed to publish audit event to central service', {
        eventId: auditEvent.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Don't throw error to avoid breaking the main audit flow
      // Central audit is supplementary to local audit logging
    }
  }

  async publishComplianceReport(report: ComplianceReport): Promise<void> {
    try {
      const reportEvent = {
        eventId: `report_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        service: this.serviceName,
        organizationId: report.organizationId,
        timestamp: report.generatedAt,
        category: 'identity' as const,
        severity: 'medium' as const,
        reportType: report.reportType,
        summary: report.summary,
        period: {
          start: report.startDate,
          end: report.endDate
        },
        generatedBy: report.generatedBy,
        correlationId: `compliance_${report.organizationId}_${report.reportType}_${report.generatedAt.getTime()}`
      };

      await this.producer.publish('audit.compliance-reports', reportEvent, {
        key: report.organizationId,
        headers: {
          'event-type': 'compliance-report',
          'service': this.serviceName,
          'report-type': report.reportType,
          'organization-id': report.organizationId
        }
      });

      this.logger.info('Compliance report published to central service', {
        organizationId: report.organizationId,
        reportType: report.reportType,
        eventsCount: report.events.length
      });
    } catch (error) {
      this.logger.error('Failed to publish compliance report to central service', {
        organizationId: report.organizationId,
        reportType: report.reportType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async publishMetrics(metrics: AuditMetrics): Promise<void> {
    try {
      await this.producer.publish('audit.metrics', metrics, {
        key: metrics.organizationId,
        headers: {
          'event-type': 'audit-metrics',
          'service': this.serviceName,
          'organization-id': metrics.organizationId
        }
      });

      this.logger.debug('Audit metrics published to central service', {
        organizationId: metrics.organizationId,
        totalEvents: metrics.metrics.totalEvents,
        successRate: metrics.metrics.successRate
      });
    } catch (error) {
      this.logger.error('Failed to publish audit metrics to central service', {
        organizationId: metrics.organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async publishSecurityAlert(
    organizationId: string,
    alertType: 'suspicious_activity' | 'failed_authentication' | 'privilege_escalation' | 'data_breach',
    details: Record<string, any>,
    correlationId: string
  ): Promise<void> {
    try {
      const alertEvent = {
        eventId: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        service: this.serviceName,
        organizationId,
        timestamp: new Date(),
        category: 'security' as const,
        severity: 'critical' as const,
        alertType,
        details,
        correlationId,
        tags: [
          'security-alert',
          `alert-type:${alertType}`,
          `service:${this.serviceName}`
        ]
      };

      await this.producer.publish('security.alerts', alertEvent, {
        key: organizationId,
        headers: {
          'event-type': 'security-alert',
          'service': this.serviceName,
          'alert-type': alertType,
          'severity': 'critical',
          'organization-id': organizationId
        }
      });

      this.logger.warn('Security alert published to central service', {
        organizationId,
        alertType,
        correlationId
      });
    } catch (error) {
      this.logger.error('Failed to publish security alert to central service', {
        organizationId,
        alertType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private calculateSeverity(
    auditEvent: AuditEvent,
    defaultSeverity: CentralAuditEvent['severity']
  ): CentralAuditEvent['severity'] {
    // Escalate severity based on event characteristics
    if (auditEvent.status === 'failed') {
      if (auditEvent.action.includes('delete') || auditEvent.action.includes('disable')) {
        return 'high';
      }
      if (auditEvent.action.includes('permission') || auditEvent.action.includes('group')) {
        return 'medium';
      }
    }

    // Critical actions always get high severity
    if (auditEvent.action === 'account.delete' || 
        auditEvent.action === 'permission.grant' ||
        auditEvent.actorType === 'system' && auditEvent.status === 'failed') {
      return 'high';
    }

    // Multiple failed attempts might indicate suspicious activity
    if (auditEvent.details.retryCount && auditEvent.details.retryCount > 2) {
      return 'medium';
    }

    return defaultSeverity;
  }
}

// Utility functions for audit event analysis
export class AuditAnalyzer {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  detectSuspiciousActivity(events: AuditEvent[]): Array<{
    type: string;
    description: string;
    events: AuditEvent[];
    severity: 'low' | 'medium' | 'high';
  }> {
    const alerts = [];

    // Detect multiple failed login attempts
    const failedLogins = events.filter(e => 
      e.action === 'oauth.authorize' && e.status === 'failed'
    );
    
    if (failedLogins.length >= 5) {
      alerts.push({
        type: 'multiple_failed_logins',
        description: `${failedLogins.length} failed login attempts detected`,
        events: failedLogins,
        severity: 'medium' as const
      });
    }

    // Detect privilege escalation attempts
    const privilegeChanges = events.filter(e => 
      e.action === 'permission.grant' || e.action === 'group.assign'
    );
    
    const suspiciousPrivilegeChanges = privilegeChanges.filter(e => 
      e.actorType === 'user' && e.metadata.elevated === true
    );
    
    if (suspiciousPrivilegeChanges.length > 0) {
      alerts.push({
        type: 'privilege_escalation',
        description: 'Suspicious privilege escalation detected',
        events: suspiciousPrivilegeChanges,
        severity: 'high' as const
      });
    }

    // Detect unusual activity patterns
    const actorActivity = new Map<string, AuditEvent[]>();
    events.forEach(event => {
      if (!actorActivity.has(event.actorId)) {
        actorActivity.set(event.actorId, []);
      }
      actorActivity.get(event.actorId)!.push(event);
    });

    actorActivity.forEach((actorEvents, actorId) => {
      if (actorEvents.length > 50) { // Threshold for unusual activity
        alerts.push({
          type: 'unusual_activity_volume',
          description: `Actor ${actorId} performed ${actorEvents.length} actions`,
          events: actorEvents,
          severity: 'low' as const
        });
      }
    });

    return alerts;
  }

  generateAuditMetrics(
    organizationId: string,
    events: AuditEvent[],
    timeWindow: { start: Date; end: Date }
  ): AuditMetrics {
    const totalEvents = events.length;
    const successfulEvents = events.filter(e => e.status === 'success').length;
    const failedEvents = events.filter(e => e.status === 'failed').length;
    const criticalEvents = events.filter(e => 
      e.action.includes('delete') || 
      e.action.includes('permission') ||
      e.status === 'failed'
    ).length;

    // Count actions
    const actionCounts = new Map<string, number>();
    events.forEach(event => {
      actionCounts.set(event.action, (actionCounts.get(event.action) || 0) + 1);
    });

    // Count actors
    const actorCounts = new Map<string, number>();
    events.forEach(event => {
      actorCounts.set(event.actorId, (actorCounts.get(event.actorId) || 0) + 1);
    });

    return {
      organizationId,
      service: 'identity-service',
      timeWindow,
      metrics: {
        totalEvents,
        successRate: totalEvents > 0 ? successfulEvents / totalEvents : 0,
        failureRate: totalEvents > 0 ? failedEvents / totalEvents : 0,
        criticalEvents,
        topActions: Array.from(actionCounts.entries())
          .map(([action, count]) => ({ action, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        topActors: Array.from(actorCounts.entries())
          .map(([actorId, count]) => ({ actorId, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      },
      generatedAt: new Date()
    };
  }
}