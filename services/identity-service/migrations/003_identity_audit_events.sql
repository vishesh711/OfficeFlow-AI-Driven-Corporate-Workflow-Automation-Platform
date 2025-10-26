-- Identity audit events table for compliance and monitoring
CREATE TABLE IF NOT EXISTS identity_audit_events (
    id VARCHAR(255) PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
    employee_id UUID NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    actor_type VARCHAR(50) NOT NULL CHECK (actor_type IN ('system', 'user', 'service')),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('user_account', 'group', 'license', 'permission')),
    provider VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
    details JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    correlation_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    
    -- Indexes for efficient querying
    CONSTRAINT valid_action CHECK (action ~ '^[a-z_]+\.[a-z_]+$')
);

-- Indexes for efficient audit trail queries
CREATE INDEX IF NOT EXISTS idx_identity_audit_org_timestamp 
ON identity_audit_events(organization_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_identity_audit_employee 
ON identity_audit_events(employee_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_identity_audit_actor 
ON identity_audit_events(actor_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_identity_audit_action 
ON identity_audit_events(action, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_identity_audit_correlation 
ON identity_audit_events(correlation_id);

CREATE INDEX IF NOT EXISTS idx_identity_audit_provider 
ON identity_audit_events(provider, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_identity_audit_status 
ON identity_audit_events(status, timestamp DESC);

-- Composite index for common compliance queries
CREATE INDEX IF NOT EXISTS idx_identity_audit_compliance 
ON identity_audit_events(organization_id, action, status, timestamp DESC);

-- Partial index for failed operations (for monitoring)
CREATE INDEX IF NOT EXISTS idx_identity_audit_failures 
ON identity_audit_events(organization_id, timestamp DESC) 
WHERE status IN ('failed', 'partial');

-- Table for storing compliance report metadata
CREATE TABLE IF NOT EXISTS identity_compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('access_review', 'provisioning_audit', 'deprovisioning_audit', 'permission_changes')),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    generated_by VARCHAR(255) NOT NULL,
    events_count INTEGER NOT NULL,
    summary JSONB NOT NULL DEFAULT '{}',
    file_path TEXT, -- Path to generated report file
    status VARCHAR(20) NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'archived', 'deleted')),
    
    CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Index for compliance reports
CREATE INDEX IF NOT EXISTS idx_compliance_reports_org_type 
ON identity_compliance_reports(organization_id, report_type, generated_at DESC);

-- Retention policy function (to be called by scheduled job)
CREATE OR REPLACE FUNCTION cleanup_old_audit_events(retention_days INTEGER DEFAULT 2555) -- ~7 years default
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM identity_audit_events 
    WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get audit statistics
CREATE OR REPLACE FUNCTION get_audit_statistics(
    org_id UUID,
    start_date TIMESTAMP DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMP DEFAULT NOW()
)
RETURNS TABLE (
    total_events BIGINT,
    successful_events BIGINT,
    failed_events BIGINT,
    unique_employees BIGINT,
    unique_actors BIGINT,
    events_by_action JSONB,
    events_by_provider JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE status = 'success') as successful_events,
        COUNT(*) FILTER (WHERE status IN ('failed', 'partial')) as failed_events,
        COUNT(DISTINCT employee_id) as unique_employees,
        COUNT(DISTINCT actor_id) as unique_actors,
        jsonb_object_agg(action, action_count) as events_by_action,
        jsonb_object_agg(provider, provider_count) as events_by_provider
    FROM (
        SELECT 
            status,
            employee_id,
            actor_id,
            action,
            COUNT(*) as action_count,
            provider,
            COUNT(*) as provider_count
        FROM identity_audit_events 
        WHERE organization_id = org_id 
        AND timestamp BETWEEN start_date AND end_date
        GROUP BY status, employee_id, actor_id, action, provider
    ) stats;
END;
$$ LANGUAGE plpgsql;