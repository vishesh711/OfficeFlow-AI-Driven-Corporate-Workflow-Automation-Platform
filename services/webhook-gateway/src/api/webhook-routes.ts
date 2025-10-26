import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { WebhookService } from '../services/webhook-service';
import { WebhookPayload, WebhookConfig } from '../types/webhook-types';
import { webhookConfig } from '../config/webhook-config';
import { logger } from '../utils/logger';

export function createWebhookRoutes(webhookService: WebhookService): express.Router {
  const router = express.Router();

  // Rate limiting middleware
  const rateLimiter = rateLimit({
    windowMs: webhookConfig.rateLimitWindowMs,
    max: webhookConfig.rateLimitMaxRequests,
    message: {
      error: 'Too many webhook requests',
      retryAfter: Math.ceil(webhookConfig.rateLimitWindowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Rate limit by organization ID if available, otherwise by IP
      const orgId = req.body?.organizationId || req.headers['x-organization-id'];
      return orgId || req.ip;
    },
  });

  // Slow down middleware for additional DDoS protection
  const speedLimiter = slowDown({
    windowMs: webhookConfig.rateLimitWindowMs,
    delayAfter: Math.floor(webhookConfig.rateLimitMaxRequests * 0.5),
    delayMs: 500,
    maxDelayMs: 5000,
  });

  // Apply rate limiting to all webhook routes
  router.use(rateLimiter);
  router.use(speedLimiter);

  // Middleware to capture raw body for signature verification
  router.use('/webhook', express.raw({ type: 'application/json', limit: '10mb' }));

  /**
   * Generic webhook endpoint
   * POST /api/webhook/:source/:organizationId
   */
  router.post('/webhook/:source/:organizationId', async (req: Request, res: Response) => {
    const { source, organizationId } = req.params;
    const signature = req.headers['x-signature'] as string || 
                     req.headers['x-hub-signature'] as string ||
                     req.headers['x-webhook-signature'] as string;

    try {
      // Parse the raw body
      const rawBody = req.body.toString('utf8');
      let data: any;
      
      try {
        data = JSON.parse(rawBody);
      } catch (parseError) {
        logger.warn('Invalid JSON in webhook payload', { source, organizationId, parseError });
        return res.status(400).json({
          error: 'Invalid JSON payload',
          message: 'Webhook payload must be valid JSON',
        });
      }

      // Create webhook payload
      const webhookPayload: WebhookPayload = {
        source: source as any,
        eventType: data.eventType || data.event_type || data.type || 'unknown',
        timestamp: new Date(data.timestamp || data.created_at || Date.now()),
        organizationId,
        employeeId: data.employeeId || data.employee_id || data.userId || data.user_id,
        data,
        signature,
        headers: req.headers as Record<string, string>,
      };

      // Validate payload
      const validation = webhookService.validateWebhookPayload(webhookPayload);
      if (!validation.isValid) {
        logger.warn('Invalid webhook payload', { source, organizationId, errors: validation.errors });
        return res.status(400).json({
          error: 'Invalid webhook payload',
          details: validation.errors,
        });
      }

      // Process webhook
      const result = await webhookService.processWebhook(webhookPayload);

      if (result.success) {
        logger.info('Webhook processed successfully', {
          source,
          organizationId,
          eventsProcessed: result.events,
        });

        return res.status(200).json({
          success: true,
          message: 'Webhook processed successfully',
          eventsProcessed: result.events,
        });
      } else {
        logger.error('Webhook processing failed', {
          source,
          organizationId,
          errors: result.errors,
        });

        return res.status(422).json({
          success: false,
          message: 'Webhook processing failed',
          errors: result.errors,
          eventsProcessed: result.events,
        });
      }
    } catch (error) {
      logger.error('Webhook endpoint error', { source, organizationId, error });
      
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process webhook',
      });
    }
  });

  /**
   * Health check endpoint
   * GET /api/health
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await webhookService.healthCheck();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check error', { error });
      res.status(503).json({
        status: 'unhealthy',
        details: { error: 'Health check failed' },
      });
    }
  });

  /**
   * Register webhook configuration
   * POST /api/config/webhook
   */
  router.post('/config/webhook', express.json(), async (req: Request, res: Response) => {
    try {
      const config: WebhookConfig = req.body;

      // Validate required fields
      if (!config.organizationId || !config.source || !config.endpoint) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['organizationId', 'source', 'endpoint'],
        });
      }

      // Set defaults
      config.isActive = config.isActive !== false;
      config.retryPolicy = config.retryPolicy || {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      };

      webhookService.registerWebhookConfig(config);

      logger.info('Webhook configuration registered via API', {
        organizationId: config.organizationId,
        source: config.source,
      });

      res.status(201).json({
        success: true,
        message: 'Webhook configuration registered',
        config: {
          organizationId: config.organizationId,
          source: config.source,
          endpoint: config.endpoint,
          isActive: config.isActive,
        },
      });
    } catch (error) {
      logger.error('Error registering webhook configuration', { error });
      res.status(500).json({
        error: 'Failed to register webhook configuration',
      });
    }
  });

  /**
   * Get webhook configurations
   * GET /api/config/webhook
   */
  router.get('/config/webhook', (req: Request, res: Response) => {
    try {
      const configs = webhookService.getWebhookConfigs();
      
      // Remove sensitive information
      const sanitizedConfigs = configs.map(config => ({
        organizationId: config.organizationId,
        source: config.source,
        endpoint: config.endpoint,
        isActive: config.isActive,
        retryPolicy: config.retryPolicy,
        transformationRules: config.transformationRules,
      }));

      res.json({
        success: true,
        configs: sanitizedConfigs,
      });
    } catch (error) {
      logger.error('Error retrieving webhook configurations', { error });
      res.status(500).json({
        error: 'Failed to retrieve webhook configurations',
      });
    }
  });

  /**
   * Remove webhook configuration
   * DELETE /api/config/webhook/:organizationId/:source
   */
  router.delete('/config/webhook/:organizationId/:source', (req: Request, res: Response) => {
    try {
      const { organizationId, source } = req.params;
      
      webhookService.unregisterWebhookConfig(organizationId, source);

      logger.info('Webhook configuration removed via API', { organizationId, source });

      res.json({
        success: true,
        message: 'Webhook configuration removed',
      });
    } catch (error) {
      logger.error('Error removing webhook configuration', { error });
      res.status(500).json({
        error: 'Failed to remove webhook configuration',
      });
    }
  });

  /**
   * Test webhook endpoint (for development/testing)
   * POST /api/test/webhook
   */
  router.post('/test/webhook', express.json(), async (req: Request, res: Response) => {
    if (webhookConfig.nodeEnv === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    try {
      const { source, organizationId, eventType, employeeData } = req.body;

      const testPayload: WebhookPayload = {
        source: source || 'generic',
        eventType: eventType || 'employee.onboard',
        timestamp: new Date(),
        organizationId: organizationId || 'test-org',
        employeeId: employeeData?.id || 'test-employee',
        data: employeeData || {
          id: 'test-employee',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'Employee',
        },
        headers: req.headers as Record<string, string>,
      };

      const result = await webhookService.processWebhook(testPayload);

      res.json({
        success: result.success,
        message: 'Test webhook processed',
        result,
      });
    } catch (error) {
      logger.error('Test webhook error', { error });
      res.status(500).json({
        error: 'Test webhook failed',
      });
    }
  });

  return router;
}