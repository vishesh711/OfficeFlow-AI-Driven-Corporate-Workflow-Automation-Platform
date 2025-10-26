import { Pool } from 'pg';
import { RbacService } from '../services/rbac-service';
import { MockLogger } from '../utils/mock-dependencies';
import { RESOURCES, ACTIONS, formatPermission } from '../types/rbac-types';

// Mock dependencies
const mockDb = {
  query: jest.fn(),
  connect: jest.fn()
} as unknown as Pool;

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
} as MockLogger;

describe('RbacService', () => {
  let rbacService: RbacService;

  beforeEach(() => {
    rbacService = new RbacService(mockDb, mockLogger);
    jest.clearAllMocks();
  });

  describe('hasPermission', () => {
    it('should return true when user has role-based permission', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({
        rows: [{ has_permission: true }]
      });

      const context = {
        userId: 'user-123',
        orgId: 'org-456',
        resource: RESOURCES.WORKFLOW,
        action: ACTIONS.READ
      };

      const result = await rbacService.hasPermission(context);

      expect(result.allowed).toBe(true);
      expect(result.grantedPermissions).toContain(formatPermission(RESOURCES.WORKFLOW, ACTIONS.READ));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT user_has_permission($1, $2, $3, $4) as has_permission'),
        ['user-123', 'org-456', RESOURCES.WORKFLOW, ACTIONS.READ]
      );
    });

    it('should return true when user has resource-specific permission', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      // First query (role-based) returns false
      mockQuery.mockResolvedValueOnce({
        rows: [{ has_permission: false }]
      });
      // Second query (resource-specific) returns true
      mockQuery.mockResolvedValueOnce({
        rows: [{ has_resource_permission: true }]
      });

      const context = {
        userId: 'user-123',
        orgId: 'org-456',
        resource: RESOURCES.WORKFLOW,
        action: ACTIONS.READ,
        resourceId: 'workflow-789'
      };

      const result = await rbacService.hasPermission(context);

      expect(result.allowed).toBe(true);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should return false when user has no permission', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({
        rows: [{ has_permission: false }]
      });

      const context = {
        userId: 'user-123',
        orgId: 'org-456',
        resource: RESOURCES.WORKFLOW,
        action: ACTIONS.DELETE
      };

      const result = await rbacService.hasPermission(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Missing permission');
      expect(result.requiredPermissions).toContain(formatPermission(RESOURCES.WORKFLOW, ACTIONS.DELETE));
    });

    it('should handle database errors gracefully', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const context = {
        userId: 'user-123',
        orgId: 'org-456',
        resource: RESOURCES.WORKFLOW,
        action: ACTIONS.READ
      };

      const result = await rbacService.hasPermission(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Permission check failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('hasPermissions', () => {
    it('should return true when user has all required permissions', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      // Mock successful permission checks
      mockQuery
        .mockResolvedValueOnce({ rows: [{ has_permission: true }] })
        .mockResolvedValueOnce({ rows: [{ has_permission: true }] });

      const permissions = [
        { resource: RESOURCES.WORKFLOW, action: ACTIONS.READ },
        { resource: RESOURCES.WORKFLOW, action: ACTIONS.UPDATE }
      ];

      const result = await rbacService.hasPermissions('user-123', 'org-456', permissions);

      expect(result.allowed).toBe(true);
      expect(result.grantedPermissions).toHaveLength(2);
    });

    it('should return false when user is missing some permissions', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      // First permission granted, second denied
      mockQuery
        .mockResolvedValueOnce({ rows: [{ has_permission: true }] })
        .mockResolvedValueOnce({ rows: [{ has_permission: false }] });

      const permissions = [
        { resource: RESOURCES.WORKFLOW, action: ACTIONS.READ },
        { resource: RESOURCES.WORKFLOW, action: ACTIONS.DELETE }
      ];

      const result = await rbacService.hasPermissions('user-123', 'org-456', permissions);

      expect(result.allowed).toBe(false);
      expect(result.requiredPermissions).toContain(formatPermission(RESOURCES.WORKFLOW, ACTIONS.DELETE));
      expect(result.grantedPermissions).toContain(formatPermission(RESOURCES.WORKFLOW, ACTIONS.READ));
    });
  });

  describe('assignUserRole', () => {
    it('should successfully assign role to user', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({
        rows: [{
          assignment_id: 'assignment-123',
          user_id: 'user-123',
          role_id: 'role-456',
          org_id: 'org-789',
          assigned_by: 'admin-123',
          assigned_at: new Date(),
          expires_at: null,
          is_active: true
        }]
      });

      const result = await rbacService.assignUserRole(
        'user-123',
        'role-456',
        'org-789',
        'admin-123'
      );

      expect(result.userId).toBe('user-123');
      expect(result.roleId).toBe('role-456');
      expect(result.isActive).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Role assigned to user', expect.any(Object));
    });

    it('should handle assignment errors', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      mockQuery.mockRejectedValueOnce(new Error('Constraint violation'));

      await expect(
        rbacService.assignUserRole('user-123', 'role-456', 'org-789', 'admin-123')
      ).rejects.toThrow('Constraint violation');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getUserRoles', () => {
    it('should return user roles with permissions', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      // Mock roles query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          role_id: 'role-123',
          name: 'manager',
          description: 'Manager role',
          is_system_role: true,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });
      // Mock permissions query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          permission_id: 'perm-123',
          name: 'workflow:read',
          resource: 'workflow',
          action: 'read',
          description: 'Read workflows',
          created_at: new Date()
        }]
      });

      const roles = await rbacService.getUserRoles('user-123', 'org-456');

      expect(roles).toHaveLength(1);
      expect(roles[0].name).toBe('manager');
      expect(roles[0].permissions).toHaveLength(1);
      expect(roles[0].permissions[0].name).toBe('workflow:read');
    });
  });

  describe('grantResourcePermission', () => {
    it('should successfully grant resource permission', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({
        rows: [{
          resource_permission_id: 'res-perm-123',
          resource_id: 'resource-456',
          resource_type: 'workflow',
          user_id: 'user-123',
          org_id: 'org-789',
          permissions: ['workflow:read', 'workflow:update'],
          granted_by: 'admin-123',
          granted_at: new Date(),
          expires_at: null
        }]
      });

      const result = await rbacService.grantResourcePermission(
        'resource-456',
        'workflow',
        'user-123',
        'org-789',
        ['workflow:read', 'workflow:update'],
        'admin-123'
      );

      expect(result.resourceId).toBe('resource-456');
      expect(result.permissions).toContain('workflow:read');
      expect(result.permissions).toContain('workflow:update');
    });

    it('should reject invalid permissions', async () => {
      await expect(
        rbacService.grantResourcePermission(
          'resource-456',
          'workflow',
          'user-123',
          'org-789',
          ['invalid:permission'],
          'admin-123'
        )
      ).rejects.toThrow('Invalid permissions');
    });
  });

  describe('canAccessOrganization', () => {
    it('should allow admin to access any organization', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({
        rows: [{
          org_id: 'org-123',
          role: 'admin'
        }]
      });

      const canAccess = await rbacService.canAccessOrganization('user-123', 'org-456');

      expect(canAccess).toBe(true);
    });

    it('should allow user to access their own organization', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({
        rows: [{
          org_id: 'org-456',
          role: 'user'
        }]
      });

      const canAccess = await rbacService.canAccessOrganization('user-123', 'org-456');

      expect(canAccess).toBe(true);
    });

    it('should deny user access to other organizations', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({
        rows: [{
          org_id: 'org-123',
          role: 'user'
        }]
      });

      const canAccess = await rbacService.canAccessOrganization('user-123', 'org-456');

      expect(canAccess).toBe(false);
    });

    it('should deny access for inactive users', async () => {
      const mockQuery = mockDb.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({
        rows: []
      });

      const canAccess = await rbacService.canAccessOrganization('user-123', 'org-456');

      expect(canAccess).toBe(false);
    });
  });

  describe('createRole', () => {
    it('should create custom role with permissions', async () => {
      const mockConnect = mockDb.connect as jest.Mock;
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      mockConnect.mockResolvedValueOnce(mockClient);

      // Mock role creation
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            role_id: 'role-123',
            name: 'custom-role',
            description: 'Custom role',
            is_system_role: false,
            created_at: new Date(),
            updated_at: new Date()
          }]
        })
        .mockResolvedValueOnce(undefined) // Permission assignments
        .mockResolvedValueOnce(undefined); // COMMIT

      // Mock getRolePermissions call
      const mockQuery = mockDb.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({
        rows: [{
          permission_id: 'perm-123',
          name: 'workflow:read',
          resource: 'workflow',
          action: 'read',
          description: 'Read workflows',
          created_at: new Date()
        }]
      });

      const role = await rbacService.createRole(
        'custom-role',
        'Custom role',
        ['perm-123']
      );

      expect(role.name).toBe('custom-role');
      expect(role.isSystemRole).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on error', async () => {
      const mockConnect = mockDb.connect as jest.Mock;
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      mockConnect.mockResolvedValueOnce(mockClient);

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // Role creation fails

      await expect(
        rbacService.createRole('custom-role', 'Custom role', ['perm-123'])
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});