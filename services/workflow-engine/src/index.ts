/**
 * Workflow Engine Service Entry Point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import {
  WorkflowRepositoryImpl,
  WorkflowRunRepositoryImpl,
  EmployeeRepositoryImpl,
  db,
} from '@officeflow/database';
import {
  initializeObservability,
  commonHealthChecks,
  errorHandlingMiddleware,
} from '@officeflow/observability';
import { WorkflowEngineService } from './services/workflow-engine-service';
import { createWorkflowEngineRoutes } from './api/routes';
import { config } from './config/config';

async function startWorkflowEngine() {
  // Initialize observability
  const { logger, healthService, middleware } = initializeObservability({
    serviceName: 'workflow-engine',
    serviceVersion: '1.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
  });

  logger.info('Starting OfficeFlow Workflow Engine...');

  try {
    // Initialize database connection
    await db.connect();
    logger.info('Database connection established');

    // Initialize repositories
    const workflowRepo = new WorkflowRepositoryImpl();
    const workflowRunRepo = new WorkflowRunRepositoryImpl();
    const employeeRepo = new EmployeeRepositoryImpl();

    // Add health checks
    healthService.addCheck(
      commonHealthChecks.database(async () => {
        try {
          await db.query('SELECT 1');
          return true;
        } catch {
          return false;
        }
      })
    );

    healthService.addCheck(commonHealthChecks.memory(500)); // 500MB threshold

    // Initialize workflow engine service
    const engineService = new WorkflowEngineService(
      config,
      workflowRepo,
      workflowRunRepo,
      employeeRepo
    );

    // Start the engine service
    await engineService.start();
    logger.info('Workflow engine service started');

    // Create Express app
    const app = express();
    const port = process.env.PORT || 3001;

    // Middleware
    app.use(helmet());
    app.use(
      cors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    );
    app.use(compression());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Observability middleware
    app.use(...middleware);

    // Health check endpoints
    app.get('/health', healthService.healthHandler());
    app.get('/health/live', healthService.livenessHandler());
    app.get('/health/ready', healthService.readinessHandler());

    // API routes
    app.use('/api', createWorkflowEngineRoutes(engineService));

    // Root endpoint
    app.get('/', (req, res) => {
      res.json({
        service: 'OfficeFlow Workflow Engine',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
      });
    });

    // Error handling middleware
    app.use(errorHandlingMiddleware(logger));

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });

    // Start HTTP server
    const server = app.listen(port, () => {
      logger.info('Workflow Engine HTTP server started', {
        port,
        healthEndpoints: {
          health: `http://localhost:${port}/health`,
          liveness: `http://localhost:${port}/health/live`,
          readiness: `http://localhost:${port}/health/ready`,
        },
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      server.close(async () => {
        try {
          await engineService.stop();
          await db.disconnect();
          logger.info('Workflow Engine shut down successfully');
          process.exit(0);
        } catch (error) {
          logger.error(
            'Error during shutdown',
            error instanceof Error ? error : new Error(String(error))
          );
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Force shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal('Uncaught exception', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal(
        'Unhandled rejection',
        reason instanceof Error ? reason : new Error(String(reason)),
        {
          promise: String(promise),
        }
      );
      shutdown('unhandledRejection');
    });

    logger.info('OfficeFlow Workflow Engine started successfully');
  } catch (error) {
    logger.fatal(
      'Failed to start Workflow Engine',
      error instanceof Error ? error : new Error(String(error))
    );
    process.exit(1);
  }
}

// Start the service
if (require.main === module) {
  startWorkflowEngine();
}

export { startWorkflowEngine };
