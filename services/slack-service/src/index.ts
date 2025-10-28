import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import slackRoutes from './api/slack-routes';
import { getSlackConfig } from './config/slack-config';
import { logger } from './utils/logger';

const app = express();
const config = getSlackConfig();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/slack', slackRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'slack-service',
    timestamp: new Date().toISOString(),
    config: {
      port: config.port,
      rateLimiting: config.rateLimiting,
    },
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
  logger.info(`Slack service started on port ${config.port}`, {
    port: config.port,
    environment: process.env.NODE_ENV || 'development',
    rateLimiting: config.rateLimiting,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Slack service stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Slack service stopped');
    process.exit(0);
  });
});

export default app;
