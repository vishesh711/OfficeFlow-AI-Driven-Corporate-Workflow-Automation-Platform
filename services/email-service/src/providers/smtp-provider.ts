import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { EmailRequest, EmailResult, SMTPConfig } from '../types/email-types';
import { logger } from '../utils/logger';

export class SMTPProvider {
  private transporter: Transporter;
  private config: SMTPConfig;

  constructor(config: SMTPConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransporter({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      pool: config.pool,
      maxConnections: config.maxConnections,
      maxMessages: config.maxMessages,
    });
  }

  public async sendEmail(request: EmailRequest, renderedContent: {
    subject: string;
    html: string;
    text?: string;
  }): Promise<EmailResult> {
    try {
      const mailOptions: SendMailOptions = {
        from: this.config.auth.user,
        to: request.to.join(', '),
        cc: request.cc?.join(', '),
        bcc: request.bcc?.join(', '),
        subject: renderedContent.subject,
        html: renderedContent.html,
        text: renderedContent.text,
        attachments: request.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          path: att.path,
          contentType: att.contentType,
          cid: att.cid,
        })),
        priority: request.priority === 'high' ? 'high' : 
                 request.priority === 'low' ? 'low' : 'normal',
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        messageId: info.messageId,
        recipients: request.to,
        subject: renderedContent.subject,
      });

      return {
        messageId: info.messageId,
        status: 'sent',
        deliveredAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to send email', {
        error: error.message,
        recipients: request.to,
        subject: renderedContent.subject,
      });

      return {
        messageId: '',
        status: 'failed',
        error: error.message,
      };
    }
  }

  public async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('SMTP connection verification failed', { error: error.message });
      return false;
    }
  }

  public async close(): Promise<void> {
    this.transporter.close();
  }
}