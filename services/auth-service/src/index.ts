/**
 * Auth Service main entry point
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { winston, MockLogger } from './utils/mock-dependencies';

import { AuthService } from './services/auth-service';
import { RbacService } from './services/rbac-service';
import { createAuthRoutes } from './api/auth-routes';
import { createRbacRoutes } from './api/rbac-routes';
import { createAuthMiddleware } from './middleware/auth-middleware';
import { authConfig } from './config/auth-config';

class AuthServiceApp {
  private app!: express.Application;
  private db!: Pool;
  private redis!: Redis;
  private logger!: MockLogger;
  private authService!: AuthService;
  private rbacService!: RbacService;
  private authMiddleware!: any;

  constructor() {
    this.setupLogger();
    this.setupDatabase();
    this.setupRedis();
    this.setupServices();
    this.setupExpress();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupLogger(): void {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT === 'json' 
        ? winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        : winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.simple()
          ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/auth-service.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ]
    });
  }

  private setupDatabase(): void {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.db = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.db.on('error', (err) => {
      this.logger.error('Database connection error', { error: err.message });
    });
  }

  private setupRedis(): void {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.redis = new Redis(redisUrl, {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error', { error: err.message });
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
    });
  }

  private setupServices(): void {
    this.authService = new AuthService(this.db, this.redis, this.logger);
    this.rbacService = new RbacService(this.db, this.logger);
    this.authMiddleware = createAuthMiddleware(this.db, this.redis, this.logger);
  }

  private setupExpress(): void {
    this.app = express();

    // Trust proxy if configured
    if (process.env.TRUST_PROXY === 'true') {
      this.app.set('trust proxy', true);
    }

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-User-ID']
    }));

    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug('HTTP request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next();
    });

    // Request ID middleware
    this.app.use((req, res, next) => {
      const requestId = req.get('X-Request-ID') || `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      req.headers['x-request-id'] = requestId;
      res.set('X-Request-ID', requestId);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check (before auth routes for load balancer)
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // Auth routes
    this.app.use('/auth', createAuthRoutes(this.authService, this.logger));
    
    // RBAC routes
    this.app.use('/rbac', createRbacRoutes(this.rbacService, this.authMiddleware, this.logger));

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not found',
        code: 'NOT_FOUND',
        path: req.originalUrl
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const requestId = req.headers['x-request-id'] as string;
      
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        requestId
      });

      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        requestId,
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, _promise) => {
      this.logger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });
  }

  private async setupPeriodicTasks(): Promise<void> {
    // Clean up expired sessions and tokens every 5 minutes
    setInterval(async () => {
      try {
        await this.db.query('SELECT cleanup_expired_auth_data()');
        this.logger.debug('Periodic cleanup completed');
      } catch (error) {
        this.logger.error('Periodic cleanup failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async start(): Promise<void> {
    try {
      // Test database connection
      await this.db.query('SELECT 1');
      this.logger.info('Database connection established');

      // Test Redis connection
      await this.redis.ping();
      this.logger.info('Redis connection established');

      // Setup periodic tasks
      await this.setupPeriodicTasks();

      // Start HTTP server
      const port = parseInt(process.env.PORT || '3001');
      const server = this.app.listen(port, () => {
        this.logger.info('Auth Service started', {
          port,
          environment: process.env.NODE_ENV || 'development',
          jwtExpiresIn: authConfig.jwt.expiresIn,
          mfaEnabled: true,
          sessionTimeoutMinutes: authConfig.session.timeoutMinutes
        });
      });

      // Graceful shutdown
      const shutdown = async (signal: string) => {
        this.logger.info(`Received ${signal}, shutting down gracefully`);
        
        server.close(async () => {
          try {
            await this.db.end();
            await this.redis.quit();
            this.logger.info('Auth Service shut down successfully');
            process.exit(0);
          } catch (error) {
            this.logger.error('Error during shutdown', {
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            process.exit(1);
          }
        });

        // Force shutdown after 30 seconds
        setTimeout(() => {
          this.logger.error('Forced shutdown after timeout');
          process.exit(1);
        }, 30000);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
      this.logger.error('Failed to start Auth Service', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      process.exit(1);
    }
  }
}

// Start the service
if (require.main === module) {
  const service = new AuthServiceApp();
  service.start().catch(error => {
    console.error('Failed to start service:', error);
    process.exit(1);
  });
}

export default AuthServiceApp;