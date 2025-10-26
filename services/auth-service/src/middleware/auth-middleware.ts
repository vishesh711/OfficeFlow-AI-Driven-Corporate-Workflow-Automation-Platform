import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/jwt-service';
import { SessionService } from '../services/session-service';
import { RbacService } from '../services/rbac-service';
import { UserRepository } from '../repositories/user-repository';
import { JwtPayload, UserRole, AUTH_ERRORS } from '../types/auth-types';
import { PermissionContext } from '../types/rbac-types';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { MockLogger } from '../utils/mock-dependencies';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        orgId: string;
        email: string;
        role: UserRole;
        sessionId: string;
      };
    }
  }
}

export class AuthMiddleware {
  private jwtService: JwtService;
  private sessionService: SessionService;
  private rbacService: RbacService;
  private userRepository: UserRepository;

  constructor(
    private db: Pool,
    private redis: Redis,
    private logger: MockLogger
  ) {
    this.jwtService = new JwtService();
    this.sessionService = new SessionService(redis, db, logger);
    this.rbacService = new RbacService(db, logger);
    this.userRepository = new UserRepository(db, logger);
  }

  /**
   * Middleware to authenticate JWT token
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        res.status(401).json({
          error: AUTH_ERRORS.INVALID_TOKEN.message,
          code: AUTH_ERRORS.INVALID_TOKEN.code
        });
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verifyAccessToken(token);

      // Validate session
      const session = await this.sessionService.validateSession(payload.sessionId);
      if (!session) {
        res.status(401).json({
          error: AUTH_ERRORS.SESSION_EXPIRED.message,
          code: AUTH_ERRORS.SESSION_EXPIRED.code
        });
        return;
      }

      // Get user to ensure they're still active
      const user = await this.userRepository.findById(payload.userId);
      if (!user || !user.isActive) {
        res.status(401).json({
          error: AUTH_ERRORS.USER_NOT_FOUND.message,
          code: AUTH_ERRORS.USER_NOT_FOUND.code
        });
        return;
      }

      // Add user info to request
      req.user = {
        userId: payload.userId,
        orgId: payload.orgId,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sessionId
      };

      next();
    } catch (error) {
      this.logger.error('Authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: req.url,
        method: req.method,
        ip: req.ip
      });

      const message = error instanceof Error ? error.message : AUTH_ERRORS.INVALID_TOKEN.message;
      const statusCode = message.includes('expired') ? 401 : 401;
      
      res.status(statusCode).json({
        error: message,
        code: statusCode === 401 ? 'AUTHENTICATION_FAILED' : 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Middleware to authorize specific roles
   */
  authorize = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRoles: allowedRoles,
          userRole: req.user.role
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to authorize organization access
   */
  authorizeOrganization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    const orgId = req.params.orgId || req.body.orgId || req.query.orgId;
    
    if (!orgId) {
      res.status(400).json({
        error: 'Organization ID required',
        code: 'MISSING_ORGANIZATION_ID'
      });
      return;
    }

    try {
      const canAccess = await this.rbacService.canAccessOrganization(req.user.userId, orgId);
      
      if (!canAccess) {
        res.status(403).json({
          error: 'Access denied to organization',
          code: 'ORGANIZATION_ACCESS_DENIED'
        });
        return;
      }

      next();
    } catch (error) {
      this.logger.error('Organization authorization failed', {
        userId: req.user.userId,
        orgId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Authorization check failed',
        code: 'AUTHORIZATION_ERROR'
      });
    }
  };

  /**
   * Middleware to authorize specific permissions
   */
  authorizePermission = (resource: string, action: string) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
        return;
      }

      try {
        const context: PermissionContext = {
          userId: req.user.userId,
          orgId: req.user.orgId,
          resource,
          action,
          resourceId: req.params.resourceId || req.params.id
        };

        const result = await this.rbacService.hasPermission(context);

        if (!result.allowed) {
          res.status(403).json({
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            requiredPermissions: result.requiredPermissions,
            reason: result.reason
          });
          return;
        }

        next();
      } catch (error) {
        this.logger.error('Permission authorization failed', {
          userId: req.user.userId,
          resource,
          action,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Authorization check failed',
          code: 'AUTHORIZATION_ERROR'
        });
      }
    };
  };

  /**
   * Middleware to authorize multiple permissions (all must be granted)
   */
  authorizePermissions = (permissions: Array<{ resource: string; action: string }>) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
        return;
      }

      try {
        const result = await this.rbacService.hasPermissions(
          req.user.userId,
          req.user.orgId,
          permissions.map(p => ({
            ...p,
            resourceId: req.params.resourceId || req.params.id
          }))
        );

        if (!result.allowed) {
          res.status(403).json({
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            requiredPermissions: result.requiredPermissions,
            grantedPermissions: result.grantedPermissions,
            reason: result.reason
          });
          return;
        }

        next();
      } catch (error) {
        this.logger.error('Multiple permissions authorization failed', {
          userId: req.user.userId,
          permissions,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Authorization check failed',
          code: 'AUTHORIZATION_ERROR'
        });
      }
    };
  };

  /**
   * Middleware to authorize resource-specific access
   */
  authorizeResource = (resourceType: string) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
        return;
      }

      const resourceId = req.params.resourceId || req.params.id;
      if (!resourceId) {
        res.status(400).json({
          error: 'Resource ID required',
          code: 'MISSING_RESOURCE_ID'
        });
        return;
      }

      try {
        // Determine action based on HTTP method
        const methodActionMap: Record<string, string> = {
          'GET': 'read',
          'POST': 'create',
          'PUT': 'update',
          'PATCH': 'update',
          'DELETE': 'delete'
        };

        const action = methodActionMap[req.method] || 'read';

        const context: PermissionContext = {
          userId: req.user.userId,
          orgId: req.user.orgId,
          resource: resourceType,
          action,
          resourceId
        };

        const result = await this.rbacService.hasPermission(context);

        if (!result.allowed) {
          res.status(403).json({
            error: 'Access denied to resource',
            code: 'RESOURCE_ACCESS_DENIED',
            resourceType,
            resourceId,
            requiredPermissions: result.requiredPermissions,
            reason: result.reason
          });
          return;
        }

        next();
      } catch (error) {
        this.logger.error('Resource authorization failed', {
          userId: req.user.userId,
          resourceType,
          resourceId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Authorization check failed',
          code: 'AUTHORIZATION_ERROR'
        });
      }
    };
  };

  /**
   * Optional authentication middleware (doesn't fail if no token)
   */
  optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        next();
        return;
      }

      // Try to verify token, but don't fail if invalid
      try {
        const payload = this.jwtService.verifyAccessToken(token);
        const session = await this.sessionService.validateSession(payload.sessionId);
        
        if (session) {
          const user = await this.userRepository.findById(payload.userId);
          if (user && user.isActive) {
            req.user = {
              userId: payload.userId,
              orgId: payload.orgId,
              email: payload.email,
              role: payload.role,
              sessionId: payload.sessionId
            };
          }
        }
      } catch (error) {
        // Ignore authentication errors for optional auth
        this.logger.debug('Optional authentication failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      next();
    } catch (error) {
      // Even in optional auth, we should handle unexpected errors
      this.logger.error('Optional authentication error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next();
    }
  };

  /**
   * Extract JWT token from request
   */
  private extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookie (if using cookie-based auth)
    const cookieToken = req.cookies?.accessToken;
    if (cookieToken) {
      return cookieToken;
    }

    // Check query parameter (not recommended for production)
    const queryToken = req.query.token as string;
    if (queryToken) {
      return queryToken;
    }

    return null;
  }
}

/**
 * Factory function to create auth middleware
 */
export function createAuthMiddleware(db: Pool, redis: Redis, logger: MockLogger): AuthMiddleware {
  return new AuthMiddleware(db, redis, logger);
}

/**
 * Utility function to check if user has permission for resource
 */
export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    'viewer': 1,
    'user': 2,
    'manager': 3,
    'admin': 4
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Utility function to check if user can access organization
 */
export function canAccessOrganization(userOrgId: string, targetOrgId: string, userRole: UserRole): boolean {
  // Admins can access any organization
  if (userRole === 'admin') {
    return true;
  }

  // Users can only access their own organization
  return userOrgId === targetOrgId;
}