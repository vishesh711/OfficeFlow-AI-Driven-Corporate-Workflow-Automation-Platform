import * as cron from 'node-cron';
import { OfficeFlowProducer } from '@officeflow/kafka';
import { BaseHRMSAdapter } from '../adapters/base-hrms-adapter';
import { WorkdayAdapter } from '../adapters/workday-adapter';
import { SuccessFactorsAdapter } from '../adapters/successfactors-adapter';
import { BambooHRAdapter } from '../adapters/bamboohr-adapter';
import { PollingConfig, NormalizedLifecycleEvent } from '../types/webhook-types';
import { webhookConfig } from '../config/webhook-config';
import { logger } from '../utils/logger';

export class AdapterManager {
  private adapters: Map<string, BaseHRMSAdapter> = new Map();
  private pollingJobs: Map<string, cron.ScheduledTask> = new Map();
  private kafkaProducer: OfficeFlowProducer;

  constructor(kafkaProducer: OfficeFlowProducer) {
    this.kafkaProducer = kafkaProducer;
  }

  /**
   * Initialize adapters based on configuration
   */
  async initialize(): Promise<void> {
    logger.info('Initializing HRMS adapters');

    // Initialize Workday adapter if configured
    if (webhookConfig.hrmsConfigs.workday.tenantUrl) {
      await this.createWorkdayAdapter();
    }

    // Initialize SuccessFactors adapter if configured
    if (webhookConfig.hrmsConfigs.successfactors.apiUrl) {
      await this.createSuccessFactorsAdapter();
    }

    // Initialize BambooHR adapter if configured
    if (webhookConfig.hrmsConfigs.bamboohr.subdomain) {
      await this.createBambooHRAdapter();
    }

    logger.info('HRMS adapters initialized', {
      adapterCount: this.adapters.size,
      adapters: Array.from(this.adapters.keys()),
    });
  }

  /**
   * Create and register Workday adapter
   */
  private async createWorkdayAdapter(): Promise<void> {
    try {
      const config: PollingConfig = {
        source: 'workday',
        organizationId: 'default', // This should come from organization configuration
        isEnabled: true,
        intervalMs: webhookConfig.hrmsConfigs.workday.pollIntervalMs,
        credentials: {
          tenantUrl: webhookConfig.hrmsConfigs.workday.tenantUrl,
          username: webhookConfig.hrmsConfigs.workday.username,
          password: webhookConfig.hrmsConfigs.workday.password,
        },
      };

      const adapter = new WorkdayAdapter(config);

      // Test connection
      const healthCheck = await adapter.healthCheck();
      if (!healthCheck.healthy) {
        logger.warn('Workday adapter health check failed', healthCheck.details);
      }

      this.registerAdapter('workday', adapter);
      this.startPolling('workday');

      logger.info('Workday adapter created and polling started');
    } catch (error) {
      logger.error('Failed to create Workday adapter', { error });
    }
  }

  /**
   * Create and register SuccessFactors adapter
   */
  private async createSuccessFactorsAdapter(): Promise<void> {
    try {
      const config: PollingConfig = {
        source: 'successfactors',
        organizationId: 'default', // This should come from organization configuration
        isEnabled: true,
        intervalMs: webhookConfig.hrmsConfigs.successfactors.pollIntervalMs,
        credentials: {
          apiUrl: webhookConfig.hrmsConfigs.successfactors.apiUrl,
          companyId: webhookConfig.hrmsConfigs.successfactors.companyId,
          username: webhookConfig.hrmsConfigs.successfactors.username,
          password: webhookConfig.hrmsConfigs.successfactors.password,
        },
      };

      const adapter = new SuccessFactorsAdapter(config);

      // Test connection
      const healthCheck = await adapter.healthCheck();
      if (!healthCheck.healthy) {
        logger.warn('SuccessFactors adapter health check failed', healthCheck.details);
      }

      this.registerAdapter('successfactors', adapter);
      this.startPolling('successfactors');

      logger.info('SuccessFactors adapter created and polling started');
    } catch (error) {
      logger.error('Failed to create SuccessFactors adapter', { error });
    }
  }

  /**
   * Create and register BambooHR adapter
   */
  private async createBambooHRAdapter(): Promise<void> {
    try {
      const config: PollingConfig = {
        source: 'bamboohr',
        organizationId: 'default', // This should come from organization configuration
        isEnabled: true,
        intervalMs: webhookConfig.hrmsConfigs.bamboohr.pollIntervalMs,
        credentials: {
          subdomain: webhookConfig.hrmsConfigs.bamboohr.subdomain,
          apiKey: webhookConfig.hrmsConfigs.bamboohr.apiKey,
        },
      };

      const adapter = new BambooHRAdapter(config);

      // Test connection
      const healthCheck = await adapter.healthCheck();
      if (!healthCheck.healthy) {
        logger.warn('BambooHR adapter health check failed', healthCheck.details);
      }

      this.registerAdapter('bamboohr', adapter);
      this.startPolling('bamboohr');

      logger.info('BambooHR adapter created and polling started');
    } catch (error) {
      logger.error('Failed to create BambooHR adapter', { error });
    }
  }

  /**
   * Register an adapter
   */
  registerAdapter(source: string, adapter: BaseHRMSAdapter): void {
    this.adapters.set(source, adapter);
    logger.info('HRMS adapter registered', { source });
  }

  /**
   * Unregister an adapter
   */
  unregisterAdapter(source: string): void {
    this.stopPolling(source);
    this.adapters.delete(source);
    logger.info('HRMS adapter unregistered', { source });
  }

  /**
   * Get adapter by source
   */
  getAdapter(source: string): BaseHRMSAdapter | undefined {
    return this.adapters.get(source);
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): BaseHRMSAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Start polling for a specific adapter
   */
  startPolling(source: string): void {
    const adapter = this.adapters.get(source);
    if (!adapter) {
      logger.warn('Cannot start polling: adapter not found', { source });
      return;
    }

    // Stop existing polling job if any
    this.stopPolling(source);

    const config = adapter.getConfig();
    const intervalMinutes = Math.max(1, Math.floor(config.intervalMs / 60000)); // Convert to minutes, minimum 1 minute

    // Create cron expression for polling interval
    const cronExpression = `*/${intervalMinutes} * * * *`; // Every N minutes

    const job = cron.schedule(
      cronExpression,
      async () => {
        await this.pollAdapter(source);
      },
      {
        scheduled: false, // Don't start immediately
      }
    );

    this.pollingJobs.set(source, job);
    job.start();

    logger.info('Polling started for adapter', {
      source,
      intervalMinutes,
      cronExpression,
    });
  }

  /**
   * Stop polling for a specific adapter
   */
  stopPolling(source: string): void {
    const job = this.pollingJobs.get(source);
    if (job) {
      job.stop();
      job.destroy();
      this.pollingJobs.delete(source);
      logger.info('Polling stopped for adapter', { source });
    }
  }

  /**
   * Poll a specific adapter for events
   */
  private async pollAdapter(source: string): Promise<void> {
    const adapter = this.adapters.get(source);
    if (!adapter) {
      logger.warn('Cannot poll: adapter not found', { source });
      return;
    }

    try {
      logger.debug('Starting poll for adapter', { source });

      const events = await adapter.poll();

      if (events.length > 0) {
        await this.publishEvents(events);

        logger.info('Polling completed successfully', {
          source,
          eventsFound: events.length,
        });
      } else {
        logger.debug('No new events found during polling', { source });
      }
    } catch (error) {
      logger.error('Polling failed for adapter', { source, error });
    }
  }

  /**
   * Publish events to Kafka
   */
  private async publishEvents(events: NormalizedLifecycleEvent[]): Promise<void> {
    for (const event of events) {
      try {
        const topic = `${event.type}.${event.organizationId}`;
        const key = event.employeeId;

        await this.kafkaProducer.send({
          topic,
          messages: [
            {
              key,
              value: JSON.stringify(event),
              headers: {
                'correlation-id': event.correlationId,
                'event-type': event.type,
                source: event.source,
                'organization-id': event.organizationId,
                'employee-id': event.employeeId,
              },
            },
          ],
        });

        logger.debug('Event published to Kafka', {
          topic,
          eventType: event.type,
          organizationId: event.organizationId,
          employeeId: event.employeeId,
          correlationId: event.correlationId,
        });
      } catch (error) {
        logger.error('Failed to publish event to Kafka', { event, error });
      }
    }
  }

  /**
   * Get health status of all adapters
   */
  async getHealthStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};

    for (const [source, adapter] of this.adapters) {
      try {
        const health = await adapter.healthCheck();
        status[source] = {
          ...health,
          polling: this.pollingJobs.has(source),
        };
      } catch (error) {
        status[source] = {
          healthy: false,
          polling: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return status;
  }

  /**
   * Manually trigger polling for all adapters
   */
  async pollAll(): Promise<void> {
    logger.info('Manually triggering poll for all adapters');

    const promises = Array.from(this.adapters.keys()).map((source) => this.pollAdapter(source));

    await Promise.allSettled(promises);

    logger.info('Manual polling completed for all adapters');
  }

  /**
   * Manually trigger polling for a specific adapter
   */
  async pollOne(source: string): Promise<void> {
    logger.info('Manually triggering poll for adapter', { source });
    await this.pollAdapter(source);
    logger.info('Manual polling completed for adapter', { source });
  }

  /**
   * Shutdown all adapters and stop polling
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down adapter manager');

    // Stop all polling jobs
    for (const source of this.pollingJobs.keys()) {
      this.stopPolling(source);
    }

    // Clear adapters
    this.adapters.clear();

    logger.info('Adapter manager shutdown completed');
  }
}
