import { OfficeFlowConsumer, MessageHandler, MessageContext } from './consumer';
import { OfficeFlowProducer, OfficeFlowMessage } from './producer';
import { KafkaClusterConfig } from './config';

export interface DLQMessage {
  originalTopic: string;
  originalMessage: OfficeFlowMessage;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  attemptCount: number;
  dlqTimestamp: Date;
}

export interface DLQProcessingOptions {
  maxReprocessAttempts?: number;
  reprocessDelayMs?: number;
  quarantineAfterAttempts?: number;
  enableManualReview?: boolean;
}

export class DLQHandler {
  private consumer: OfficeFlowConsumer;
  private producer: OfficeFlowProducer;
  private options: Required<DLQProcessingOptions>;

  constructor(
    private config: KafkaClusterConfig,
    options: DLQProcessingOptions = {}
  ) {
    this.options = {
      maxReprocessAttempts: 3,
      reprocessDelayMs: 60000, // 1 minute
      quarantineAfterAttempts: 5,
      enableManualReview: true,
      ...options,
    };

    this.consumer = new OfficeFlowConsumer(config, {
      groupId: 'dlq-handler',
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
      heartbeatInterval: 3000,
    });

    this.producer = new OfficeFlowProducer(config);

    // Register DLQ message handler
    this.consumer.registerHandler('dlq.message', this.handleDLQMessage.bind(this));
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.producer.connect();

    // Subscribe to all DLQ topics
    await this.consumer.subscribe({
      topics: ['dlq.employee.onboard', 'dlq.employee.exit', 'dlq.node.execute'],
      fromBeginning: false,
    });

    await this.consumer.run();
    console.log('DLQ Handler started');
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
    await this.producer.disconnect();
    console.log('DLQ Handler stopped');
  }

  private async handleDLQMessage(
    message: OfficeFlowMessage<DLQMessage>,
    context: MessageContext
  ): Promise<void> {
    const dlqData = message.payload;

    console.log('Processing DLQ message:', {
      originalTopic: dlqData.originalTopic,
      messageId: dlqData.originalMessage.id,
      correlationId: dlqData.originalMessage.metadata.correlationId,
      error: dlqData.error.message,
      attemptCount: dlqData.attemptCount,
    });

    // Check if message should be quarantined
    if (dlqData.attemptCount >= this.options.quarantineAfterAttempts) {
      await this.quarantineMessage(dlqData, context);
      return;
    }

    // Check if we should attempt reprocessing
    if (this.shouldReprocess(dlqData)) {
      await this.reprocessMessage(dlqData, context);
    } else if (this.options.enableManualReview) {
      await this.flagForManualReview(dlqData, context);
    } else {
      await this.quarantineMessage(dlqData, context);
    }
  }

  private shouldReprocess(dlqData: DLQMessage): boolean {
    // Reprocess if it's a transient error and within retry limits
    const transientErrors = [
      'NETWORK_EXCEPTION',
      'REQUEST_TIMED_OUT',
      'CONNECTION_ERROR',
      'ECONNRESET',
      'ENOTFOUND',
    ];

    const isTransientError = transientErrors.some(
      (errorType) =>
        dlqData.error.name.includes(errorType) || dlqData.error.message.includes(errorType)
    );

    return isTransientError && dlqData.attemptCount <= this.options.maxReprocessAttempts;
  }

  private async reprocessMessage(dlqData: DLQMessage, context: MessageContext): Promise<void> {
    try {
      // Wait before reprocessing
      await this.sleep(this.options.reprocessDelayMs);

      // Add retry headers
      const reprocessedMessage = {
        ...dlqData.originalMessage,
        metadata: {
          ...dlqData.originalMessage.metadata,
          source: 'dlq-reprocessor',
        },
      };

      // Send back to original topic for reprocessing
      await this.producer.sendMessage(
        dlqData.originalTopic,
        reprocessedMessage,
        undefined,
        dlqData.originalMessage.metadata.organizationId
      );

      console.log('Message reprocessed:', {
        messageId: dlqData.originalMessage.id,
        originalTopic: dlqData.originalTopic,
        attemptCount: dlqData.attemptCount,
      });
    } catch (error) {
      console.error('Failed to reprocess DLQ message:', error);
      await this.quarantineMessage(dlqData, context);
    }
  }

  private async flagForManualReview(dlqData: DLQMessage, context: MessageContext): Promise<void> {
    const reviewMessage = {
      type: 'manual.review.required',
      payload: {
        originalTopic: dlqData.originalTopic,
        originalMessage: dlqData.originalMessage,
        error: dlqData.error,
        attemptCount: dlqData.attemptCount,
        reviewReason: 'Non-transient error requiring manual intervention',
        flaggedAt: new Date(),
      },
      metadata: {
        source: 'dlq-handler',
        correlationId: dlqData.originalMessage.metadata.correlationId,
        organizationId: dlqData.originalMessage.metadata.organizationId,
      },
    };

    await this.producer.sendMessage('manual.review.queue', reviewMessage);

    console.log('Message flagged for manual review:', {
      messageId: dlqData.originalMessage.id,
      correlationId: dlqData.originalMessage.metadata.correlationId,
      error: dlqData.error.message,
    });
  }

  private async quarantineMessage(dlqData: DLQMessage, context: MessageContext): Promise<void> {
    const quarantineMessage = {
      type: 'quarantine.message',
      payload: {
        originalTopic: dlqData.originalTopic,
        originalMessage: dlqData.originalMessage,
        error: dlqData.error,
        attemptCount: dlqData.attemptCount,
        quarantineReason: 'Exceeded maximum retry attempts',
        quarantinedAt: new Date(),
      },
      metadata: {
        source: 'dlq-handler',
        correlationId: dlqData.originalMessage.metadata.correlationId,
        organizationId: dlqData.originalMessage.metadata.organizationId,
      },
    };

    await this.producer.sendMessage('quarantine.queue', quarantineMessage);

    console.log('Message quarantined:', {
      messageId: dlqData.originalMessage.id,
      correlationId: dlqData.originalMessage.metadata.correlationId,
      attemptCount: dlqData.attemptCount,
    });
  }

  /**
   * Manually reprocess a quarantined message
   */
  async manualReprocess(messageId: string, originalTopic: string): Promise<void> {
    // This would typically involve retrieving the message from a quarantine store
    // and reprocessing it. Implementation depends on quarantine storage mechanism.
    console.log(`Manual reprocess requested for message ${messageId} from topic ${originalTopic}`);
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStats(): Promise<{
    totalDLQMessages: number;
    messagesByTopic: Record<string, number>;
    messagesByError: Record<string, number>;
  }> {
    // This would typically query a metrics store or Kafka topic metadata
    // Implementation depends on monitoring infrastructure
    return {
      totalDLQMessages: 0,
      messagesByTopic: {},
      messagesByError: {},
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
