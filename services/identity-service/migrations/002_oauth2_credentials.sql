-- OAuth2 credentials table for encrypted token storage
CREATE TABLE IF NOT EXISTS oauth2_credentials (
    id VARCHAR(255) PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type VARCHAR(50) NOT NULL DEFAULT 'Bearer',
    expires_in INTEGER NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    scope TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure one credential per organization per provider
    UNIQUE(organization_id, provider)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_oauth2_credentials_org_provider 
ON oauth2_credentials(organization_id, provider);

CREATE INDEX IF NOT EXISTS idx_oauth2_credentials_expires_at 
ON oauth2_credentials(expires_at);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_oauth2_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oauth2_credentials_updated_at
    BEFORE UPDATE ON oauth2_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_oauth2_credentials_updated_at();