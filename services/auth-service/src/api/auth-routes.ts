import { Router, Request, Response, NextFunction } from 'express';
import { Joi, rateLimit, slowDown } from '../utils/mock-dependencies';
import { AuthService } from '../services/auth-service';
import { authConfig } from '../config/auth-config';
import { AUTH_ERRORS } from '../types/auth-types';
import { winston, MockLogger } from '../utils/mock-dependencies';

export function createAuthRoutes(authService: AuthService, logger: MockLogger): Router {
  const router = Router();

  // Rate limiting middleware
  const generalLimiter = rateLimit({
    windowMs: authConfig.rateLimit.windowMs,
    max: authConfig.rateLimit.maxRequests,
    message: {
      error: AUTH_ERRORS.RATE_LIMIT_EXCEEDED.message,
      code: AUTH_ERRORS.RATE_LIMIT_EXCEEDED.code
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  const loginLimiter = rateLimit({
    windowMs: authConfig.rateLimit.loginWindowMs,
    max: authConfig.rateLimit.loginMaxAttempts,
    message: {
      error: AUTH_ERRORS.RATE_LIMIT_EXCEEDED.message,
      code: AUTH_ERRORS.RATE_LIMIT_EXCEEDED.code
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => `${req.ip}:${req.body?.email || 'unknown'}`
  });

  const speedLimiter = slowDown({
    windowMs: authConfig.rateLimit.loginWindowMs,
    delayAfter: 2,
    delayMs: 500,
    maxDelayMs: 20000
  });

  // Validation schemas
  const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(1).required(),
    mfaToken: Joi.string().pattern(/^\d{6}$|^[A-Z0-9]{8}$/).optional(),
    rememberMe: Joi.boolean().optional()
  });

  const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required()
  });

  const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(authConfig.password.minLength).required()
  });

  const mfaSetupSchema = Joi.object({
    password: Joi.string().required()
  });

  const mfaVerifySchema = Joi.object({
    token: Joi.string().pattern(/^\d{6}$/).required()
  });

  const mfaDisableSchema = Joi.object({
    password: Joi.string().required(),
    mfaToken: Joi.string().pattern(/^\d{6}$|^[A-Z0-9]{8}$/).required()
  });

  // Validation middleware
  const validate = (schema: any) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const { error } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details ? error.details.map((d: any) => d.message) : ['Validation failed']
        });
      }
      next();
    };
  };

  // Helper to get client info
  const getClientInfo = (req: Request) => ({
    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown'
  });

  /**
   * POST /auth/login
   * Authenticate user and return JWT tokens
   */
  router.post('/login', 
    loginLimiter,
    speedLimiter,
    validate(loginSchema),
    async (req: Request, res: Response) => {
      try {
        const { ipAddress, userAgent } = getClientInfo(req);
        const result = await authService.login(req.body, ipAddress, userAgent);
        
        res.json(result);
      } catch (error) {
        logger.error('Login endpoint error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          email: req.body.email,
          ip: req.ip
        });

        const message = error instanceof Error ? error.message : 'Login failed';
        const statusCode = message.includes('Invalid') || message.includes('not found') ? 401 : 500;
        
        res.status(statusCode).json({
          error: message,
          code: statusCode === 401 ? 'AUTHENTICATION_FAILED' : 'INTERNAL_ERROR'
        });
      }
    }
  );

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  router.post('/refresh',
    generalLimiter,
    validate(refreshTokenSchema),
    async (req: Request, res: Response) => {
      try {
        const result = await authService.refreshToken(req.body);
        res.json(result);
      } catch (error) {
        logger.error('Token refresh endpoint error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: req.ip
        });

        const message = error instanceof Error ? error.message : 'Token refresh failed';
        const statusCode = message.includes('expired') || message.includes('Invalid') ? 401 : 500;
        
        res.status(statusCode).json({
          error: message,
          code: statusCode === 401 ? 'TOKEN_INVALID' : 'INTERNAL_ERROR'
        });
      }
    }
  );

  /**
   * POST /auth/logout
   * Logout user (terminate session)
   */
  router.post('/logout',
    generalLimiter,
    async (req: Request, res: Response) => {
      try {
        const sessionId = req.body.sessionId || req.headers['x-session-id'];
        
        if (!sessionId) {
          return res.status(400).json({
            error: 'Session ID required',
            code: 'MISSING_SESSION_ID'
          });
        }

        await authService.logout(sessionId);
        res.json({ message: 'Logged out successfully' });
      } catch (error) {
        logger.error('Logout endpoint error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: req.ip
        });

        res.status(500).json({
          error: 'Logout failed',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  );

  /**
   * POST /auth/logout-all
   * Logout user from all sessions
   */
  router.post('/logout-all',
    generalLimiter,
    async (req: Request, res: Response) => {
      try {
        const userId = req.body.userId || req.headers['x-user-id'];
        
        if (!userId) {
          return res.status(400).json({
            error: 'User ID required',
            code: 'MISSING_USER_ID'
          });
        }

        await authService.logoutAll(userId);
        res.json({ message: 'Logged out from all sessions successfully' });
      } catch (error) {
        logger.error('Logout all endpoint error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: req.ip
        });

        res.status(500).json({
          error: 'Logout all failed',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  );

  /**
   * POST /auth/change-password
   * Change user password
   */
  router.post('/change-password',
    generalLimiter,
    validate(changePasswordSchema),
    async (req: Request, res: Response) => {
      try {
        const userId = req.body.userId || req.headers['x-user-id'];
        
        if (!userId) {
          return res.status(400).json({
            error: 'User ID required',
            code: 'MISSING_USER_ID'
          });
        }

        await authService.changePassword(userId, req.body);
        res.json({ message: 'Password changed successfully' });
      } catch (error) {
        logger.error('Change password endpoint error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: req.body.userId,
          ip: req.ip
        });

        const message = error instanceof Error ? error.message : 'Password change failed';
        const statusCode = message.includes('Invalid') || message.includes('reuse') ? 400 : 500;
        
        res.status(statusCode).json({
          error: message,
          code: statusCode === 400 ? 'PASSWORD_CHANGE_FAILED' : 'INTERNAL_ERROR'
        });
      }
    }
  );

  /**
   * POST /auth/mfa/setup
   * Setup MFA for user
   */
  router.post('/mfa/setup',
    generalLimiter,
    validate(mfaSetupSchema),
    async (req: Request, res: Response) => {
      try {
        const userId = req.body.userId || req.headers['x-user-id'];
        
        if (!userId) {
          return res.status(400).json({
            error: 'User ID required',
            code: 'MISSING_USER_ID'
          });
        }

        const result = await authService.setupMfa(userId, req.body);
        res.json(result);
      } catch (error) {
        logger.error('MFA setup endpoint error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: req.body.userId,
          ip: req.ip
        });

        const message = error instanceof Error ? error.message : 'MFA setup failed';
        const statusCode = message.includes('Invalid') ? 401 : 500;
        
        res.status(statusCode).json({
          error: message,
          code: statusCode === 401 ? 'MFA_SETUP_FAILED' : 'INTERNAL_ERROR'
        });
      }
    }
  );

  /**
   * POST /auth/mfa/verify
   * Verify MFA setup
   */
  router.post('/mfa/verify',
    generalLimiter,
    validate(mfaVerifySchema),
    async (req: Request, res: Response) => {
      try {
        const userId = req.body.userId || req.headers['x-user-id'];
        
        if (!userId) {
          return res.status(400).json({
            error: 'User ID required',
            code: 'MISSING_USER_ID'
          });
        }

        await authService.verifyMfaSetup(userId, req.body);
        res.json({ message: 'MFA setup completed successfully' });
      } catch (error) {
        logger.error('MFA verify endpoint error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: req.body.userId,
          ip: req.ip
        });

        const message = error instanceof Error ? error.message : 'MFA verification failed';
        const statusCode = message.includes('Invalid') ? 401 : 500;
        
        res.status(statusCode).json({
          error: message,
          code: statusCode === 401 ? 'MFA_VERIFICATION_FAILED' : 'INTERNAL_ERROR'
        });
      }
    }
  );

  /**
   * POST /auth/mfa/disable
   * Disable MFA for user
   */
  router.post('/mfa/disable',
    generalLimiter,
    validate(mfaDisableSchema),
    async (req: Request, res: Response) => {
      try {
        const userId = req.body.userId || req.headers['x-user-id'];
        
        if (!userId) {
          return res.status(400).json({
            error: 'User ID required',
            code: 'MISSING_USER_ID'
          });
        }

        await authService.disableMfa(userId, req.body);
        res.json({ message: 'MFA disabled successfully' });
      } catch (error) {
        logger.error('MFA disable endpoint error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: req.body.userId,
          ip: req.ip
        });

        const message = error instanceof Error ? error.message : 'MFA disable failed';
        const statusCode = message.includes('Invalid') ? 401 : 500;
        
        res.status(statusCode).json({
          error: message,
          code: statusCode === 401 ? 'MFA_DISABLE_FAILED' : 'INTERNAL_ERROR'
        });
      }
    }
  );

  /**
   * GET /auth/health
   * Health check endpoint
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  return router;
}