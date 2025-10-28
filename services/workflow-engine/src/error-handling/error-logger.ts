/**
 * Comprehensive error logging and alerting system
 */

import { UUID } from '@officeflow/types';
import { OfficeFlowProducer } from '@officeflow/kafka';
import { RedisStateManager } from '../state/redis-state-manager';

export interface ErrorContext {
  runId?: UUID;
  nodeId?: UUID;
  workflowId?: UUID;
  organizationId?: UUID;
  employeeId?: UUID;
  nodeType?: string;
  correlationId?: string;
  attempt?: number;
  executionTimeMs?: number;
}

export interface ErrorLogEntry {
  id: string;
  timestamp: Date;
  level: 'ERROR' | 'WARN' | 'FATAL';
  category: 'WORKFLOW' | 'NODE' | 'SYSTEM' | 'INTEGRATION';
  code: string;
  message: string;
  error: any;
  context: ErrorContext;
  stackTrace?: string;
  tags: string[];
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (entry: ErrorLogEntry) => boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cooldownMs: number;
  channels: AlertChannel[];
}

export interface AlertChannel {
  type: 'EMAIL' | 'SLACK' | 'WEBHOOK' | 'PAGERDUTY';
  config: Record<string, any>;
}

export interface Alert {
  id: string;
  ruleId: string;
  timestamp: Date;
  severity: AlertRule['severity'];
  title: string;
  description: string;
  errorEntry: ErrorLogEntry;
  acknowledged: boolean;
  resolvedAt?: Date;
}

export class ErrorLogger {
  private alertRules: Map<string, AlertRule> = new Map();
  private alertCooldowns: Map<string, Date> = new Map();

  constructor(
    private producer: OfficeFlowProducer,
    private stateManager: RedisStateManager
  ) {
    this.initializeDefaultAlertRules();
  }

  /**
   * Log an error with context
   */
  async logError(
    level: ErrorLogEntry['level'],
    category: ErrorLogEntry['category'],
    code: string,
    message: string,
    error: any,
    context: ErrorContext = {},
    tags: string[] = []
  ): Promise<void> {
    const errorEntry: ErrorLogEntry = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      level,
      category,
      code,
      message,
      error: this.serializeError(error),
      context,
      stackTrace: error?.stack,
      tags,
    };

    try {
      // Store error in Redis for querying
      await this.storeErrorEntry(errorEntry);

      // Send to audit log via Kafka
      await this.sendToAuditLog(errorEntry);

      // Check alert rules
      await this.checkAlertRules(errorEntry);

      // Log to console with structured format
      this.logToConsole(errorEntry);
    } catch (logError) {
      // Fallback logging if our error logging fails
      console.error('Failed to log error:', logError);
      console.error('Original error:', { level, category, code, message, error, context });
    }
  }

  /**
   * Log workflow-specific errors
   */
  async logWorkflowError(
    runId: UUID,
    workflowId: UUID,
    error: any,
    context: Partial<ErrorContext> = {}
  ): Promise<void> {
    await this.logError(
      'ERROR',
      'WORKFLOW',
      'WORKFLOW_EXECUTION_FAILED',
      `Workflow execution failed: ${error.message || error}`,
      error,
      {
        runId,
        workflowId,
        ...context,
      },
      ['workflow', 'execution']
    );
  }

  /**
   * Log node execution errors
   */
  async logNodeError(
    runId: UUID,
    nodeId: UUID,
    nodeType: string,
    error: any,
    attempt: number,
    context: Partial<ErrorContext> = {}
  ): Promise<void> {
    await this.logError(
      'ERROR',
      'NODE',
      'NODE_EXECUTION_FAILED',
      `Node execution failed: ${error.message || error}`,
      error,
      {
        runId,
        nodeId,
        nodeType,
        attempt,
        ...context,
      },
      ['node', 'execution', nodeType]
    );
  }

  /**
   * Log integration errors
   */
  async logIntegrationError(
    service: string,
    operation: string,
    error: any,
    context: Partial<ErrorContext> = {}
  ): Promise<void> {
    await this.logError(
      'ERROR',
      'INTEGRATION',
      'EXTERNAL_SERVICE_ERROR',
      `Integration error: ${service}.${operation} - ${error.message || error}`,
      error,
      context,
      ['integration', service, operation]
    );
  }

  /**
   * Log system errors
   */
  async logSystemError(
    component: string,
    error: any,
    context: Partial<ErrorContext> = {}
  ): Promise<void> {
    await this.logError(
      'FATAL',
      'SYSTEM',
      'SYSTEM_ERROR',
      `System error in ${component}: ${error.message || error}`,
      error,
      context,
      ['system', component]
    );
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    console.log(`Added alert rule: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    this.alertCooldowns.delete(ruleId);
    console.log(`Removed alert rule: ${ruleId}`);
  }

  /**
   * Get error statistics
   */
  async getErrorStatistics(
    organizationId?: UUID,
    timeRangeMs: number = 3600000 // 1 hour default
  ): Promise<{
    totalErrors: number;
    errorsByLevel: Record<string, number>;
    errorsByCategory: Record<string, number>;
    errorsByCode: Record<string, number>;
    topErrors: Array<{ code: string; count: number; lastOccurrence: Date }>;
    errorRate: number; // errors per minute
  }> {
    try {
      const since = new Date(Date.now() - timeRangeMs);
      const errors = await this.getErrorsSince(since, organizationId);

      const errorsByLevel: Record<string, number> = {};
      const errorsByCategory: Record<string, number> = {};
      const errorsByCode: Record<string, number> = {};

      for (const error of errors) {
        errorsByLevel[error.level] = (errorsByLevel[error.level] || 0) + 1;
        errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
        errorsByCode[error.code] = (errorsByCode[error.code] || 0) + 1;
      }

      // Calculate top errors
      const topErrors = Object.entries(errorsByCode)
        .map(([code, count]) => ({
          code,
          count,
          lastOccurrence:
            errors
              .filter((e) => e.code === code)
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp ||
            new Date(),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const errorRate = errors.length / (timeRangeMs / 60000); // errors per minute

      return {
        totalErrors: errors.length,
        errorsByLevel,
        errorsByCategory,
        errorsByCode,
        topErrors,
        errorRate,
      };
    } catch (error) {
      console.error('Failed to get error statistics:', error);
      return {
        totalErrors: 0,
        errorsByLevel: {},
        errorsByCategory: {},
        errorsByCode: {},
        topErrors: [],
        errorRate: 0,
      };
    }
  }

  /**
   * Get recent alerts
   */
  async getRecentAlerts(limit: number = 50): Promise<Alert[]> {
    try {
      return await this.stateManager.getRecentAlerts(limit);
    } catch (error) {
      console.error('Failed to get recent alerts:', error);
      return [];
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    try {
      await this.stateManager.acknowledgeAlert(alertId, acknowledgedBy);
      console.log(`Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
    } catch (error) {
      console.error(`Failed to acknowledge alert ${alertId}:`, error);
    }
  }

  /**
   * Store error entry in Redis
   */
  private async storeErrorEntry(entry: ErrorLogEntry): Promise<void> {
    const key = `error_log:${entry.timestamp.getTime()}:${entry.id}`;
    const ttl = 7 * 24 * 60 * 60; // 7 days TTL

    await this.stateManager.storeErrorEntry(key, entry, ttl);
  }

  /**
   * Send error to audit log via Kafka
   */
  private async sendToAuditLog(entry: ErrorLogEntry): Promise<void> {
    try {
      await this.producer.sendMessage('audit.events', {
        type: 'error.logged',
        payload: entry,
        metadata: {
          correlationId: entry.context.correlationId || entry.id,
          organizationId: entry.context.organizationId,
          source: 'workflow-engine',
          version: '1.0',
        },
      });
    } catch (error) {
      console.error('Failed to send error to audit log:', error);
    }
  }

  /**
   * Check alert rules against error entry
   */
  private async checkAlertRules(entry: ErrorLogEntry): Promise<void> {
    for (const [ruleId, rule] of this.alertRules) {
      try {
        // Check if rule condition matches
        if (!rule.condition(entry)) {
          continue;
        }

        // Check cooldown
        const lastAlert = this.alertCooldowns.get(ruleId);
        if (lastAlert && Date.now() - lastAlert.getTime() < rule.cooldownMs) {
          continue;
        }

        // Create and send alert
        const alert = await this.createAlert(rule, entry);
        await this.sendAlert(alert);

        // Update cooldown
        this.alertCooldowns.set(ruleId, new Date());
      } catch (error) {
        console.error(`Failed to process alert rule ${ruleId}:`, error);
      }
    }
  }

  /**
   * Create alert from rule and error entry
   */
  private async createAlert(rule: AlertRule, entry: ErrorLogEntry): Promise<Alert> {
    const alert: Alert = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      timestamp: new Date(),
      severity: rule.severity,
      title: `${rule.name}: ${entry.message}`,
      description: this.formatAlertDescription(entry),
      errorEntry: entry,
      acknowledged: false,
    };

    // Store alert
    await this.stateManager.storeAlert(alert);

    return alert;
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(alert: Alert): Promise<void> {
    const rule = this.alertRules.get(alert.ruleId);
    if (!rule) return;

    for (const channel of rule.channels) {
      try {
        await this.sendAlertToChannel(alert, channel);
      } catch (error) {
        console.error(`Failed to send alert to ${channel.type}:`, error);
      }
    }
  }

  /**
   * Send alert to specific channel
   */
  private async sendAlertToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'SLACK':
        await this.sendSlackAlert(alert, channel.config);
        break;
      case 'EMAIL':
        await this.sendEmailAlert(alert, channel.config);
        break;
      case 'WEBHOOK':
        await this.sendWebhookAlert(alert, channel.config);
        break;
      case 'PAGERDUTY':
        await this.sendPagerDutyAlert(alert, channel.config);
        break;
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    // High error rate rule
    this.addAlertRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: (entry) => entry.level === 'ERROR' || entry.level === 'FATAL',
      severity: 'HIGH',
      cooldownMs: 300000, // 5 minutes
      channels: [{ type: 'SLACK', config: { channel: '#alerts' } }],
    });

    // Workflow failure rule
    this.addAlertRule({
      id: 'workflow_failure',
      name: 'Workflow Execution Failure',
      condition: (entry) => entry.category === 'WORKFLOW' && entry.level === 'ERROR',
      severity: 'MEDIUM',
      cooldownMs: 600000, // 10 minutes
      channels: [{ type: 'EMAIL', config: { recipients: ['ops@company.com'] } }],
    });

    // System error rule
    this.addAlertRule({
      id: 'system_error',
      name: 'System Error',
      condition: (entry) => entry.category === 'SYSTEM' && entry.level === 'FATAL',
      severity: 'CRITICAL',
      cooldownMs: 60000, // 1 minute
      channels: [
        { type: 'PAGERDUTY', config: { serviceKey: 'workflow-engine' } },
        { type: 'SLACK', config: { channel: '#critical-alerts' } },
      ],
    });
  }

  /**
   * Helper methods for alert channels (simplified implementations)
   */
  private async sendSlackAlert(alert: Alert, config: any): Promise<void> {
    // Implementation would use Slack API
    console.log(`Slack alert sent to ${config.channel}:`, alert.title);
  }

  private async sendEmailAlert(alert: Alert, config: any): Promise<void> {
    // Implementation would use email service
    console.log(`Email alert sent to ${config.recipients}:`, alert.title);
  }

  private async sendWebhookAlert(alert: Alert, config: any): Promise<void> {
    // Implementation would make HTTP request
    console.log(`Webhook alert sent to ${config.url}:`, alert.title);
  }

  private async sendPagerDutyAlert(alert: Alert, config: any): Promise<void> {
    // Implementation would use PagerDuty API
    console.log(`PagerDuty alert sent for service ${config.serviceKey}:`, alert.title);
  }

  /**
   * Utility methods
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private serializeError(error: any): any {
    if (error instanceof Error) {
      return {
        ...error,
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return error;
  }

  private formatAlertDescription(entry: ErrorLogEntry): string {
    return `
Error: ${entry.message}
Category: ${entry.category}
Level: ${entry.level}
Code: ${entry.code}
Context: ${JSON.stringify(entry.context, null, 2)}
Timestamp: ${entry.timestamp.toISOString()}
    `.trim();
  }

  private logToConsole(entry: ErrorLogEntry): void {
    const logData = {
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      category: entry.category,
      code: entry.code,
      message: entry.message,
      context: entry.context,
      tags: entry.tags,
    };

    switch (entry.level) {
      case 'FATAL':
        console.error('[FATAL]', logData);
        break;
      case 'ERROR':
        console.error('[ERROR]', logData);
        break;
      case 'WARN':
        console.warn('[WARN]', logData);
        break;
    }
  }

  private async getErrorsSince(since: Date, organizationId?: UUID): Promise<ErrorLogEntry[]> {
    // Implementation would query Redis for errors since timestamp
    // For now, return empty array
    return [];
  }
}
