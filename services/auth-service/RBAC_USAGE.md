# Role-Based Access Control (RBAC) Usage Guide

This document explains how to use the RBAC system implemented in the Auth Service.

## Overview

The RBAC system provides fine-grained access control with the following features:

- **Role-based permissions**: Users are assigned roles, and roles have permissions
- **Resource-specific permissions**: Grant specific permissions for individual resources
- **Organization-level isolation**: Users can only access resources within their organization
- **Hierarchical roles**: Admin > Manager > User > Viewer
- **API endpoint authorization**: Middleware to protect routes

## System Roles

### Admin
- Full system access
- Can manage all organizations
- Can create/modify roles and permissions

### Manager
- Can manage workflows within their organization
- Can manage users within their organization
- Can view audit logs

### User
- Can execute workflows
- Can view workflows and basic information
- Limited access to organization data

### Viewer
- Read-only access to workflows
- Can view basic user information

## API Endpoints

### Authentication Required
All RBAC endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Role Management

#### Get All Roles
```http
GET /rbac/roles
```

#### Get User's Roles
```http
GET /rbac/users/{userId}/roles
```

#### Get User's Permissions
```http
GET /rbac/users/{userId}/permissions
```

#### Assign Role to User
```http
POST /rbac/users/{userId}/roles
Content-Type: application/json

{
  "roleId": "role-uuid",
  "expiresAt": "2024-12-31T23:59:59Z" // optional
}
```

#### Remove Role from User
```http
DELETE /rbac/users/{userId}/roles/{roleId}
```

### Permission Checking

#### Check Single Permission
```http
POST /rbac/permissions/check
Content-Type: application/json

{
  "resource": "workflow",
  "action": "read",
  "resourceId": "workflow-uuid" // optional
}
```

### Resource-Specific Permissions

#### Grant Resource Permission
```http
POST /rbac/resources/{resourceId}/permissions
Content-Type: application/json

{
  "resourceType": "workflow",
  "userId": "user-uuid",
  "permissions": ["workflow:read", "workflow:update"],
  "expiresAt": "2024-12-31T23:59:59Z" // optional
}
```

#### Revoke Resource Permission
```http
DELETE /rbac/resources/{resourceId}/permissions/{userId}
```

### Custom Roles

#### Create Custom Role
```http
POST /rbac/roles
Content-Type: application/json

{
  "name": "workflow-designer",
  "description": "Can design and manage workflows",
  "permissionIds": ["perm-uuid-1", "perm-uuid-2"]
}
```

## Middleware Usage

### Basic Authentication
```typescript
import { createAuthMiddleware } from './middleware/auth-middleware';

const authMiddleware = createAuthMiddleware(db, redis, logger);

// Require authentication
app.get('/protected', authMiddleware.authenticate, (req, res) => {
  // req.user is available here
  res.json({ user: req.user });
});
```

### Role-Based Authorization
```typescript
// Require specific roles
app.get('/admin-only', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin']),
  (req, res) => {
    res.json({ message: 'Admin access granted' });
  }
);
```

### Permission-Based Authorization
```typescript
// Require specific permission
app.get('/workflows',
  authMiddleware.authenticate,
  authMiddleware.authorizePermission('workflow', 'read'),
  (req, res) => {
    res.json({ workflows: [] });
  }
);

// Require multiple permissions
app.post('/workflows',
  authMiddleware.authenticate,
  authMiddleware.authorizePermissions([
    { resource: 'workflow', action: 'create' },
    { resource: 'organization', action: 'read' }
  ]),
  (req, res) => {
    res.json({ message: 'Workflow created' });
  }
);
```

### Organization Access Control
```typescript
// Ensure user can access the organization
app.get('/orgs/:orgId/users',
  authMiddleware.authenticate,
  authMiddleware.authorizeOrganization,
  authMiddleware.authorizePermission('user', 'read'),
  (req, res) => {
    res.json({ users: [] });
  }
);
```

### Resource-Specific Authorization
```typescript
// Check access to specific resource
app.get('/workflows/:id',
  authMiddleware.authenticate,
  authMiddleware.authorizeResource('workflow'),
  (req, res) => {
    // User has access to this specific workflow
    res.json({ workflow: {} });
  }
);
```

## Programmatic Usage

### Check Permissions in Code
```typescript
import { RbacService } from './services/rbac-service';

const rbacService = new RbacService(db, logger);

// Check single permission
const result = await rbacService.hasPermission({
  userId: 'user-123',
  orgId: 'org-456',
  resource: 'workflow',
  action: 'read',
  resourceId: 'workflow-789' // optional
});

if (result.allowed) {
  // User has permission
  console.log('Access granted');
} else {
  console.log('Access denied:', result.reason);
}

// Check multiple permissions
const multiResult = await rbacService.hasPermissions(
  'user-123',
  'org-456',
  [
    { resource: 'workflow', action: 'read' },
    { resource: 'workflow', action: 'update' }
  ]
);
```

### Assign Roles Programmatically
```typescript
// Assign role to user
await rbacService.assignUserRole(
  'user-123',
  'role-456',
  'org-789',
  'admin-123', // assigned by
  new Date('2024-12-31') // expires at (optional)
);

// Get user's roles
const roles = await rbacService.getUserRoles('user-123', 'org-789');

// Get user's permissions
const permissions = await rbacService.getUserPermissions('user-123', 'org-789');
```

### Grant Resource-Specific Permissions
```typescript
// Grant specific permissions for a resource
await rbacService.grantResourcePermission(
  'workflow-123', // resource ID
  'workflow', // resource type
  'user-456', // user ID
  'org-789', // organization ID
  ['workflow:read', 'workflow:update'], // permissions
  'admin-123', // granted by
  new Date('2024-12-31') // expires at (optional)
);
```

## Permission Format

Permissions follow the format: `resource:action`

### Available Resources
- `system` - System-wide operations
- `organization` - Organization management
- `user` - User management
- `workflow` - Workflow operations
- `audit_log` - Audit log access
- `integration` - Integration management

### Available Actions
- `admin` - Full administrative access
- `manage` - Full management access
- `create` - Create new resources
- `read` - View resources
- `update` - Modify existing resources
- `delete` - Remove resources
- `execute` - Execute operations

### Examples
- `workflow:read` - Can view workflows
- `user:manage` - Can fully manage users
- `system:admin` - Full system administration
- `audit_log:read` - Can view audit logs

## Database Functions

The system includes PostgreSQL functions for efficient permission checking:

### Check User Permission
```sql
SELECT user_has_permission('user-uuid', 'org-uuid', 'workflow', 'read');
```

### Get User Permissions
```sql
SELECT * FROM get_user_permissions('user-uuid', 'org-uuid');
```

### Cleanup Expired Data
```sql
SELECT cleanup_expired_rbac_data();
```

## Security Considerations

1. **Principle of Least Privilege**: Users should only have the minimum permissions needed
2. **Regular Audits**: Review role assignments and permissions regularly
3. **Expiration Dates**: Use expiration dates for temporary access
4. **Organization Isolation**: Users can only access their own organization (except admins)
5. **Session Management**: Permissions are checked on each request using active sessions

## Error Handling

The RBAC system returns structured error responses:

```json
{
  "error": "Insufficient permissions",
  "code": "INSUFFICIENT_PERMISSIONS",
  "requiredPermissions": ["workflow:read"],
  "grantedPermissions": ["workflow:execute"],
  "reason": "Missing permission: workflow:read"
}
```

Common error codes:
- `AUTHENTICATION_REQUIRED` - No valid JWT token
- `INSUFFICIENT_PERMISSIONS` - Missing required permissions
- `ORGANIZATION_ACCESS_DENIED` - Cannot access the organization
- `RESOURCE_ACCESS_DENIED` - Cannot access the specific resource
- `AUTHORIZATION_ERROR` - System error during authorization check