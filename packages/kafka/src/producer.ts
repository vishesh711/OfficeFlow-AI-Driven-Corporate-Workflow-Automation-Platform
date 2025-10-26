import { Kafka, Producer, ProducerRecord, RecordMetadata, Message } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { KafkaClusterConfig, defaultProducerConfig } from './config';

export interface MessageMetadata {
  correlationId: string;
  timestamp: Date;
  source: string;
  version: string;
  organizationId?: string;
  employeeId?: string;
}

export interface OfficeFlowMessage<T = any> {
  id: string;
  type: string;
  metadata: MessageMetadata;
  payload: T;
}

export interface ProducerOptions {
  enableIdempotence?: boolean;
  maxInFlightRequests?: number;
  transactionTimeout?: number;
  retry?: {
    initialRetryTime?: number;
    retries?: number;
  };
}

export class OfficeFlowProducer {
  private kafka: Kafka;
  private producer: Producer;
  private isConnected: boolean = false;

  constructor(
    private config: KafkaClusterConfig,
    private options: ProducerOptions = {}
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

    this.producer = this.kafka.producer({
      ...defaultProducerConfig,
      ...this.options,
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.producer.connect();
      this.isConnected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.producer.disconnect();
      this.isConnected = false;
    }
  }

  /**
   * Send a single message to a topic
   */
  async sendMessage<T>(
    topic: string,
    message: Omit<OfficeFlowMessage<T>, 'id' | 'metadata'> & {
      metadata?: Partial<MessageMetadata>;
    },
    partition?: number,
    key?: string
  ): Promise<RecordMetadata[]> {
    await this.ensureConnected();

    const fullMessage: OfficeFlowMessage<T> = {
      id: uuidv4(),
      type: message.type,
      metadata: {
        correlationId: message.metadata?.correlationId || uuidv4(),
        timestamp: new Date(),
        source: message.metadata?.source || 'unknown',
        version: message.metadata?.version || '1.0',
        organizationId: message.metadata?.organizationId,
        employeeId: message.metadata?.employeeId,
        ...message.metadata,
      },
      payload: message.payload,
    };

    const kafkaMessage: Message = {
      key: key || fullMessage.metadata.organizationId || fullMessage.id,
      value: JSON.stringify(fullMessage),
      partition,
      headers: {
        'correlation-id': fullMessage.metadata.correlationId,
        'message-type': fullMessage.type,
        'source': fullMessage.metadata.source,
        'version': fullMessage.metadata.version,
        ...(fullMessage.metadata.organizationId && {
          'organization-id': fullMessage.metadata.organizationId,
        }),
        ...(fullMessage.metadata.employeeId && {
          'employee-id': fullMessage.metadata.employeeId,
        }),
      },
    };

    try {
      const result = await this.producer.send({
        topic,
        messages: [kafkaMessage],
      });

      console.log(`Message sent to topic ${topic}:`, {
        messageId: fullMessage.id,
        correlationId: fullMessage.metadata.correlationId,
        partition: result[0].partition,
        offset: result[0].offset,
      });

      return result;
    } catch (error) {
      console.error(`Failed to send message to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Send multiple messages to a topic
   */
  async sendMessages<T>(
    topic: string,
    messages: Array<Omit<OfficeFlowMessage<T>, 'id' | 'metadata'> & {
      metadata?: Partial<MessageMetadata>;
      partition?: number;
      key?: string;
    }>
  ): Promise<RecordMetadata[]> {
    await this.ensureConnected();

    const kafkaMessages: Message[] = messages.map(message => {
      const fullMessage: OfficeFlowMessage<T> = {
        id: uuidv4(),
        type: message.type,
        metadata: {
          correlationId: message.metadata?.correlationId || uuidv4(),
          timestamp: new Date(),
          source: message.metadata?.source || 'unknown',
          version: message.metadata?.version || '1.0',
          organizationId: message.metadata?.organizationId,
          employeeId: message.metadata?.employeeId,
          ...message.metadata,
        },
        payload: message.payload,
      };

      return {
        key: message.key || fullMessage.metadata.organizationId || fullMessage.id,
        value: JSON.stringify(fullMessage),
        partition: message.partition,
        headers: {
          'correlation-id': fullMessage.metadata.correlationId,
          'message-type': fullMessage.type,
          'source': fullMessage.metadata.source,
          'version': fullMessage.metadata.version,
          ...(fullMessage.metadata.organizationId && {
            'organization-id': fullMessage.metadata.organizationId,
          }),
          ...(fullMessage.metadata.employeeId && {
            'employee-id': fullMessage.metadata.employeeId,
          }),
        },
      };
    });

    try {
      const result = await this.producer.send({
        topic,
        messages: kafkaMessages,
      });

      console.log(`${messages.length} messages sent to topic ${topic}`);
      return result;
    } catch (error) {
      console.error(`Failed to send messages to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Send message to organization-specific topic
   */
  async sendToOrganizationTopic<T>(
    baseTopicName: string,
    organizationId: string,
    message: Omit<OfficeFlowMessage<T>, 'id' | 'metadata'> & {
      metadata?: Partial<MessageMetadata>;
    },
    key?: string
  ): Promise<RecordMetadata[]> {
    const topic = `${baseTopicName}.${organizationId}`;
    
    // Ensure organizationId is in metadata
    const messageWithOrgId = {
      ...message,
      metadata: {
        ...message.metadata,
        organizationId,
      },
    };

    return this.sendMessage(topic, messageWithOrgId, undefined, key);
  }

  /**
   * Send message to dead letter queue
   */
  async sendToDLQ<T>(
    originalTopic: string,
    message: OfficeFlowMessage<T>,
    error: Error,
    attemptCount: number
  ): Promise<RecordMetadata[]> {
    const dlqTopic = `dlq.${originalTopic}`;
    
    const dlqMessage = {
      type: 'dlq.message',
      payload: {
        originalTopic,
        originalMessage: message,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        attemptCount,
        dlqTimestamp: new Date(),
      },
      metadata: {
        ...message.metadata,
        source: 'dlq-handler',
      },
    };

    return this.sendMessage(dlqTopic, dlqMessage);
  }

  /**
   * Begin transaction (for exactly-once semantics)
   */
  async beginTransaction(): Promise<void> {
    await this.ensureConnected();
    await this.producer.transaction();
  }

  /**
   * Commit transaction
   */
  async commitTransaction(): Promise<void> {
    // Note: KafkaJS handles transactions differently
    // This would need to be implemented with proper transaction handling
    console.warn('Transaction commit not implemented - requires proper transaction setup');
  }

  /**
   * Abort transaction
   */
  async abortTransaction(): Promise<void> {
    // Note: KafkaJS handles transactions differently
    // This would need to be implemented with proper transaction handling
    console.warn('Transaction abort not implemented - requires proper transaction setup');
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }
}