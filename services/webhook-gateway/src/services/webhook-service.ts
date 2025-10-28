import { v4 as uuidv4 } from 'uuid';
import { OfficeFlowProducer } from '@officeflow/kafka';
import {
  WebhookPayload,
  NormalizedLifecycleEvent,
  WebhookConfig,
  WebhookDeliveryAttempt,
} from '../types/webhook-types';
import { EventTransformer } from './event-transformer';
import { SignatureVerifier } from '../utils/signature-verifier';
import { logger } from '../utils/logger';

export class WebhookService {
  private kafkaProducer: OfficeFlowProducer;
  private webhookConfigs: Map<string, WebhookConfig> = new Map();

  constructor(kafkaProducer: OfficeFlowProducer) {
    this.kafkaProducer = kafkaProducer;
  }

  /**
   * Process incoming webhook payload
   */
  async processWebhook(
    payload: WebhookPayload
  ): Promise<{ success: boolean; events: number; errors: string[] }> {
    const errors: string[] = [];
    let processedEvents = 0;

    try {
      // Get webhook configuration
      const config = this.getWebhookConfig(payload.organizationId, payload.source);

      // Verify signature if required
      if (config?.secretKey && payload.signature) {
        const isValidSignature = SignatureVerifier.verifySignature(
          JSON.stringify(payload.data),
          payload.signature,
          config.secretKey,
          payload.source
        );

        if (!isValidSignature) {
          const error = 'Invalid webhook signature';
          logger.warn(error, { organizationId: payload.organizationId, source: payload.source });
          errors.push(error);
          return { success: false, events: 0, errors };
        }
      }

      // Transform to normalized lifecycle events
      const lifecycleEvents = await EventTransformer.transformToLifecycleEvent(
        payload,
        config?.transformationRules
      );

      if (lifecycleEvents.length === 0) {
        const error = 'No valid lifecycle events generated from webhook payload';
        logger.warn(error, { payload });
        errors.push(error);
        return { success: false, events: 0, errors };
      }

      // Publish events to Kafka
      for (const event of lifecycleEvents) {
        try {
          await this.publishLifecycleEvent(event);
          processedEvents++;

          logger.info('Lifecycle event published', {
            eventType: event.type,
            organizationId: event.organizationId,
            employeeId: event.employeeId,
            correlationId: event.correlationId,
          });
        } catch (error) {
          const errorMsg = `Failed to publish event: ${error}`;
          logger.error(errorMsg, { event, error });
          errors.push(errorMsg);
        }
      }

      // Log webhook processing result
      await this.logWebhookDelivery({
        id: uuidv4(),
        webhookId: `${payload.organizationId}-${payload.source}`,
        organizationId: payload.organizationId,
        payload,
        attempt: 1,
        status: errors.length === 0 ? 'success' : 'failed',
        scheduledAt: new Date(),
        processedAt: new Date(),
      });

      return {
        success: errors.length === 0,
        events: processedEvents,
        errors,
      };
    } catch (error) {
      const errorMsg = `Webhook processing failed: ${error}`;
      logger.error(errorMsg, { payload, error });
      errors.push(errorMsg);

      return { success: false, events: processedEvents, errors };
    }
  }

  /**
   * Publish normalized lifecycle event to Kafka
   */
  private async publishLifecycleEvent(event: NormalizedLifecycleEvent): Promise<void> {
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
  }

  /**
   * Get webhook configuration for organization and source
   */
  private getWebhookConfig(organizationId: string, source: string): WebhookConfig | undefined {
    const key = `${organizationId}-${source}`;
    return this.webhookConfigs.get(key);
  }

  /**
   * Register webhook configuration
   */
  registerWebhookConfig(config: WebhookConfig): void {
    const key = `${config.organizationId}-${config.source}`;
    this.webhookConfigs.set(key, config);

    logger.info('Webhook configuration registered', {
      organizationId: config.organizationId,
      source: config.source,
      endpoint: config.endpoint,
    });
  }

  /**
   * Remove webhook configuration
   */
  unregisterWebhookConfig(organizationId: string, source: string): void {
    const key = `${organizationId}-${source}`;
    this.webhookConfigs.delete(key);

    logger.info('Webhook configuration removed', { organizationId, source });
  }

  /**
   * Get all registered webhook configurations
   */
  getWebhookConfigs(): WebhookConfig[] {
    return Array.from(this.webhookConfigs.values());
  }

  /**
   * Validate webhook payload structure
   */
  validateWebhookPayload(payload: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!payload.source) {
      errors.push('Missing required field: source');
    }

    if (!payload.eventType) {
      errors.push('Missing required field: eventType');
    }

    if (!payload.organizationId) {
      errors.push('Missing required field: organizationId');
    }

    if (!payload.data) {
      errors.push('Missing required field: data');
    }

    if (!payload.timestamp) {
      errors.push('Missing required field: timestamp');
    } else {
      const timestamp = new Date(payload.timestamp);
      if (isNaN(timestamp.getTime())) {
        errors.push('Invalid timestamp format');
      }
    }

    const validSources = ['workday', 'successfactors', 'bamboohr', 'generic'];
    if (payload.source && !validSources.includes(payload.source)) {
      errors.push(`Invalid source. Must be one of: ${validSources.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Log webhook delivery attempt
   */
  private async logWebhookDelivery(attempt: WebhookDeliveryAttempt): Promise<void> {
    // In a real implementation, this would save to database
    logger.info('Webhook delivery logged', {
      id: attempt.id,
      webhookId: attempt.webhookId,
      organizationId: attempt.organizationId,
      status: attempt.status,
      attempt: attempt.attempt,
      processedAt: attempt.processedAt,
    });
  }

  /**
   * Health check for webhook service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: Record<string, any> }> {
    try {
      // Check Kafka connection
      const kafkaHealthy = await this.kafkaProducer.isConnected();

      return {
        status: kafkaHealthy ? 'healthy' : 'unhealthy',
        details: {
          kafka: kafkaHealthy ? 'connected' : 'disconnected',
          registeredWebhooks: this.webhookConfigs.size,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('Health check failed', { error });
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
