import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import documentRoutes from './api/document-routes';
import { DocumentService } from './services/document-service';
import { getDocumentConfig } from './config/document-config';
import { logger } from './utils/logger';

const app = express();
const config = getDocumentConfig();
const documentService = new DocumentService();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize document service
documentService.initialize().catch((error) => {
  logger.error('Failed to initialize document service', { error: error.message });
  process.exit(1);
});

// Routes
app.use('/api/documents', documentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'document-service',
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

const server = app.listen(config.port, () => {
  logger.info(`Document service started on port ${config.port}`, {
    port: config.port,
    environment: process.env.NODE_ENV || 'development',
    storageProvider: config.storageProvider,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Document service stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Document service stopped');
    process.exit(0);
  });
});

export default app;
