import { 
  Kafka, 
  Consumer, 
  EachMessagePayload, 
  ConsumerSubscribeTopics,
  ConsumerRunConfig,
  KafkaMessage
} from 'kafkajs';
import { KafkaClusterConfig, ConsumerGroupConfig, defaultConsumerConfig } from './config';
import { OfficeFlowMessage, OfficeFlowProducer } from './producer';

export interface MessageHandler<T = any> {
  (message: OfficeFlowMessage<T>, context: MessageContext): Promise<void>;
}

export interface MessageContext {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  headers: Record<string, string>;
  correlationId: string;
  attempt: number;
}

export interface ConsumerOptions {
  autoCommit?: boolean;
  autoCommitInterval?: number;
  autoCommitThreshold?: number;
  partitionsConsumedConcurrently?: number;
  eachBatchAutoResolve?: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export class OfficeFlowConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private producer: OfficeFlowProducer;
  private isConnected: boolean = false;
  private messageHandlers: Map<string, MessageHandler> = new Map();
  private retryConfig: RetryConfig;

  constructor(
    private config: KafkaClusterConfig,
    private consumerConfig: ConsumerGroupConfig,
    private options: ConsumerOptions = {},
    retryConfig?: Partial<RetryConfig>
  ) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      connectionTimeout: config.connectionTimeout,
      requestTimeout: config.requestTimeout,
      retry: config.retry,
      ssl: config.ssl,
      sasl: config.sasl,
    });

    this.consumer = this.kafka.consumer({
      ...defaultConsumerConfig,
      ...consumerConfig,
    });

    // Initialize producer for DLQ and retry handling
    this.producer = new OfficeFlowProducer(config);

    this.retryConfig = {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: ['NETWORK_EXCEPTION', 'REQUEST_TIMED_OUT'],
      ...retryConfig,
    };
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.consumer.connect();
      await this.producer.connect();
      this.isConnected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.consumer.disconnect();
      await this.producer.disconnect();
      this.isConnected = false;
    }
  }

  /**
   * Subscribe to topics with pattern matching
   */
  async subscribe(subscription: ConsumerSubscribeTopics): Promise<void> {
    await this.ensureConnected();
    await this.consumer.subscribe(subscription);
  }

  /**
   * Register a message handler for a specific message type
   */
  registerHandler<T>(messageType: string, handler: MessageHandler<T>): void {
    this.messageHandlers.set(messageType, handler);
  }

  /**
   * Register multiple handlers at once
   */
  registerHandlers(handlers: Record<string, MessageHandler>): void {
    Object.entries(handlers).forEach(([messageType, handler]) => {
      this.registerHandler(messageType, handler);
    });
  }

  /**
   * Start consuming messages
   */
  async run(config?: Partial<ConsumerRunConfig>): Promise<void> {
    await this.ensureConnected();

    const runConfig: ConsumerRunConfig = {
      autoCommit: this.options.autoCommit ?? true,
      autoCommitInterval: this.options.autoCommitInterval,
      autoCommitThreshold: this.options.autoCommitThreshold,
      partitionsConsumedConcurrently: this.options.partitionsConsumedConcurrently ?? 1,
      eachBatchAutoResolve: this.options.eachBatchAutoResolve ?? true,
      eachMessage: this.handleMessage.bind(this),
      ...config,
    };

    await this.consumer.run(runConfig);
  }

  /**
   * Pause consumption for specific topics/partitions
   */
  async pause(topicPartitions?: Array<{ topic: string; partitions?: number[] }>): Promise<void> {
    this.consumer.pause(topicPartitions || []);
  }

  /**
   * Resume consumption for specific topics/partitions
   */
  async resume(topicPartitions?: Array<{ topic: string; partitions?: number[] }>): Promise<void> {
    this.consumer.resume(topicPartitions || []);
  }

  /**
   * Get current consumer assignment
   */
  assignment(): Array<{ topic: string; partitions: number[] }> {
    // Note: assignment() is synchronous in kafkajs
    return [];
  }

  /**
   * Commit current offsets
   */
  async commitOffsets(topicPartitions?: Array<{ topic: string; partition: number; offset: string }>): Promise<void> {
    if (topicPartitions) {
      await this.consumer.commitOffsets(topicPartitions);
    }
  }

  /**
   * Seek to specific offset
   */
  async seek(topicPartition: { topic: string; partition: number; offset: string }): Promise<void> {
    this.consumer.seek(topicPartition);
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    
    try {
      // Parse the message
      const officeFlowMessage = this.parseMessage(message);
      if (!officeFlowMessage) {
        console.warn('Failed to parse message, skipping:', {
          topic,
          partition,
          offset: message.offset,
        });
        return;
      }

      // Extract context information
      const context: MessageContext = {
        topic,
        partition,
        offset: message.offset,
        timestamp: message.timestamp,
        headers: this.extractHeaders(message),
        correlationId: officeFlowMessage.metadata.correlationId,
        attempt: this.getAttemptCount(message),
      };

      // Find and execute handler
      const handler = this.messageHandlers.get(officeFlowMessage.type);
      if (!handler) {
        console.warn(`No handler registered for message type: ${officeFlowMessage.type}`);
        return;
      }

      console.log(`Processing message: ${officeFlowMessage.type}`, {
        messageId: officeFlowMessage.id,
        correlationId: context.correlationId,
        topic,
        partition,
        offset: message.offset,
      });

      // Execute handler with retry logic
      await this.executeWithRetry(handler, officeFlowMessage, context);

    } catch (error) {
      console.error('Failed to process message:', error, {
        topic,
        partition,
        offset: message.offset,
      });

      // Send to DLQ if max retries exceeded
      await this.handleFailedMessage(topic, message, error as Error);
    }
  }

  private async executeWithRetry(
    handler: MessageHandler,
    message: OfficeFlowMessage,
    context: MessageContext
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        await handler(message, { ...context, attempt });
        return; // Success
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error as Error) || attempt === this.retryConfig.maxRetries) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxDelayMs
        );

        console.warn(`Handler failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.retryConfig.maxRetries}):`, {
          messageId: message.id,
          correlationId: context.correlationId,
          error: (error as Error).message,
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private parseMessage(message: KafkaMessage): OfficeFlowMessage | null {
    try {
      if (!message.value) {
        return null;
      }

      const messageStr = message.value.toString();
      return JSON.parse(messageStr) as OfficeFlowMessage;
    } catch (error) {
      console.error('Failed to parse message JSON:', error);
      return null;
    }
  }

  private extractHeaders(message: KafkaMessage): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (message.headers) {
      Object.entries(message.headers).forEach(([key, value]) => {
        if (value) {
          headers[key] = value.toString();
        }
      });
    }

    return headers;
  }

  private getAttemptCount(message: KafkaMessage): number {
    const attemptHeader = message.headers?.['retry-attempt'];
    return attemptHeader ? parseInt(attemptHeader.toString(), 10) : 0;
  }

  private isRetryableError(error: Error): boolean {
    return this.retryConfig.retryableErrors?.some(
      retryableError => error.name === retryableError || error.message.includes(retryableError)
    ) ?? false;
  }

  private async handleFailedMessage(topic: string, message: KafkaMessage, error: Error): Promise<void> {
    try {
      const officeFlowMessage = this.parseMessage(message);
      if (officeFlowMessage) {
        const attemptCount = this.getAttemptCount(message) + 1;
        await this.producer.sendToDLQ(topic, officeFlowMessage, error, attemptCount);
      }
    } catch (dlqError) {
      console.error('Failed to send message to DLQ:', dlqError);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }
}