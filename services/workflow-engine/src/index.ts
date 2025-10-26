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
  db 
} from '@officeflow/database';
import { WorkflowEngineService } from './services/workflow-engine-service';
import { createWorkflowEngineRoutes } from './api/routes';
import { config } from './config/config';

async function startWorkflowEngine() {
  console.log('Starting OfficeFlow Workflow Engine...');

  try {
    // Initialize database connection
    await db.connect();
    console.log('Database connection established');

    // Initialize repositories
    const workflowRepo = new WorkflowRepositoryImpl();
    const workflowRunRepo = new WorkflowRunRepositoryImpl();
    const employeeRepo = new EmployeeRepositoryImpl();

    // Initialize workflow engine service
    const engineService = new WorkflowEngineService(
      config,
      workflowRepo,
      workflowRunRepo,
      employeeRepo
    );

    // Start the engine service
    await engineService.start();

    // Create Express app
    const app = express();
    const port = process.env.PORT || 3001;

    // Middleware
    app.use(helmet());
    app.use(cors());
    app.use(compression());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Request logging
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });

    // API routes
    app.use('/api/v1', createWorkflowEngineRoutes(engineService));

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
    app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });

    // Start HTTP server
    const server = app.listen(port, () => {
      console.log(`Workflow Engine HTTP server listening on port ${port}`);
      console.log(`Health check: http://localhost:${port}/api/v1/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      
      server.close(async () => {
        try {
          await engineService.stop();
          await db.disconnect();
          console.log('Workflow Engine shut down successfully');
          process.exit(0);
        } catch (error) {
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('Force shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

    console.log('OfficeFlow Workflow Engine started successfully');

  } catch (error) {
    console.error('Failed to start Workflow Engine:', error);
    process.exit(1);
  }
}

// Start the service
if (require.main === module) {
  startWorkflowEngine();
}

export { startWorkflowEngine };