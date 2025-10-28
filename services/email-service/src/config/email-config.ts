import { SMTPConfig, EmailProvider } from '../types/email-types';

export interface EmailServiceConfig {
  port: number;
  uploadDir: string;
  maxFileSize: number;
  templateCacheTtl: number;
  defaultProvider: string;
  providers: EmailProvider[];
}

export const getEmailConfig = (): EmailServiceConfig => {
  const providers: EmailProvider[] = [];

  // SMTP Provider
  if (process.env.SMTP_HOST) {
    providers.push({
      name: 'smtp',
      type: 'smtp',
      config: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      } as SMTPConfig,
      isDefault: true,
    });
  }

  // AWS SES Provider
  if (process.env.AWS_SES_REGION) {
    providers.push({
      name: 'ses',
      type: 'api',
      config: {
        region: process.env.AWS_SES_REGION,
        accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
      },
      isDefault: !providers.length,
    });
  }

  // SendGrid Provider
  if (process.env.SENDGRID_API_KEY) {
    providers.push({
      name: 'sendgrid',
      type: 'api',
      config: {
        apiKey: process.env.SENDGRID_API_KEY,
      },
      isDefault: !providers.length,
    });
  }

  // Mailgun Provider
  if (process.env.MAILGUN_API_KEY) {
    providers.push({
      name: 'mailgun',
      type: 'api',
      config: {
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_DOMAIN,
      },
      isDefault: !providers.length,
    });
  }

  return {
    port: parseInt(process.env.PORT || '3003'),
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    templateCacheTtl: parseInt(process.env.TEMPLATE_CACHE_TTL || '3600000'), // 1 hour
    defaultProvider: providers.find((p) => p.isDefault)?.name || 'smtp',
    providers,
  };
};
