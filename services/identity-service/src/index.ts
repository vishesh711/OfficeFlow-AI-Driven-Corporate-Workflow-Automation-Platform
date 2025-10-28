/**
 * Identity Service main entry point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Pool } from 'pg';
import winston from 'winston';
// Note: Kafka imports will be added when the kafka package is available
// import { Consumer, Producer } from '@officeflow/kafka';
import { loadConfig } from './config/config';
import { CredentialManager } from './credentials/credential-manager';
import { DatabaseCredentialStorage } from './credentials/database-storage';
import { ProviderFactory } from './providers/provider-factory';
import { TokenRefreshService } from './oauth2/token-refresh-service';
import { IdentityNodeExecutor } from './identity-node-executor';
import { AuditLogger } from './audit/audit-logger';
import { CentralAuditIntegration } from './audit/central-audit-integration';
import { RoleBasedProvisioningService } from './provisioning/role-based-provisioning';
import { DeprovisioningService } from './provisioning/deprovisioning-service';

class IdentityService {
  private app!: express.Application;
  private db!: Pool;
  private logger!: winston.Logger;
  // private consumer!: Consumer;
  // private producer!: Producer;
  private credentialManager!: CredentialManager;
  private providerFactory!: ProviderFactory;
  private tokenRefreshService!: TokenRefreshService;
  private nodeExecutor!: IdentityNodeExecutor;
  private auditLogger!: AuditLogger;
  private centralAudit!: CentralAuditIntegration;
  private roleBasedProvisioning!: RoleBasedProvisioningService;
  private deprovisioningService!: DeprovisioningService;
  private config = loadConfig();

  constructor() {
    this.setupLogger();
    this.setupDatabase();
    this.setupKafka();
    this.setupServices();
    this.setupExpress();
    this.setupRoutes();
  }

  private setupLogger(): void {
    this.logger = winston.createLogger({
      level: this.config.logging.level,
      format:
        this.config.logging.format === 'json'
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
          filename: 'logs/identity-service.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        }),
      ],
    });
  }

  private setupDatabase(): void {
    this.db = new Pool({
      host: this.config.database.host,
      port: this.config.database.port,
      database: this.config.database.database,
      user: this.config.database.username,
      password: this.config.database.password,
      ssl: this.config.database.ssl,
      max: this.config.database.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.db.on('error', (err) => {
      this.logger.error('Database connection error', { error: err.message });
    });
  }

  private setupKafka(): void {
    // TODO: Initialize Kafka when the package is available
    // this.consumer = new Consumer({
    //   brokers: this.config.kafka.brokers,
    //   groupId: this.config.kafka.groupId,
    //   clientId: this.config.kafka.clientId
    // });
    // this.producer = new Producer({
    //   brokers: this.config.kafka.brokers,
    //   clientId: this.config.kafka.clientId
    // });
  }

  private setupServices(): void {
    // Credential management
    const credentialStorage = new DatabaseCredentialStorage(this.db, this.logger);
    this.credentialManager = new CredentialManager(
      credentialStorage,
      this.config.encryption.key,
      this.logger
    );

    // Provider factory
    this.providerFactory = new ProviderFactory(this.logger);
    this.config.providers.forEach((config, provider) => {
      this.providerFactory.registerProvider(provider, config);
    });

    // Token refresh service
    this.tokenRefreshService = new TokenRefreshService(
      this.credentialManager,
      this.config.providers,
      this.logger
    );

    // Audit services
    this.auditLogger = new AuditLogger(this.db, this.logger);
    // TODO: Initialize central audit when Kafka producer is available
    // this.centralAudit = new CentralAuditIntegration(this.producer, this.logger);
    this.centralAudit = new CentralAuditIntegration(null as any, this.logger);

    // Provisioning services
    this.roleBasedProvisioning = new RoleBasedProvisioningService(this.logger);
    this.deprovisioningService = new DeprovisioningService(this.logger);

    // Node executor
    this.nodeExecutor = new IdentityNodeExecutor(
      this.credentialManager,
      this.providerFactory,
      this.auditLogger,
      this.centralAudit,
      this.logger
    );
  }

  private setupExpress(): void {
    this.app = express();

    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
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
        ip: req.ip,
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'identity-service',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // Node execution endpoint
    this.app.post('/execute', async (req, res) => {
      try {
        const result = await this.nodeExecutor.execute(req.body);
        res.json(result);
      } catch (error) {
        this.logger.error('Node execution failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          body: req.body,
        });

        res.status(500).json({
          status: 'failed',
          output: {},
          error: {
            code: 'EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          metadata: {
            executionTimeMs: 0,
            attempt: 1,
          },
        });
      }
    });

    // Node schema endpoint
    this.app.get('/schema', (req, res) => {
      res.json(this.nodeExecutor.getSchema());
    });

    // Audit endpoints
    this.app.get('/audit/:organizationId', async (req, res) => {
      try {
        const { organizationId } = req.params;
        const filters = {
          employeeId: req.query.employeeId as string,
          action: req.query.action as any,
          startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
          endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        };
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;

        const result = await this.auditLogger.getAuditTrail(organizationId, filters, limit, offset);

        res.json(result);
      } catch (error) {
        this.logger.error('Failed to retrieve audit trail', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).json({ error: 'Failed to retrieve audit trail' });
      }
    });

    // Compliance report endpoint
    this.app.post('/compliance-report', async (req, res) => {
      try {
        const { organizationId, reportType, startDate, endDate, generatedBy } = req.body;

        const report = await this.auditLogger.generateComplianceReport(
          organizationId,
          reportType,
          new Date(startDate),
          new Date(endDate),
          generatedBy
        );

        res.json(report);
      } catch (error) {
        this.logger.error('Failed to generate compliance report', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).json({ error: 'Failed to generate compliance report' });
      }
    });

    // Error handling
    this.app.use(
      (error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        this.logger.error('Unhandled error', {
          error: error.message,
          stack: error.stack,
          url: _req.url,
          method: _req.method,
        });

        res.status(500).json({
          error: 'Internal server error',
          message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        });
      }
    );
  }

  private async setupKafkaConsumers(): Promise<void> {
    // TODO: Implement Kafka consumers when the package is available
    // Subscribe to node execution requests
    // await this.consumer.subscribe(['node.execute.request']);
    // await this.consumer.run({
    //   eachMessage: async ({ topic, partition, message }: { topic: string; partition: number; message: any }) => {
    //     try {
    //       const nodeInput = JSON.parse(message.value?.toString() || '{}');
    //       // Filter for identity node types
    //       if (nodeInput.nodeType === 'identity') {
    //         const result = await this.nodeExecutor.execute(nodeInput);
    //         // Publish result back to Kafka
    //         await this.producer.publish('node.execute.result', {
    //           nodeId: nodeInput.nodeId,
    //           runId: nodeInput.runId,
    //           result
    //         });
    //       }
    //     } catch (error) {
    //       this.logger.error('Failed to process Kafka message', {
    //         topic,
    //         partition,
    //         error: error instanceof Error ? error.message : 'Unknown error'
    //       });
    //     }
    //   }
    // });
  }

  async start(): Promise<void> {
    try {
      // Test database connection
      await this.db.query('SELECT 1');
      this.logger.info('Database connection established');

      // TODO: Connect to Kafka when available
      // await this.consumer.connect();
      // await this.producer.connect();
      // this.logger.info('Kafka connection established');

      // Setup Kafka consumers
      await this.setupKafkaConsumers();

      // Start token refresh service
      this.tokenRefreshService.start();

      // Start HTTP server
      const server = this.app.listen(this.config.port, () => {
        this.logger.info('Identity Service started', {
          port: this.config.port,
          providers: Array.from(this.config.providers.keys()),
          auditEnabled: this.config.audit.enableCentralAudit,
        });
      });

      // Graceful shutdown
      process.on('SIGTERM', async () => {
        this.logger.info('Received SIGTERM, shutting down gracefully');

        server.close(() => {
          this.tokenRefreshService.stop();
          // this.consumer.disconnect();
          // this.producer.disconnect();
          this.db.end();
          process.exit(0);
        });
      });
    } catch (error) {
      this.logger.error('Failed to start Identity Service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }
  }
}

// Start the service
if (require.main === module) {
  const service = new IdentityService();
  service.start().catch((error) => {
    console.error('Failed to start service:', error);
    process.exit(1);
  });
}

export default IdentityService;
