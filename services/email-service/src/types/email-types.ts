export interface EmailTemplate {
  templateId: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  templateId?: string;
  templateVariables?: Record<string, any>;
  htmlContent?: string;
  textContent?: string;
  attachments?: EmailAttachment[];
  organizationId: string;
  priority?: 'low' | 'normal' | 'high';
  scheduledAt?: Date;
  trackOpens?: boolean;
  trackClicks?: boolean;
}

export interface EmailAttachment {
  filename: string;
  content?: Buffer;
  path?: string;
  contentType?: string;
  cid?: string; // Content-ID for inline attachments
}

export interface EmailResult {
  messageId: string;
  status: 'sent' | 'failed' | 'queued';
  error?: string;
  deliveredAt?: Date;
  bounced?: boolean;
  opened?: boolean;
  clicked?: boolean;
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
}

export interface EmailProvider {
  name: string;
  type: 'smtp' | 'api';
  config: SMTPConfig | Record<string, any>;
  isDefault: boolean;
  organizationId?: string;
}

export interface DeliveryStatus {
  messageId: string;
  status: 'delivered' | 'bounced' | 'complained' | 'rejected';
  timestamp: Date;
  reason?: string;
  recipient: string;
}

export interface EmailMetrics {
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  complained: number;
  unsubscribed: number;
}
