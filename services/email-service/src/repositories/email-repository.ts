import { Pool } from 'pg';
import { EmailTemplate, DeliveryStatus, EmailMetrics } from '../types/email-types';
import { getConnection } from '@officeflow/database';
import { logger } from '../utils/logger';

interface EmailRecord {
  messageId: string;
  organizationId: string;
  templateId?: string;
  recipients: string[];
  subject: string;
  status: string;
  sentAt: Date;
  error?: string;
}

export class EmailRepository {
  private db: Pool;

  constructor() {
    this.db = getConnection();
  }

  public async createTemplate(template: EmailTemplate): Promise<void> {
    const query = `
      INSERT INTO email_templates (
        template_id, organization_id, name, subject, html_content, text_content, 
        variables, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    const values = [
      template.templateId,
      template.organizationId,
      template.name,
      template.subject,
      template.htmlContent,
      template.textContent,
      JSON.stringify(template.variables),
      template.createdAt,
      template.updatedAt,
    ];

    try {
      await this.db.query(query, values);
      logger.info('Email template created', { templateId: template.templateId });
    } catch (error) {
      logger.error('Failed to create email template', {
        error: error.message,
        templateId: template.templateId,
      });
      throw error;
    }
  }

  public async updateTemplate(templateId: string, template: EmailTemplate): Promise<void> {
    const query = `
      UPDATE email_templates 
      SET name = $2, subject = $3, html_content = $4, text_content = $5, 
          variables = $6, updated_at = $7
      WHERE template_id = $1
    `;

    const values = [
      templateId,
      template.name,
      template.subject,
      template.htmlContent,
      template.textContent,
      JSON.stringify(template.variables),
      template.updatedAt,
    ];

    try {
      const result = await this.db.query(query, values);
      if (result.rowCount === 0) {
        throw new Error(`Template ${templateId} not found`);
      }
      logger.info('Email template updated', { templateId });
    } catch (error) {
      logger.error('Failed to update email template', {
        error: error.message,
        templateId,
      });
      throw error;
    }
  }

  public async getTemplate(templateId: string): Promise<EmailTemplate | null> {
    const query = `
      SELECT template_id, organization_id, name, subject, html_content, text_content, 
             variables, created_at, updated_at
      FROM email_templates 
      WHERE template_id = $1
    `;

    try {
      const result = await this.db.query(query, [templateId]);
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        templateId: row.template_id,
        organizationId: row.organization_id,
        name: row.name,
        subject: row.subject,
        htmlContent: row.html_content,
        textContent: row.text_content,
        variables: JSON.parse(row.variables || '[]'),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      logger.error('Failed to get email template', {
        error: error.message,
        templateId,
      });
      throw error;
    }
  }

  public async getTemplatesByOrganization(organizationId: string): Promise<EmailTemplate[]> {
    const query = `
      SELECT template_id, organization_id, name, subject, html_content, text_content, 
             variables, created_at, updated_at
      FROM email_templates 
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.db.query(query, [organizationId]);
      return result.rows.map(row => ({
        templateId: row.template_id,
        organizationId: row.organization_id,
        name: row.name,
        subject: row.subject,
        htmlContent: row.html_content,
        textContent: row.text_content,
        variables: JSON.parse(row.variables || '[]'),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to get email templates', {
        error: error.message,
        organizationId,
      });
      throw error;
    }
  }

  public async deleteTemplate(templateId: string): Promise<void> {
    const query = 'DELETE FROM email_templates WHERE template_id = $1';

    try {
      const result = await this.db.query(query, [templateId]);
      if (result.rowCount === 0) {
        throw new Error(`Template ${templateId} not found`);
      }
      logger.info('Email template deleted', { templateId });
    } catch (error) {
      logger.error('Failed to delete email template', {
        error: error.message,
        templateId,
      });
      throw error;
    }
  }

  public async createEmailRecord(record: EmailRecord): Promise<void> {
    const query = `
      INSERT INTO email_logs (
        message_id, organization_id, template_id, recipients, subject, 
        status, sent_at, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const values = [
      record.messageId,
      record.organizationId,
      record.templateId,
      JSON.stringify(record.recipients),
      record.subject,
      record.status,
      record.sentAt,
      record.error,
    ];

    try {
      await this.db.query(query, values);
      logger.info('Email record created', { messageId: record.messageId });
    } catch (error) {
      logger.error('Failed to create email record', {
        error: error.message,
        messageId: record.messageId,
      });
      throw error;
    }
  }

  public async getDeliveryStatus(messageId: string): Promise<DeliveryStatus | null> {
    const query = `
      SELECT message_id, status, timestamp, reason, recipient
      FROM email_delivery_status 
      WHERE message_id = $1
    `;

    try {
      const result = await this.db.query(query, [messageId]);
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        messageId: row.message_id,
        status: row.status,
        timestamp: row.timestamp,
        reason: row.reason,
        recipient: row.recipient,
      };
    } catch (error) {
      logger.error('Failed to get delivery status', {
        error: error.message,
        messageId,
      });
      throw error;
    }
  }

  public async updateDeliveryStatus(status: DeliveryStatus): Promise<void> {
    const query = `
      INSERT INTO email_delivery_status (message_id, status, timestamp, reason, recipient)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (message_id, recipient) 
      DO UPDATE SET status = $2, timestamp = $3, reason = $4
    `;

    const values = [
      status.messageId,
      status.status,
      status.timestamp,
      status.reason,
      status.recipient,
    ];

    try {
      await this.db.query(query, values);
      logger.info('Delivery status updated', { messageId: status.messageId });
    } catch (error) {
      logger.error('Failed to update delivery status', {
        error: error.message,
        messageId: status.messageId,
      });
      throw error;
    }
  }

  public async getEmailMetrics(organizationId: string, startDate: Date, endDate: Date): Promise<EmailMetrics> {
    const query = `
      SELECT 
        COUNT(*) as sent,
        COUNT(CASE WHEN eds.status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN eds.status = 'bounced' THEN 1 END) as bounced,
        COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END) as opened,
        COUNT(CASE WHEN el.clicked_at IS NOT NULL THEN 1 END) as clicked,
        COUNT(CASE WHEN eds.status = 'complained' THEN 1 END) as complained,
        0 as unsubscribed
      FROM email_logs el
      LEFT JOIN email_delivery_status eds ON el.message_id = eds.message_id
      WHERE el.organization_id = $1 
        AND el.sent_at >= $2 
        AND el.sent_at <= $3
    `;

    try {
      const result = await this.db.query(query, [organizationId, startDate, endDate]);
      const row = result.rows[0];

      return {
        sent: parseInt(row.sent || '0'),
        delivered: parseInt(row.delivered || '0'),
        bounced: parseInt(row.bounced || '0'),
        opened: parseInt(row.opened || '0'),
        clicked: parseInt(row.clicked || '0'),
        complained: parseInt(row.complained || '0'),
        unsubscribed: parseInt(row.unsubscribed || '0'),
      };
    } catch (error) {
      logger.error('Failed to get email metrics', {
        error: error.message,
        organizationId,
      });
      throw error;
    }
  }
}