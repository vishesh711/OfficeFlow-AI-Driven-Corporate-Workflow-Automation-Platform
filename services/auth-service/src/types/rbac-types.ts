import { UUID } from '@officeflow/types';
import { UserRole } from './auth-types';

// Core RBAC Types
export interface Role {
  roleId: UUID;
  name: string;
  description?: string;
  isSystemRole: boolean;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  permissionId: UUID;
  name: string;
  resource: string;
  action: string;
  description?: string;
  createdAt: Date;
}

export interface UserRoleAssignment {
  assignmentId: UUID;
  userId: UUID;
  roleId: UUID;
  orgId: UUID;
  assignedBy: UUID;
  assignedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface OrganizationRole {
  orgRoleId: UUID;
  orgId: UUID;
  roleId: UUID;
  isEnabled: boolean;
  customPermissions?: UUID[];
  createdAt: Date;
  updatedAt: Date;
}

// Resource-level access control
export interface ResourcePermission {
  resourceId: UUID;
  resourceType: string;
  userId: UUID;
  orgId: UUID;
  permissions: string[];
  grantedBy: UUID;
  grantedAt: Date;
  expiresAt?: Date;
}

// Permission checking types
export interface PermissionContext {
  userId: UUID;
  orgId: UUID;
  resource: string;
  action: string;
  resourceId?: UUID;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requiredPermissions?: string[];
  grantedPermissions?: string[];
}

// System resources and actions
export const RESOURCES = {
  WORKFLOW: 'workflow',
  USER: 'user',
  ORGANIZATION: 'organization',
  AUDIT_LOG: 'audit_log',
  INTEGRATION: 'integration',
  SYSTEM: 'system',
} as const;

export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  EXECUTE: 'execute',
  MANAGE: 'manage',
  ADMIN: 'admin',
} as const;

// System roles with predefined permissions
export const SYSTEM_ROLES = {
  ADMIN: {
    name: 'admin',
    description: 'Full system administrator with all permissions',
    permissions: [
      `${RESOURCES.SYSTEM}:${ACTIONS.ADMIN}`,
      `${RESOURCES.ORGANIZATION}:${ACTIONS.MANAGE}`,
      `${RESOURCES.USER}:${ACTIONS.MANAGE}`,
      `${RESOURCES.WORKFLOW}:${ACTIONS.MANAGE}`,
      `${RESOURCES.AUDIT_LOG}:${ACTIONS.READ}`,
      `${RESOURCES.INTEGRATION}:${ACTIONS.MANAGE}`,
    ],
  },
  MANAGER: {
    name: 'manager',
    description: 'Organization manager with workflow and user management permissions',
    permissions: [
      `${RESOURCES.WORKFLOW}:${ACTIONS.CREATE}`,
      `${RESOURCES.WORKFLOW}:${ACTIONS.READ}`,
      `${RESOURCES.WORKFLOW}:${ACTIONS.UPDATE}`,
      `${RESOURCES.WORKFLOW}:${ACTIONS.DELETE}`,
      `${RESOURCES.WORKFLOW}:${ACTIONS.EXECUTE}`,
      `${RESOURCES.USER}:${ACTIONS.READ}`,
      `${RESOURCES.USER}:${ACTIONS.UPDATE}`,
      `${RESOURCES.AUDIT_LOG}:${ACTIONS.READ}`,
      `${RESOURCES.INTEGRATION}:${ACTIONS.READ}`,
      `${RESOURCES.INTEGRATION}:${ACTIONS.UPDATE}`,
    ],
  },
  USER: {
    name: 'user',
    description: 'Standard user with workflow execution permissions',
    permissions: [
      `${RESOURCES.WORKFLOW}:${ACTIONS.READ}`,
      `${RESOURCES.WORKFLOW}:${ACTIONS.EXECUTE}`,
      `${RESOURCES.USER}:${ACTIONS.READ}`,
      `${RESOURCES.AUDIT_LOG}:${ACTIONS.READ}`,
    ],
  },
  VIEWER: {
    name: 'viewer',
    description: 'Read-only access to workflows and basic information',
    permissions: [`${RESOURCES.WORKFLOW}:${ACTIONS.READ}`, `${RESOURCES.USER}:${ACTIONS.READ}`],
  },
} as const;

// Permission validation helpers
export function formatPermission(resource: string, action: string): string {
  return `${resource}:${action}`;
}

export function parsePermission(permission: string): { resource: string; action: string } {
  const [resource, action] = permission.split(':');
  return { resource, action };
}

export function isValidPermission(permission: string): boolean {
  const { resource, action } = parsePermission(permission);
  return (
    Object.values(RESOURCES).includes(resource as any) &&
    Object.values(ACTIONS).includes(action as any)
  );
}

// Role hierarchy for permission inheritance
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 1,
  user: 2,
  manager: 3,
  admin: 4,
};

export function hasRoleHierarchy(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
