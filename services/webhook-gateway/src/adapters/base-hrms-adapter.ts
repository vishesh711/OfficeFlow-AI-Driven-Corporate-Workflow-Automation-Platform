import {
  HRMSAdapter,
  WebhookPayload,
  NormalizedLifecycleEvent,
  PollingConfig,
} from '../types/webhook-types';
import { EventTransformer } from '../services/event-transformer';
import { SignatureVerifier } from '../utils/signature-verifier';
import { logger } from '../utils/logger';

export abstract class BaseHRMSAdapter implements HRMSAdapter {
  protected config: PollingConfig;

  constructor(config: PollingConfig) {
    this.config = config;
  }

  abstract get source(): string;

  /**
   * Poll for new events from HRMS system
   */
  abstract poll(): Promise<NormalizedLifecycleEvent[]>;

  /**
   * Process webhook payload from HRMS system
   */
  async processWebhook(payload: WebhookPayload): Promise<NormalizedLifecycleEvent[]> {
    try {
      // Validate signature if secret is provided
      if (payload.signature && this.config.credentials.webhookSecret) {
        const isValid = this.validateSignature(
          JSON.stringify(payload.data),
          payload.signature,
          this.config.credentials.webhookSecret
        );

        if (!isValid) {
          logger.warn('Invalid webhook signature', {
            source: this.source,
            organizationId: payload.organizationId,
          });
          throw new Error('Invalid webhook signature');
        }
      }

      // Transform to normalized events
      const events = await EventTransformer.transformToLifecycleEvent(payload);

      logger.info('Webhook processed by HRMS adapter', {
        source: this.source,
        organizationId: payload.organizationId,
        eventsGenerated: events.length,
      });

      return events;
    } catch (error) {
      logger.error('Error processing webhook in HRMS adapter', {
        source: this.source,
        organizationId: payload.organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Validate webhook signature
   */
  validateSignature(payload: string, signature: string, secret: string): boolean {
    return SignatureVerifier.verifySignature(payload, signature, secret, this.source);
  }

  /**
   * Update last polled timestamp
   */
  protected updateLastPolledAt(): void {
    this.config.lastPolledAt = new Date();
  }

  /**
   * Check if polling is enabled and due
   */
  protected shouldPoll(): boolean {
    if (!this.config.isEnabled) {
      return false;
    }

    if (!this.config.lastPolledAt) {
      return true;
    }

    const timeSinceLastPoll = Date.now() - this.config.lastPolledAt.getTime();
    return timeSinceLastPoll >= this.config.intervalMs;
  }

  /**
   * Get configuration
   */
  getConfig(): PollingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PollingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Health check for the adapter
   */
  abstract healthCheck(): Promise<{ healthy: boolean; details: Record<string, any> }>;
}
