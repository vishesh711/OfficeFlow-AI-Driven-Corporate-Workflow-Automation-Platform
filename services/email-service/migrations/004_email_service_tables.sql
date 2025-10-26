-- Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
    template_id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT,
    variables JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- Email Logs Table
CREATE TABLE IF NOT EXISTS email_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(255) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
    template_id UUID REFERENCES email_templates(template_id) ON DELETE SET NULL,
    recipients JSONB NOT NULL,
    subject TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'sent',
    sent_at TIMESTAMP DEFAULT NOW(),
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    error_message TEXT,
    UNIQUE(message_id)
);

-- Email Delivery Status Table
CREATE TABLE IF NOT EXISTS email_delivery_status (
    status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(255) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL, -- delivered, bounced, complained, rejected
    timestamp TIMESTAMP DEFAULT NOW(),
    reason TEXT,
    UNIQUE(message_id, recipient)
);

-- Email Attachments Table
CREATE TABLE IF NOT EXISTS email_attachments (
    attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id UUID NOT NULL REFERENCES email_logs(log_id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT,
    content_type VARCHAR(100),
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_templates_org_id ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_org_id ON email_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_message_id ON email_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_status_message_id ON email_delivery_status(message_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_status_timestamp ON email_delivery_status(timestamp);

-- Comments
COMMENT ON TABLE email_templates IS 'Email templates with Handlebars support';
COMMENT ON TABLE email_logs IS 'Log of all sent emails with tracking information';
COMMENT ON TABLE email_delivery_status IS 'Delivery status updates from email providers';
COMMENT ON TABLE email_attachments IS 'File attachments associated with sent emails';