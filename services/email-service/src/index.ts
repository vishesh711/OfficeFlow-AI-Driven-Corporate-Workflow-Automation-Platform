import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import emailRoutes from './api/email-routes';
import { getEmailConfig } from './config/email-config';
import { logger } from './utils/logger';
import fs from 'fs';
import path from 'path';

const app = express();
const config = getEmailConfig();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// Routes
app.use('/api/email', emailRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'email-service',
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
  logger.info(`Email service started on port ${config.port}`, {
    port: config.port,
    environment: process.env.NODE_ENV || 'development',
    providers: config.providers.map((p) => p.name),
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Email service stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Email service stopped');
    process.exit(0);
  });
});

export default app;
