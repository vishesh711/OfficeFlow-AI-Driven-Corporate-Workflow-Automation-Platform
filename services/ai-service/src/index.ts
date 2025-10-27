import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createAppConfig } from '@officeflow/config';
import { createLogger } from './utils/logger';
import { createAIServiceConfig } from './config/ai-config';
import { LLMService } from './llm/llm-service';
import { AINodeExecutor } from './ai-node-executor';
import { ContentGenerator } from './content/content-generator';
import { NodeInput } from '@officeflow/types';

const SERVICE_NAME = 'ai-service';

async function createAIService(): Promise<Express> {
  // Load configuration
  const appConfig = createAppConfig(SERVICE_NAME);
  const aiConfig = createAIServiceConfig();

  // Create logger
  const logger = createLogger(appConfig.observability.logging);

  // Initialize services
  const llmService = new LLMService(aiConfig, logger);
  const aiNodeExecutor = new AINodeExecutor(llmService, logger);
  const contentGenerator = new ContentGenerator(llmService, logger);

  // Create Express app
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors(appConfig.server.cors));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const isHealthy = await llmService.validateConnection();

      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      });
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(503).json({
        status: 'unhealthy',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Node executor endpoint
  app.post('/execute', async (req, res) => {
    try {
      const input: NodeInput = req.body;

      if (!input || !input.nodeId || !input.organizationId) {
        return res.status(400).json({
          error: 'Invalid node input',
          message: 'Missing required fields: nodeId, organizationId',
        });
      }

      const result = await aiNodeExecutor.execute(input);

      res.json(result);
    } catch (error) {
      logger.error('Node execution failed', { error, body: req.body });

      res.status(500).json({
        error: 'Node execution failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Schema endpoint
  app.get('/schema', (req, res) => {
    try {
      const schema = aiNodeExecutor.getSchema();
      res.json(schema);
    } catch (error) {
      logger.error('Failed to get schema', { error });
      res.status(500).json({
        error: 'Failed to get schema',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Content generation endpoints
  app.post('/content/welcome-message', async (req, res) => {
    try {
      const { organizationId, employee, company, options } = req.body;

      if (!organizationId || !employee || !company) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'organizationId, employee, and company are required',
        });
      }

      const result = await contentGenerator.generateWelcomeMessage(
        organizationId,
        employee,
        company,
        options
      );

      res.json(result);
    } catch (error) {
      logger.error('Welcome message generation failed', { error, body: req.body });
      res.status(500).json({
        error: 'Welcome message generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.post('/content/role-specific', async (req, res) => {
    try {
      const { organizationId, employee, company, options } = req.body;

      if (!organizationId || !employee || !company) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'organizationId, employee, and company are required',
        });
      }

      const result = await contentGenerator.generateRoleSpecificContent(
        organizationId,
        employee,
        company,
        options
      );

      res.json(result);
    } catch (error) {
      logger.error('Role-specific content generation failed', { error, body: req.body });
      res.status(500).json({
        error: 'Role-specific content generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.post('/content/summarize', async (req, res) => {
    try {
      const { organizationId, document, options } = req.body;

      if (!organizationId || !document) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'organizationId and document are required',
        });
      }

      const result = await contentGenerator.summarizeDocument(
        organizationId,
        document,
        options
      );

      res.json(result);
    } catch (error) {
      logger.error('Document summarization failed', { error, body: req.body });
      res.status(500).json({
        error: 'Document summarization failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.post('/content/sentiment', async (req, res) => {
    try {
      const { organizationId, text, options } = req.body;

      if (!organizationId || !text) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'organizationId and text are required',
        });
      }

      const result = await contentGenerator.analyzeSentiment(
        organizationId,
        text,
        options
      );

      res.json(result);
    } catch (error) {
      logger.error('Sentiment analysis failed', { error, body: req.body });
      res.status(500).json({
        error: 'Sentiment analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.post('/content/custom', async (req, res) => {
    try {
      const { organizationId, prompt, data, options } = req.body;

      if (!organizationId || !prompt) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'organizationId and prompt are required',
        });
      }

      const result = await contentGenerator.generateCustomContent(
        organizationId,
        prompt,
        data || {},
        options || {}
      );

      res.json(result);
    } catch (error) {
      logger.error('Custom content generation failed', { error, body: req.body });
      res.status(500).json({
        error: 'Custom content generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Cost tracking endpoints
  app.get('/cost/:organizationId', async (req, res) => {
    try {
      const { organizationId } = req.params;
      const { startDate, endDate } = req.query;

      let timeRange;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        };
      }

      const costSummary = llmService.getCostSummary(organizationId, timeRange);
      res.json(costSummary);
    } catch (error) {
      logger.error('Failed to get cost summary', { error, params: req.params });
      res.status(500).json({
        error: 'Failed to get cost summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.get('/cost/export/:organizationId', async (req, res) => {
    try {
      const { organizationId } = req.params;
      const { format = 'json' } = req.query;

      const exportData = llmService.getCostTracker().exportMetrics(
        organizationId,
        format as 'json' | 'csv'
      );

      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      const filename = `ai-costs-${organizationId}-${new Date().toISOString().split('T')[0]}.${format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);
    } catch (error) {
      logger.error('Failed to export cost data', { error, params: req.params });
      res.status(500).json({
        error: 'Failed to export cost data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Template management endpoints
  app.get('/templates', (req, res) => {
    try {
      const { category } = req.query;
      const templates = llmService.getTemplateManager().listTemplates(category as string);
      res.json(templates);
    } catch (error) {
      logger.error('Failed to list templates', { error });
      res.status(500).json({
        error: 'Failed to list templates',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.get('/templates/:templateId', (req, res) => {
    try {
      const { templateId } = req.params;
      const template = llmService.getTemplateManager().getTemplate(templateId);

      if (!template) {
        return res.status(404).json({
          error: 'Template not found',
          message: `Template with ID ${templateId} not found`,
        });
      }

      res.json(template);
    } catch (error) {
      logger.error('Failed to get template', { error, params: req.params });
      res.status(500).json({
        error: 'Failed to get template',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Error handling middleware
  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error', { error, url: req.url, method: req.method });

    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: `Route ${req.method} ${req.url} not found`,
    });
  });

  return { app, logger, appConfig };
}

// Start server if this file is run directly
if (require.main === module) {
  createAIService()
    .then(({ app, logger, appConfig }) => {
      const server = app.listen(appConfig.server.port, appConfig.server.host, () => {
        logger.info(`AI Service started`, {
          port: appConfig.server.port,
          host: appConfig.server.host,
          nodeEnv: appConfig.nodeEnv,
        });
      });

      // Graceful shutdown
      process.on('SIGTERM', () => {
        logger.info('SIGTERM received, shutting down gracefully');
        server.close(() => {
          logger.info('AI Service stopped');
          process.exit(0);
        });
      });

      process.on('SIGINT', () => {
        logger.info('SIGINT received, shutting down gracefully');
        server.close(() => {
          logger.info('AI Service stopped');
          process.exit(0);
        });
      });
    })
    .catch((error) => {
      console.error('Failed to start AI Service:', error);
      process.exit(1);
    });
}

export { createAIService };