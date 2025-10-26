import { EmailRequest, EmailResult, EmailTemplate, DeliveryStatus, EmailMetrics } from '../types/email-types';
import { TemplateEngine } from '../templates/template-engine';
import { SMTPProvider } from '../providers/smtp-provider';
import { EmailRepository } from '../repositories/email-repository';
import { getEmailConfig } from '../config/email-config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class EmailService {
  private templateEngine: TemplateEngine;
  private smtpProvider: SMTPProvider;
  private emailRepository: EmailRepository;
  private config = getEmailConfig();

  constructor() {
    this.templateEngine = new TemplateEngine(this.config.templateCacheTtl);
    this.emailRepository = new EmailRepository();
    
    // Initialize SMTP provider with default config
    const defaultProvider = this.config.providers.find(p => p.isDefault);
    if (defaultProvider && defaultProvider.type === 'smtp') {
      this.smtpProvider = new SMTPProvider(defaultProvider.config as any);
    }
  }

  public async sendEmail(request: EmailRequest): Promise<EmailResult> {
    try {
      // Validate request
      this.validateEmailRequest(request);

      let renderedContent: { subject: string; html: string; text?: string };

      if (request.templateId) {
        // Use template
        const template = await this.emailRepository.getTemplate(request.templateId);
        if (!template) {
          throw new Error(`Template ${request.templateId} not found`);
        }

        // Ensure template is compiled
        this.templateEngine.compileTemplate(template);
        
        // Render template with variables
        renderedContent = this.templateEngine.renderTemplate(
          request.templateId,
          request.templateVariables || {}
        );
      } else {
        // Use direct content
        if (!request.htmlContent && !request.textContent) {
          throw new Error('Either templateId or content must be provided');
        }

        renderedContent = {
          subject: request.subject,
          html: request.htmlContent || '',
          text: request.textContent,
        };
      }

      // Send email
      const result = await this.smtpProvider.sendEmail(request, renderedContent);

      // Store email record
      await this.emailRepository.createEmailRecord({
        messageId: result.messageId,
        organizationId: request.organizationId,
        templateId: request.templateId,
        recipients: request.to,
        subject: renderedContent.subject,
        status: result.status,
        sentAt: new Date(),
        error: result.error,
      });

      return result;
    } catch (error) {
      logger.error('Email service error', {
        error: error.message,
        request: {
          to: request.to,
          templateId: request.templateId,
          organizationId: request.organizationId,
        },
      });

      return {
        messageId: '',
        status: 'failed',
        error: error.message,
      };
    }
  }

  public async createTemplate(template: Omit<EmailTemplate, 'templateId' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate> {
    // Validate template
    const errors = this.templateEngine.validateTemplate(
      template.htmlContent,
      template.textContent,
      template.subject
    );

    if (errors.length > 0) {
      throw new Error(`Template validation failed: ${errors.join(', ')}`);
    }

    // Extract variables
    const htmlVariables = this.templateEngine.extractVariables(template.htmlContent);
    const subjectVariables = this.templateEngine.extractVariables(template.subject);
    const textVariables = template.textContent ? 
      this.templateEngine.extractVariables(template.textContent) : [];

    const allVariables = Array.from(new Set([
      ...htmlVariables,
      ...subjectVariables,
      ...textVariables,
    ]));

    const newTemplate: EmailTemplate = {
      templateId: uuidv4(),
      ...template,
      variables: allVariables,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to database
    await this.emailRepository.createTemplate(newTemplate);

    // Compile template for immediate use
    this.templateEngine.compileTemplate(newTemplate);

    return newTemplate;
  }

  public async updateTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const existingTemplate = await this.emailRepository.getTemplate(templateId);
    if (!existingTemplate) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate updated template
    const htmlContent = updates.htmlContent || existingTemplate.htmlContent;
    const textContent = updates.textContent || existingTemplate.textContent;
    const subject = updates.subject || existingTemplate.subject;

    const errors = this.templateEngine.validateTemplate(htmlContent, textContent, subject);
    if (errors.length > 0) {
      throw new Error(`Template validation failed: ${errors.join(', ')}`);
    }

    // Extract variables
    const htmlVariables = this.templateEngine.extractVariables(htmlContent);
    const subjectVariables = this.templateEngine.extractVariables(subject);
    const textVariables = textContent ? 
      this.templateEngine.extractVariables(textContent) : [];

    const allVariables = Array.from(new Set([
      ...htmlVariables,
      ...subjectVariables,
      ...textVariables,
    ]));

    const updatedTemplate: EmailTemplate = {
      ...existingTemplate,
      ...updates,
      variables: allVariables,
      updatedAt: new Date(),
    };

    // Update in database
    await this.emailRepository.updateTemplate(templateId, updatedTemplate);

    // Recompile template
    this.templateEngine.compileTemplate(updatedTemplate);

    return updatedTemplate;
  }

  public async getTemplate(templateId: string): Promise<EmailTemplate | null> {
    return this.emailRepository.getTemplate(templateId);
  }

  public async getTemplates(organizationId: string): Promise<EmailTemplate[]> {
    return this.emailRepository.getTemplatesByOrganization(organizationId);
  }

  public async deleteTemplate(templateId: string): Promise<void> {
    await this.emailRepository.deleteTemplate(templateId);
  }

  public async getDeliveryStatus(messageId: string): Promise<DeliveryStatus | null> {
    return this.emailRepository.getDeliveryStatus(messageId);
  }

  public async updateDeliveryStatus(status: DeliveryStatus): Promise<void> {
    await this.emailRepository.updateDeliveryStatus(status);
  }

  public async getEmailMetrics(organizationId: string, startDate: Date, endDate: Date): Promise<EmailMetrics> {
    return this.emailRepository.getEmailMetrics(organizationId, startDate, endDate);
  }

  public async verifyConnection(): Promise<boolean> {
    return this.smtpProvider.verifyConnection();
  }

  private validateEmailRequest(request: EmailRequest): void {
    if (!request.to || request.to.length === 0) {
      throw new Error('At least one recipient is required');
    }

    if (!request.organizationId) {
      throw new Error('Organization ID is required');
    }

    if (!request.templateId && !request.subject) {
      throw new Error('Subject is required when not using a template');
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allRecipients = [
      ...request.to,
      ...(request.cc || []),
      ...(request.bcc || []),
    ];

    for (const email of allRecipients) {
      if (!emailRegex.test(email)) {
        throw new Error(`Invalid email address: ${email}`);
      }
    }
  }
}