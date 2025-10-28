import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { OfficeFlowProducer } from '@officeflow/kafka';
import { WebhookService } from './services/webhook-service';
import { AdapterManager } from './services/adapter-manager';
import { createWebhookRoutes } from './api/webhook-routes';
import { webhookConfig } from './config/webhook-config';
import { logger } from './utils/logger';

class WebhookGatewayServer {
  private app: express.Application;
  private kafkaProducer: OfficeFlowProducer;
  private webhookService: WebhookService;
  private adapterManager: AdapterManager;

  constructor() {
    this.app = express();
    this.kafkaProducer = new OfficeFlowProducer({
      clientId: webhookConfig.kafkaClientId,
      brokers: webhookConfig.kafkaBrokers.split(','),
    });
    this.webhookService = new WebhookService(this.kafkaProducer);
    this.adapterManager = new AdapterManager(this.kafkaProducer);
  }

  /**
   * Initialize the server
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Webhook Gateway server');

      // Initialize Kafka producer
      await this.kafkaProducer.connect();
      logger.info('Kafka producer connected');

      // Initialize HRMS adapters
      await this.adapterManager.initialize();
      logger.info('HRMS adapters initialized');

      // Setup Express middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      logger.info('Webhook Gateway server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Webhook Gateway server', { error });
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
      })
    );

    // CORS middleware
    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'x-signature',
          'x-hub-signature',
          'x-webhook-signature',
          'x-organization-id',
        ],
        credentials: true,
      })
    );

    // Request logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP request', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });
      });

      next();
    });

    // Health check endpoint (before other middleware)
    this.app.get('/health', async (req, res) => {
      try {
        const webhookHealth = await this.webhookService.healthCheck();
        const adapterHealth = await this.adapterManager.getHealthStatus();

        const overallHealth =
          webhookHealth.status === 'healthy' &&
          Object.values(adapterHealth).every((adapter: any) => adapter.healthy);

        res.status(overallHealth ? 200 : 503).json({
          status: overallHealth ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          webhook: webhookHealth,
          adapters: adapterHealth,
        });
      } catch (error) {
        logger.error('Health check failed', { error });
        res.status(503).json({
          status: 'unhealthy',
          error: 'Health check failed',
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // API routes
    this.app.use('/api', createWebhookRoutes(this.webhookService));

    // Admin routes for adapter management
    this.app.use('/api/admin', this.createAdminRoutes());

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'OfficeFlow Webhook Gateway',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
      });
    });
  }

  /**
   * Create admin routes for adapter management
   */
  private createAdminRoutes(): express.Router {
    const router = express.Router();

    // JSON middleware for admin routes
    router.use(express.json());

    // Get adapter health status
    router.get('/adapters/health', async (req, res) => {
      try {
        const health = await this.adapterManager.getHealthStatus();
        res.json({ success: true, adapters: health });
      } catch (error) {
        logger.error('Failed to get adapter health', { error });
        res.status(500).json({ error: 'Failed to get adapter health' });
      }
    });

    // Manually trigger polling for all adapters
    router.post('/adapters/poll', async (req, res) => {
      try {
        await this.adapterManager.pollAll();
        res.json({ success: true, message: 'Polling triggered for all adapters' });
      } catch (error) {
        logger.error('Failed to trigger polling', { error });
        res.status(500).json({ error: 'Failed to trigger polling' });
      }
    });

    // Manually trigger polling for specific adapter
    router.post('/adapters/:source/poll', async (req, res) => {
      try {
        const { source } = req.params;
        await this.adapterManager.pollOne(source);
        res.json({ success: true, message: `Polling triggered for ${source} adapter` });
      } catch (error) {
        logger.error('Failed to trigger adapter polling', { source: req.params.source, error });
        res.status(500).json({ error: 'Failed to trigger adapter polling' });
      }
    });

    // Get adapter configurations
    router.get('/adapters', (req, res) => {
      try {
        const adapters = this.adapterManager.getAllAdapters();
        const configs = adapters.map((adapter) => ({
          source: adapter.source,
          config: adapter.getConfig(),
        }));
        res.json({ success: true, adapters: configs });
      } catch (error) {
        logger.error('Failed to get adapter configurations', { error });
        res.status(500).json({ error: 'Failed to get adapter configurations' });
      }
    });

    return router;
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use(
      (error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        logger.error('Unhandled error', {
          error: error.message,
          stack: error.stack,
          url: req.url,
          method: req.method,
        });

        res.status(500).json({
          error: 'Internal Server Error',
          message: webhookConfig.nodeEnv === 'development' ? error.message : 'Something went wrong',
        });
      }
    );

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', { reason, promise });
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      await this.initialize();

      this.app.listen(webhookConfig.port, () => {
        logger.info('Webhook Gateway server started', {
          port: webhookConfig.port,
          nodeEnv: webhookConfig.nodeEnv,
        });
      });
    } catch (error) {
      logger.error('Failed to start Webhook Gateway server', { error });
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    logger.info('Shutting down Webhook Gateway server');

    try {
      // Stop HRMS adapters
      await this.adapterManager.shutdown();

      // Disconnect Kafka producer
      await this.kafkaProducer.disconnect();

      logger.info('Webhook Gateway server shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new WebhookGatewayServer();
  server.start();
}

export { WebhookGatewayServer };
