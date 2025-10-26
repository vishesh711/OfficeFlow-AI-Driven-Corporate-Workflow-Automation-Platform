-- RBAC Database Schema
-- Migration 007: Role-Based Access Control tables

-- Roles table - defines available roles in the system
CREATE TABLE roles (
    role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permissions table - defines available permissions
CREATE TABLE permissions (
    permission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(resource, action)
);

-- Role permissions junction table
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES users(user_id),
    PRIMARY KEY (role_id, permission_id)
);

-- User role assignments table
CREATE TABLE user_role_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(user_id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, role_id, org_id)
);

-- Organization roles table - allows orgs to customize role permissions
CREATE TABLE organization_roles (
    org_role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    custom_permissions UUID[] DEFAULT '{}', -- Array of additional permission IDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, role_id)
);

-- Resource permissions table - for fine-grained resource access
CREATE TABLE resource_permissions (
    resource_permission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id UUID NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
    permissions TEXT[] NOT NULL, -- Array of permission strings like "workflow:read"
    granted_by UUID NOT NULL REFERENCES users(user_id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Create indexes for performance
CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_is_system_role ON roles(is_system_role);

CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_action ON permissions(action);
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

CREATE INDEX idx_user_role_assignments_user_id ON user_role_assignments(user_id);
CREATE INDEX idx_user_role_assignments_role_id ON user_role_assignments(role_id);
CREATE INDEX idx_user_role_assignments_org_id ON user_role_assignments(org_id);
CREATE INDEX idx_user_role_assignments_is_active ON user_role_assignments(is_active);
CREATE INDEX idx_user_role_assignments_expires_at ON user_role_assignments(expires_at);

CREATE INDEX idx_organization_roles_org_id ON organization_roles(org_id);
CREATE INDEX idx_organization_roles_role_id ON organization_roles(role_id);
CREATE INDEX idx_organization_roles_is_enabled ON organization_roles(is_enabled);

CREATE INDEX idx_resource_permissions_resource_id ON resource_permissions(resource_id);
CREATE INDEX idx_resource_permissions_resource_type ON resource_permissions(resource_type);
CREATE INDEX idx_resource_permissions_user_id ON resource_permissions(user_id);
CREATE INDEX idx_resource_permissions_org_id ON resource_permissions(org_id);
CREATE INDEX idx_resource_permissions_is_active ON resource_permissions(is_active);

-- Add triggers for updated_at columns
CREATE TRIGGER update_roles_updated_at 
    BEFORE UPDATE ON roles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_roles_updated_at 
    BEFORE UPDATE ON organization_roles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert system roles and permissions
INSERT INTO roles (name, description, is_system_role) VALUES
    ('admin', 'Full system administrator with all permissions', true),
    ('manager', 'Organization manager with workflow and user management permissions', true),
    ('user', 'Standard user with workflow execution permissions', true),
    ('viewer', 'Read-only access to workflows and basic information', true);

-- Insert system permissions
INSERT INTO permissions (name, resource, action, description) VALUES
    ('system:admin', 'system', 'admin', 'Full system administration access'),
    ('organization:manage', 'organization', 'manage', 'Manage organization settings and users'),
    ('organization:read', 'organization', 'read', 'View organization information'),
    ('user:manage', 'user', 'manage', 'Create, update, and delete users'),
    ('user:read', 'user', 'read', 'View user information'),
    ('user:update', 'user', 'update', 'Update user information'),
    ('workflow:manage', 'workflow', 'manage', 'Full workflow management access'),
    ('workflow:create', 'workflow', 'create', 'Create new workflows'),
    ('workflow:read', 'workflow', 'read', 'View workflows'),
    ('workflow:update', 'workflow', 'update', 'Update existing workflows'),
    ('workflow:delete', 'workflow', 'delete', 'Delete workflows'),
    ('workflow:execute', 'workflow', 'execute', 'Execute workflows'),
    ('audit_log:read', 'audit_log', 'read', 'View audit logs'),
    ('integration:manage', 'integration', 'manage', 'Full integration management access'),
    ('integration:read', 'integration', 'read', 'View integration configurations'),
    ('integration:update', 'integration', 'update', 'Update integration configurations');

-- Assign permissions to system roles
DO $
DECLARE
    admin_role_id UUID;
    manager_role_id UUID;
    user_role_id UUID;
    viewer_role_id UUID;
BEGIN
    -- Get role IDs
    SELECT role_id INTO admin_role_id FROM roles WHERE name = 'admin';
    SELECT role_id INTO manager_role_id FROM roles WHERE name = 'manager';
    SELECT role_id INTO user_role_id FROM roles WHERE name = 'user';
    SELECT role_id INTO viewer_role_id FROM roles WHERE name = 'viewer';

    -- Admin permissions (all permissions)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT admin_role_id, permission_id FROM permissions;

    -- Manager permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT manager_role_id, permission_id FROM permissions 
    WHERE name IN (
        'workflow:create', 'workflow:read', 'workflow:update', 'workflow:delete', 'workflow:execute',
        'user:read', 'user:update',
        'audit_log:read',
        'integration:read', 'integration:update',
        'organization:read'
    );

    -- User permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT user_role_id, permission_id FROM permissions 
    WHERE name IN (
        'workflow:read', 'workflow:execute',
        'user:read',
        'audit_log:read',
        'organization:read'
    );

    -- Viewer permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT viewer_role_id, permission_id FROM permissions 
    WHERE name IN (
        'workflow:read',
        'user:read',
        'organization:read'
    );
END $;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
    p_user_id UUID,
    p_org_id UUID,
    p_resource VARCHAR(50),
    p_action VARCHAR(50)
) RETURNS BOOLEAN AS $
DECLARE
    permission_exists BOOLEAN := false;
BEGIN
    -- Check if user has permission through role assignments
    SELECT EXISTS(
        SELECT 1
        FROM user_role_assignments ura
        JOIN role_permissions rp ON ura.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.permission_id
        WHERE ura.user_id = p_user_id
        AND ura.org_id = p_org_id
        AND ura.is_active = true
        AND (ura.expires_at IS NULL OR ura.expires_at > NOW())
        AND p.resource = p_resource
        AND p.action = p_action
    ) INTO permission_exists;

    -- If not found through roles, check resource-specific permissions
    IF NOT permission_exists THEN
        SELECT EXISTS(
            SELECT 1
            FROM resource_permissions rp
            WHERE rp.user_id = p_user_id
            AND rp.org_id = p_org_id
            AND rp.is_active = true
            AND (rp.expires_at IS NULL OR rp.expires_at > NOW())
            AND (p_resource || ':' || p_action) = ANY(rp.permissions)
        ) INTO permission_exists;
    END IF;

    RETURN permission_exists;
END;
$ LANGUAGE plpgsql;

-- Function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(
    p_user_id UUID,
    p_org_id UUID
) RETURNS TABLE(permission_name VARCHAR(100), resource VARCHAR(50), action VARCHAR(50)) AS $
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.name, p.resource, p.action
    FROM user_role_assignments ura
    JOIN role_permissions rp ON ura.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.permission_id
    WHERE ura.user_id = p_user_id
    AND ura.org_id = p_org_id
    AND ura.is_active = true
    AND (ura.expires_at IS NULL OR ura.expires_at > NOW())
    
    UNION
    
    SELECT DISTINCT 
        unnest(rp.permissions) as permission_name,
        split_part(unnest(rp.permissions), ':', 1) as resource,
        split_part(unnest(rp.permissions), ':', 2) as action
    FROM resource_permissions rp
    WHERE rp.user_id = p_user_id
    AND rp.org_id = p_org_id
    AND rp.is_active = true
    AND (rp.expires_at IS NULL OR rp.expires_at > NOW());
END;
$ LANGUAGE plpgsql;

-- Function to cleanup expired role assignments and permissions
CREATE OR REPLACE FUNCTION cleanup_expired_rbac_data()
RETURNS void AS $
BEGIN
    -- Deactivate expired role assignments
    UPDATE user_role_assignments 
    SET is_active = false 
    WHERE expires_at < NOW() AND is_active = true;
    
    -- Deactivate expired resource permissions
    UPDATE resource_permissions 
    SET is_active = false 
    WHERE expires_at < NOW() AND is_active = true;
END;
$ LANGUAGE plpgsql;