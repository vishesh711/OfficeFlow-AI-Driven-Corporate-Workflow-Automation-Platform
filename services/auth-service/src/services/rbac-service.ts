import { Pool } from 'pg';
import { UUID } from '@officeflow/types';
import { MockLogger } from '../utils/mock-dependencies';
import {
  Role,
  Permission,
  UserRoleAssignment,
  OrganizationRole,
  ResourcePermission,
  PermissionContext,
  PermissionResult,
  SYSTEM_ROLES,
  formatPermission,
  parsePermission,
  isValidPermission,
  hasRoleHierarchy
} from '../types/rbac-types';
import { UserRole } from '../types/auth-types';

export class RbacService {
  constructor(
    private db: Pool,
    private logger: MockLogger
  ) {}

  /**
   * Check if user has specific permission
   */
  async hasPermission(context: PermissionContext): Promise<PermissionResult> {
    try {
      const { userId, orgId, resource, action, resourceId } = context;
      const permissionString = formatPermission(resource, action);

      // Check using database function for role-based permissions
      const roleResult = await this.db.query(`
        SELECT user_has_permission($1, $2, $3, $4) as has_permission
      `, [userId, orgId, resource, action]);

      const hasRolePermission = roleResult.rows[0]?.has_permission || false;

      if (hasRolePermission) {
        return {
          allowed: true,
          grantedPermissions: [permissionString]
        };
      }

      // Check resource-specific permissions if resourceId is provided
      if (resourceId) {
        const resourceResult = await this.db.query(`
          SELECT EXISTS(
            SELECT 1
            FROM resource_permissions rp
            WHERE rp.user_id = $1
            AND rp.org_id = $2
            AND rp.resource_id = $3
            AND rp.is_active = true
            AND (rp.expires_at IS NULL OR rp.expires_at > NOW())
            AND $4 = ANY(rp.permissions)
          ) as has_resource_permission
        `, [userId, orgId, resourceId, permissionString]);

        const hasResourcePermission = resourceResult.rows[0]?.has_resource_permission || false;

        if (hasResourcePermission) {
          return {
            allowed: true,
            grantedPermissions: [permissionString]
          };
        }
      }

      return {
        allowed: false,
        reason: `Missing permission: ${permissionString}`,
        requiredPermissions: [permissionString]
      };

    } catch (error) {
      this.logger.error('Error checking permission', {
        context,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        allowed: false,
        reason: 'Permission check failed'
      };
    }
  }

  /**
   * Check multiple permissions at once
   */
  async hasPermissions(
    userId: UUID,
    orgId: UUID,
    permissions: Array<{ resource: string; action: string; resourceId?: UUID }>
  ): Promise<PermissionResult> {
    try {
      const results = await Promise.all(
        permissions.map(perm => 
          this.hasPermission({
            userId,
            orgId,
            resource: perm.resource,
            action: perm.action,
            resourceId: perm.resourceId
          })
        )
      );

      const deniedPermissions = results
        .filter(result => !result.allowed)
        .map(result => result.requiredPermissions)
        .flat()
        .filter(Boolean) as string[];

      const grantedPermissions = results
        .filter(result => result.allowed)
        .map(result => result.grantedPermissions)
        .flat()
        .filter(Boolean) as string[];

      if (deniedPermissions.length > 0) {
        return {
          allowed: false,
          reason: `Missing permissions: ${deniedPermissions.join(', ')}`,
          requiredPermissions: deniedPermissions,
          grantedPermissions
        };
      }

      return {
        allowed: true,
        grantedPermissions
      };

    } catch (error) {
      this.logger.error('Error checking multiple permissions', {
        userId,
        orgId,
        permissions,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        allowed: false,
        reason: 'Permission check failed'
      };
    }
  }

  /**
   * Get all permissions for a user in an organization
   */
  async getUserPermissions(userId: UUID, orgId: UUID): Promise<Permission[]> {
    try {
      const result = await this.db.query(`
        SELECT permission_name, resource, action
        FROM get_user_permissions($1, $2)
      `, [userId, orgId]);

      return result.rows.map(row => ({
        permissionId: '', // Not needed for this use case
        name: row.permission_name,
        resource: row.resource,
        action: row.action,
        createdAt: new Date()
      }));

    } catch (error) {
      this.logger.error('Error getting user permissions', {
        userId,
        orgId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Assign role to user in organization
   */
  async assignUserRole(
    userId: UUID,
    roleId: UUID,
    orgId: UUID,
    assignedBy: UUID,
    expiresAt?: Date
  ): Promise<UserRoleAssignment> {
    try {
      const result = await this.db.query(`
        INSERT INTO user_role_assignments (
          user_id, role_id, org_id, assigned_by, expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, role_id, org_id) 
        DO UPDATE SET 
          is_active = true,
          assigned_by = $4,
          assigned_at = NOW(),
          expires_at = $5
        RETURNING assignment_id, user_id, role_id, org_id, assigned_by, 
                  assigned_at, expires_at, is_active
      `, [userId, roleId, orgId, assignedBy, expiresAt]);

      const assignment = this.mapRowToUserRoleAssignment(result.rows[0]);

      this.logger.info('Role assigned to user', {
        userId,
        roleId,
        orgId,
        assignedBy,
        expiresAt
      });

      return assignment;

    } catch (error) {
      this.logger.error('Error assigning role to user', {
        userId,
        roleId,
        orgId,
        assignedBy,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Remove role from user in organization
   */
  async removeUserRole(userId: UUID, roleId: UUID, orgId: UUID): Promise<void> {
    try {
      await this.db.query(`
        UPDATE user_role_assignments
        SET is_active = false
        WHERE user_id = $1 AND role_id = $2 AND org_id = $3
      `, [userId, roleId, orgId]);

      this.logger.info('Role removed from user', {
        userId,
        roleId,
        orgId
      });

    } catch (error) {
      this.logger.error('Error removing role from user', {
        userId,
        roleId,
        orgId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user's roles in organization
   */
  async getUserRoles(userId: UUID, orgId: UUID): Promise<Role[]> {
    try {
      const result = await this.db.query(`
        SELECT r.role_id, r.name, r.description, r.is_system_role, 
               r.created_at, r.updated_at
        FROM user_role_assignments ura
        JOIN roles r ON ura.role_id = r.role_id
        WHERE ura.user_id = $1 
        AND ura.org_id = $2 
        AND ura.is_active = true
        AND (ura.expires_at IS NULL OR ura.expires_at > NOW())
      `, [userId, orgId]);

      const roles = await Promise.all(
        result.rows.map(async row => {
          const permissions = await this.getRolePermissions(row.role_id);
          return this.mapRowToRole(row, permissions);
        })
      );

      return roles;

    } catch (error) {
      this.logger.error('Error getting user roles', {
        userId,
        orgId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Grant resource-specific permission to user
   */
  async grantResourcePermission(
    resourceId: UUID,
    resourceType: string,
    userId: UUID,
    orgId: UUID,
    permissions: string[],
    grantedBy: UUID,
    expiresAt?: Date
  ): Promise<ResourcePermission> {
    try {
      // Validate permissions
      const invalidPermissions = permissions.filter(p => !isValidPermission(p));
      if (invalidPermissions.length > 0) {
        throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }

      const result = await this.db.query(`
        INSERT INTO resource_permissions (
          resource_id, resource_type, user_id, org_id, permissions, 
          granted_by, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING resource_permission_id, resource_id, resource_type, user_id, 
                  org_id, permissions, granted_by, granted_at, expires_at
      `, [resourceId, resourceType, userId, orgId, permissions, grantedBy, expiresAt]);

      const resourcePermission = this.mapRowToResourcePermission(result.rows[0]);

      this.logger.info('Resource permission granted', {
        resourceId,
        resourceType,
        userId,
        orgId,
        permissions,
        grantedBy
      });

      return resourcePermission;

    } catch (error) {
      this.logger.error('Error granting resource permission', {
        resourceId,
        resourceType,
        userId,
        orgId,
        permissions,
        grantedBy,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Revoke resource-specific permission from user
   */
  async revokeResourcePermission(
    resourceId: UUID,
    userId: UUID,
    orgId: UUID
  ): Promise<void> {
    try {
      await this.db.query(`
        UPDATE resource_permissions
        SET is_active = false
        WHERE resource_id = $1 AND user_id = $2 AND org_id = $3
      `, [resourceId, userId, orgId]);

      this.logger.info('Resource permission revoked', {
        resourceId,
        userId,
        orgId
      });

    } catch (error) {
      this.logger.error('Error revoking resource permission', {
        resourceId,
        userId,
        orgId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    try {
      const result = await this.db.query(`
        SELECT role_id, name, description, is_system_role, created_at, updated_at
        FROM roles
        ORDER BY is_system_role DESC, name ASC
      `);

      const roles = await Promise.all(
        result.rows.map(async row => {
          const permissions = await this.getRolePermissions(row.role_id);
          return this.mapRowToRole(row, permissions);
        })
      );

      return roles;

    } catch (error) {
      this.logger.error('Error getting all roles', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Get role permissions
   */
  async getRolePermissions(roleId: UUID): Promise<Permission[]> {
    try {
      const result = await this.db.query(`
        SELECT p.permission_id, p.name, p.resource, p.action, p.description, p.created_at
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.permission_id
        WHERE rp.role_id = $1
      `, [roleId]);

      return result.rows.map(row => this.mapRowToPermission(row));

    } catch (error) {
      this.logger.error('Error getting role permissions', {
        roleId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Create custom role
   */
  async createRole(
    name: string,
    description: string,
    permissionIds: UUID[]
  ): Promise<Role> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Create role
      const roleResult = await client.query(`
        INSERT INTO roles (name, description, is_system_role)
        VALUES ($1, $2, false)
        RETURNING role_id, name, description, is_system_role, created_at, updated_at
      `, [name, description]);

      const roleId = roleResult.rows[0].role_id;

      // Assign permissions
      if (permissionIds.length > 0) {
        const permissionValues = permissionIds.map((_, index) => 
          `($1, $${index + 2})`
        ).join(', ');

        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ${permissionValues}
        `, [roleId, ...permissionIds]);
      }

      await client.query('COMMIT');

      const permissions = await this.getRolePermissions(roleId);
      const role = this.mapRowToRole(roleResult.rows[0], permissions);

      this.logger.info('Custom role created', {
        roleId,
        name,
        permissionCount: permissionIds.length
      });

      return role;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Error creating role', {
        name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if user can access organization
   */
  async canAccessOrganization(userId: UUID, targetOrgId: UUID): Promise<boolean> {
    try {
      // Get user's organization and role
      const result = await this.db.query(`
        SELECT u.org_id, u.role
        FROM users u
        WHERE u.user_id = $1 AND u.is_active = true
      `, [userId]);

      if (result.rows.length === 0) {
        return false;
      }

      const { org_id: userOrgId, role } = result.rows[0];

      // Admins can access any organization
      if (role === 'admin') {
        return true;
      }

      // Users can only access their own organization
      return userOrgId === targetOrgId;

    } catch (error) {
      this.logger.error('Error checking organization access', {
        userId,
        targetOrgId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Map database row to Role object
   */
  private mapRowToRole(row: any, permissions: Permission[]): Role {
    return {
      roleId: row.role_id,
      name: row.name,
      description: row.description,
      isSystemRole: row.is_system_role,
      permissions,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Map database row to Permission object
   */
  private mapRowToPermission(row: any): Permission {
    return {
      permissionId: row.permission_id,
      name: row.name,
      resource: row.resource,
      action: row.action,
      description: row.description,
      createdAt: row.created_at
    };
  }

  /**
   * Map database row to UserRoleAssignment object
   */
  private mapRowToUserRoleAssignment(row: any): UserRoleAssignment {
    return {
      assignmentId: row.assignment_id,
      userId: row.user_id,
      roleId: row.role_id,
      orgId: row.org_id,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
      expiresAt: row.expires_at,
      isActive: row.is_active
    };
  }

  /**
   * Map database row to ResourcePermission object
   */
  private mapRowToResourcePermission(row: any): ResourcePermission {
    return {
      resourceId: row.resource_id,
      resourceType: row.resource_type,
      userId: row.user_id,
      orgId: row.org_id,
      permissions: row.permissions,
      grantedBy: row.granted_by,
      grantedAt: row.granted_at,
      expiresAt: row.expires_at
    };
  }
}