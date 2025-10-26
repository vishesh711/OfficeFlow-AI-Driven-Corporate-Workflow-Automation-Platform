import { Router, Request, Response } from 'express';
import { UUID } from '@officeflow/types';
import { RbacService } from '../services/rbac-service';
import { AuthMiddleware } from '../middleware/auth-middleware';
import { MockLogger } from '../utils/mock-dependencies';
import { RESOURCES, ACTIONS } from '../types/rbac-types';

export function createRbacRoutes(
  rbacService: RbacService,
  authMiddleware: AuthMiddleware,
  logger: MockLogger
): Router {
  const router = Router();

  /**
   * Get all available roles
   */
  router.get('/roles', 
    authMiddleware.authenticate,
    authMiddleware.authorizePermission(RESOURCES.USER, ACTIONS.READ),
    async (req: Request, res: Response) => {
      try {
        const roles = await rbacService.getAllRoles();
        
        res.json({
          success: true,
          data: roles
        });
      } catch (error) {
        logger.error('Error getting roles', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
          error: 'Failed to get roles',
          code: 'GET_ROLES_FAILED'
        });
      }
    }
  );

  /**
   * Get user's roles in organization
   */
  router.get('/users/:userId/roles',
    authMiddleware.authenticate,
    authMiddleware.authorizeOrganization,
    authMiddleware.authorizePermission(RESOURCES.USER, ACTIONS.READ),
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;
        const orgId = req.user!.orgId;

        const roles = await rbacService.getUserRoles(userId as UUID, orgId);
        
        res.json({
          success: true,
          data: roles
        });
      } catch (error) {
        logger.error('Error getting user roles', {
          userId: req.params.userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
          error: 'Failed to get user roles',
          code: 'GET_USER_ROLES_FAILED'
        });
      }
    }
  );

  /**
   * Get user's permissions in organization
   */
  router.get('/users/:userId/permissions',
    authMiddleware.authenticate,
    authMiddleware.authorizeOrganization,
    authMiddleware.authorizePermission(RESOURCES.USER, ACTIONS.READ),
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;
        const orgId = req.user!.orgId;

        const permissions = await rbacService.getUserPermissions(userId as UUID, orgId);
        
        res.json({
          success: true,
          data: permissions
        });
      } catch (error) {
        logger.error('Error getting user permissions', {
          userId: req.params.userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
          error: 'Failed to get user permissions',
          code: 'GET_USER_PERMISSIONS_FAILED'
        });
      }
    }
  );

  /**
   * Assign role to user
   */
  router.post('/users/:userId/roles',
    authMiddleware.authenticate,
    authMiddleware.authorizeOrganization,
    authMiddleware.authorizePermission(RESOURCES.USER, ACTIONS.UPDATE),
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;
        const { roleId, expiresAt } = req.body;
        const orgId = req.user!.orgId;
        const assignedBy = req.user!.userId;

        if (!roleId) {
          res.status(400).json({
            error: 'Role ID is required',
            code: 'MISSING_ROLE_ID'
          });
          return;
        }

        const assignment = await rbacService.assignUserRole(
          userId as UUID,
          roleId as UUID,
          orgId,
          assignedBy,
          expiresAt ? new Date(expiresAt) : undefined
        );
        
        res.json({
          success: true,
          data: assignment
        });
      } catch (error) {
        logger.error('Error assigning role to user', {
          userId: req.params.userId,
          roleId: req.body.roleId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
          error: 'Failed to assign role',
          code: 'ASSIGN_ROLE_FAILED'
        });
      }
    }
  );

  /**
   * Remove role from user
   */
  router.delete('/users/:userId/roles/:roleId',
    authMiddleware.authenticate,
    authMiddleware.authorizeOrganization,
    authMiddleware.authorizePermission(RESOURCES.USER, ACTIONS.UPDATE),
    async (req: Request, res: Response) => {
      try {
        const { userId, roleId } = req.params;
        const orgId = req.user!.orgId;

        await rbacService.removeUserRole(
          userId as UUID,
          roleId as UUID,
          orgId
        );
        
        res.json({
          success: true,
          message: 'Role removed successfully'
        });
      } catch (error) {
        logger.error('Error removing role from user', {
          userId: req.params.userId,
          roleId: req.params.roleId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
          error: 'Failed to remove role',
          code: 'REMOVE_ROLE_FAILED'
        });
      }
    }
  );

  /**
   * Check if user has specific permission
   */
  router.post('/permissions/check',
    authMiddleware.authenticate,
    async (req: Request, res: Response) => {
      try {
        const { resource, action, resourceId } = req.body;
        const userId = req.user!.userId;
        const orgId = req.user!.orgId;

        if (!resource || !action) {
          res.status(400).json({
            error: 'Resource and action are required',
            code: 'MISSING_PERMISSION_PARAMS'
          });
          return;
        }

        const result = await rbacService.hasPermission({
          userId,
          orgId,
          resource,
          action,
          resourceId: resourceId as UUID
        });
        
        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        logger.error('Error checking permission', {
          userId: req.user?.userId,
          resource: req.body.resource,
          action: req.body.action,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
          error: 'Failed to check permission',
          code: 'CHECK_PERMISSION_FAILED'
        });
      }
    }
  );

  /**
   * Grant resource-specific permission to user
   */
  router.post('/resources/:resourceId/permissions',
    authMiddleware.authenticate,
    authMiddleware.authorizeOrganization,
    authMiddleware.authorizePermission(RESOURCES.USER, ACTIONS.MANAGE),
    async (req: Request, res: Response) => {
      try {
        const { resourceId } = req.params;
        const { resourceType, userId, permissions, expiresAt } = req.body;
        const orgId = req.user!.orgId;
        const grantedBy = req.user!.userId;

        if (!resourceType || !userId || !permissions || !Array.isArray(permissions)) {
          res.status(400).json({
            error: 'Resource type, user ID, and permissions array are required',
            code: 'MISSING_RESOURCE_PERMISSION_PARAMS'
          });
          return;
        }

        const resourcePermission = await rbacService.grantResourcePermission(
          resourceId as UUID,
          resourceType,
          userId as UUID,
          orgId,
          permissions,
          grantedBy,
          expiresAt ? new Date(expiresAt) : undefined
        );
        
        res.json({
          success: true,
          data: resourcePermission
        });
      } catch (error) {
        logger.error('Error granting resource permission', {
          resourceId: req.params.resourceId,
          userId: req.body.userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
          error: 'Failed to grant resource permission',
          code: 'GRANT_RESOURCE_PERMISSION_FAILED'
        });
      }
    }
  );

  /**
   * Revoke resource-specific permission from user
   */
  router.delete('/resources/:resourceId/permissions/:userId',
    authMiddleware.authenticate,
    authMiddleware.authorizeOrganization,
    authMiddleware.authorizePermission(RESOURCES.USER, ACTIONS.MANAGE),
    async (req: Request, res: Response) => {
      try {
        const { resourceId, userId } = req.params;
        const orgId = req.user!.orgId;

        await rbacService.revokeResourcePermission(
          resourceId as UUID,
          userId as UUID,
          orgId
        );
        
        res.json({
          success: true,
          message: 'Resource permission revoked successfully'
        });
      } catch (error) {
        logger.error('Error revoking resource permission', {
          resourceId: req.params.resourceId,
          userId: req.params.userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
          error: 'Failed to revoke resource permission',
          code: 'REVOKE_RESOURCE_PERMISSION_FAILED'
        });
      }
    }
  );

  /**
   * Create custom role
   */
  router.post('/roles',
    authMiddleware.authenticate,
    authMiddleware.authorizePermission(RESOURCES.USER, ACTIONS.MANAGE),
    async (req: Request, res: Response) => {
      try {
        const { name, description, permissionIds } = req.body;

        if (!name || !Array.isArray(permissionIds)) {
          res.status(400).json({
            error: 'Role name and permissions array are required',
            code: 'MISSING_ROLE_PARAMS'
          });
          return;
        }

        const role = await rbacService.createRole(name, description || '', permissionIds);
        
        res.status(201).json({
          success: true,
          data: role
        });
      } catch (error) {
        logger.error('Error creating role', {
          name: req.body.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
          error: 'Failed to create role',
          code: 'CREATE_ROLE_FAILED'
        });
      }
    }
  );

  return router;
}