import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import calendarRoutes from './api/calendar-routes';
import { getCalendarConfig } from './config/calendar-config';
import { logger } from './utils/logger';

const app = express();
const config = getCalendarConfig();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/calendar', calendarRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'calendar-service',
    timestamp: new Date().toISOString(),
    providers: config.providers.map(p => ({
      name: p.name,
      type: p.type,
      isDefault: p.isDefault,
    })),
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
  logger.info(`Calendar service started on port ${config.port}`, {
    port: config.port,
    environment: process.env.NODE_ENV || 'development',
    providers: config.providers.map(p => p.name),
    defaultTimezone: config.defaultTimezone,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Calendar service stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Calendar service stopped');
    process.exit(0);
  });
});

export default app;