-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
    document_id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    description TEXT,
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    version INTEGER DEFAULT 1,
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(organization_id, name, version)
);

-- Document Versions Table
CREATE TABLE IF NOT EXISTS document_versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    size BIGINT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    change_log TEXT,
    UNIQUE(document_id, version)
);

-- Document Access Control Table
CREATE TABLE IF NOT EXISTS document_access (
    access_id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    user_id UUID,
    role VARCHAR(50),
    organization_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
    permissions JSONB NOT NULL DEFAULT '[]',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL
);

-- Document Shares Table (for external sharing)
CREATE TABLE IF NOT EXISTS document_shares (
    share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    share_token VARCHAR(255) UNIQUE NOT NULL,
    shared_by UUID NOT NULL,
    shared_with_email VARCHAR(255),
    permissions JSONB NOT NULL DEFAULT '[]',
    expires_at TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    max_access_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    last_accessed_at TIMESTAMP
);

-- Document Download Logs Table
CREATE TABLE IF NOT EXISTS document_download_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    downloaded_at TIMESTAMP DEFAULT NOW(),
    file_size BIGINT,
    download_duration_ms INTEGER
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_documents_mime_type ON documents(mime_type);
CREATE INDEX IF NOT EXISTS idx_documents_name_search ON documents USING GIN(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_documents_description_search ON documents USING GIN(to_tsvector('english', description));

CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_at ON document_versions(created_at);

CREATE INDEX IF NOT EXISTS idx_document_access_document_id ON document_access(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_user_id ON document_access(user_id);
CREATE INDEX IF NOT EXISTS idx_document_access_org_id ON document_access(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_access_expires_at ON document_access(expires_at);

CREATE INDEX IF NOT EXISTS idx_document_shares_token ON document_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_document_shares_document_id ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_expires_at ON document_shares(expires_at);

CREATE INDEX IF NOT EXISTS idx_document_download_logs_document_id ON document_download_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_document_download_logs_user_id ON document_download_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_document_download_logs_downloaded_at ON document_download_logs(downloaded_at);

-- Comments
COMMENT ON TABLE documents IS 'Main documents table with metadata and versioning';
COMMENT ON TABLE document_versions IS 'Document version history and storage references';
COMMENT ON TABLE document_access IS 'Role-based access control for documents';
COMMENT ON TABLE document_shares IS 'External document sharing with time-limited access';
COMMENT ON TABLE document_download_logs IS 'Audit log of document downloads';

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();