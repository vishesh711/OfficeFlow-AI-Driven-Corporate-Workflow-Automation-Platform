import { OfficeFlowProducer } from '../../producer';
import { OfficeFlowConsumer } from '../../consumer';
import { DLQHandler } from '../../dlq-handler';

// Mock kafkajs
jest.mock('kafkajs', () => {
  const mockProducer = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue([{ partition: 0, offset: '123' }]),
  };

  const mockConsumer = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    run: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    resume: jest.fn(),
    commitOffsets: jest.fn().mockResolvedValue(undefined),
    seek: jest.fn(),
  };

  const mockAdmin = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    createTopics: jest.fn().mockResolvedValue(undefined),
    deleteTopics: jest.fn().mockResolvedValue(undefined),
    listTopics: jest.fn().mockResolvedValue([]),
  };

  const mockKafka = {
    producer: jest.fn().mockReturnValue(mockProducer),
    consumer: jest.fn().mockReturnValue(mockConsumer),
    admin: jest.fn().mockReturnValue(mockAdmin),
  };

  return {
    Kafka: jest.fn().mockImplementation(() => mockKafka),
  };
});

describe('Event Streaming Unit Tests', () => {
  let producer: OfficeFlowProducer;
  let consumer: OfficeFlowConsumer;

  const mockConfig = {
    clientId: 'test-client',
    brokers: ['localhost:9092'],
    connectionTimeout: 10000,
    requestTimeout: 30000,
    retry: { initialRetryTime: 100, retries: 3 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    producer = new OfficeFlowProducer(mockConfig);
    consumer = new OfficeFlowConsumer(
      mockConfig,
      {
        groupId: 'test-group',
        sessionTimeout: 30000,
        rebalanceTimeout: 60000,
        heartbeatInterval: 3000,
      }
    );
  });

  afterEach(async () => {
    await producer.disconnect();
    await consumer.disconnect();
  });

  describe('Producer Functionality', () => {
    it('should create and send a message with proper structure', async () => {
      const testMessage = {
        type: 'employee.onboard',
        payload: { employeeId: 'emp-123', name: 'John Doe' },
        metadata: {
          source: 'test',
          organizationId: 'org-456',
        },
      };

      await producer.connect();
      const result = await producer.sendMessage('test.topic', testMessage);

      expect(result).toEqual([{ partition: 0, offset: '123' }]);
      
      // Verify the producer.send was called with correct structure
      const mockProducer = require('kafkajs').Kafka().producer();
      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'test.topic',
        messages: [
          expect.objectContaining({
            key: 'org-456',
            value: expect.stringContaining('"type":"employee.onboard"'),
            headers: expect.objectContaining({
              'message-type': 'employee.onboard',
              'source': 'test',
              'organization-id': 'org-456',
            }),
          }),
        ],
      });
    });

    it('should send multiple messages in batch', async () => {
      const testMessages = [
        {
          type: 'employee.onboard',
          payload: { employeeId: 'emp-1' },
          metadata: { source: 'test', organizationId: 'org-1' },
        },
        {
          type: 'employee.onboard',
          payload: { employeeId: 'emp-2' },
          metadata: { source: 'test', organizationId: 'org-1' },
        },
      ];

      await producer.connect();
      const result = await producer.sendMessages('test.topic', testMessages);

      expect(result).toEqual([{ partition: 0, offset: '123' }]);

      const mockProducer = require('kafkajs').Kafka().producer();
      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'test.topic',
        messages: expect.arrayContaining([
          expect.objectContaining({
            value: expect.stringContaining('"employeeId":"emp-1"'),
          }),
          expect.objectContaining({
            value: expect.stringContaining('"employeeId":"emp-2"'),
          }),
        ]),
      });
    });

    it('should send message to organization-specific topic', async () => {
      const testMessage = {
        type: 'employee.onboard',
        payload: { employeeId: 'emp-123' },
      };

      await producer.connect();
      await producer.sendToOrganizationTopic('employee.onboard', 'org-456', testMessage);

      const mockProducer = require('kafkajs').Kafka().producer();
      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'employee.onboard.org-456',
        messages: [
          expect.objectContaining({
            key: 'org-456',
            headers: expect.objectContaining({
              'organization-id': 'org-456',
            }),
          }),
        ],
      });
    });

    it('should create DLQ message with proper structure', async () => {
      const originalMessage = {
        id: 'msg-123',
        type: 'employee.onboard',
        metadata: {
          correlationId: 'corr-456',
          timestamp: new Date(),
          source: 'test',
          version: '1.0',
          organizationId: 'org-789',
        },
        payload: { employeeId: 'emp-123' },
      };

      const error = new Error('Processing failed');

      await producer.connect();
      await producer.sendToDLQ('original.topic', originalMessage, error, 3);

      const mockProducer = require('kafkajs').Kafka().producer();
      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'dlq.original.topic',
        messages: [
          expect.objectContaining({
            value: expect.stringContaining('"type":"dlq.message"'),
            headers: expect.objectContaining({
              'message-type': 'dlq.message',
              'source': 'dlq-handler',
            }),
          }),
        ],
      });
    });
  });

  describe('Consumer Functionality', () => {
    it('should register message handlers correctly', () => {
      const handler = jest.fn();
      
      consumer.registerHandler('employee.onboard', handler);
      
      // Verify handler is registered (internal state check)
      expect(consumer['messageHandlers'].get('employee.onboard')).toBe(handler);
    });

    it('should register multiple handlers at once', () => {
      const handlers = {
        'employee.onboard': jest.fn(),
        'employee.exit': jest.fn(),
        'node.execute': jest.fn(),
      };
      
      consumer.registerHandlers(handlers);
      
      // Verify all handlers are registered
      Object.entries(handlers).forEach(([type, handler]) => {
        expect(consumer['messageHandlers'].get(type)).toBe(handler);
      });
    });

    it('should connect and subscribe to topics', async () => {
      await consumer.connect();
      await consumer.subscribe({
        topics: ['test.topic1', 'test.topic2'],
        fromBeginning: true,
      });

      const mockConsumer = require('kafkajs').Kafka().consumer();
      expect(mockConsumer.connect).toHaveBeenCalled();
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topics: ['test.topic1', 'test.topic2'],
        fromBeginning: true,
      });
    });

    it('should start consuming messages', async () => {
      await consumer.connect();
      await consumer.run();

      const mockConsumer = require('kafkajs').Kafka().consumer();
      expect(mockConsumer.run).toHaveBeenCalledWith(
        expect.objectContaining({
          autoCommit: true,
          partitionsConsumedConcurrently: 1,
          eachBatchAutoResolve: true,
          eachMessage: expect.any(Function),
        })
      );
    });

    it('should handle pause and resume operations', async () => {
      await consumer.connect();
      
      await consumer.pause([{ topic: 'test.topic', partitions: [0, 1] }]);
      await consumer.resume([{ topic: 'test.topic', partitions: [0, 1] }]);

      const mockConsumer = require('kafkajs').Kafka().consumer();
      expect(mockConsumer.pause).toHaveBeenCalledWith([{ topic: 'test.topic', partitions: [0, 1] }]);
      expect(mockConsumer.resume).toHaveBeenCalledWith([{ topic: 'test.topic', partitions: [0, 1] }]);
    });

    it('should commit offsets when requested', async () => {
      await consumer.connect();
      
      const offsets = [
        { topic: 'test.topic', partition: 0, offset: '123' },
        { topic: 'test.topic', partition: 1, offset: '456' },
      ];
      
      await consumer.commitOffsets(offsets);

      const mockConsumer = require('kafkajs').Kafka().consumer();
      expect(mockConsumer.commitOffsets).toHaveBeenCalledWith(offsets);
    });
  });

  describe('Message Processing Logic', () => {
    it('should parse valid OfficeFlow messages', () => {
      const validMessage = {
        key: Buffer.from('test-key'),
        value: Buffer.from(JSON.stringify({
          id: 'msg-123',
          type: 'employee.onboard',
          metadata: {
            correlationId: 'corr-456',
            timestamp: new Date().toISOString(),
            source: 'test',
            version: '1.0',
          },
          payload: { employeeId: 'emp-123' },
        })),
        timestamp: '1234567890',
        attributes: 0,
        offset: '100',
        headers: {
          'correlation-id': Buffer.from('corr-456'),
          'message-type': Buffer.from('employee.onboard'),
        },
      };

      const parsed = consumer['parseMessage'](validMessage);
      
      expect(parsed).toEqual(
        expect.objectContaining({
          id: 'msg-123',
          type: 'employee.onboard',
          payload: { employeeId: 'emp-123' },
        })
      );
    });

    it('should handle invalid JSON messages gracefully', () => {
      const invalidMessage = {
        key: Buffer.from('test-key'),
        value: Buffer.from('invalid json'),
        timestamp: '1234567890',
        attributes: 0,
        offset: '100',
        headers: {},
      };

      const parsed = consumer['parseMessage'](invalidMessage);
      expect(parsed).toBeNull();
    });

    it('should extract headers correctly', () => {
      const message = {
        key: Buffer.from('test-key'),
        value: Buffer.from('test-value'),
        timestamp: '1234567890',
        attributes: 0,
        offset: '100',
        headers: {
          'correlation-id': Buffer.from('corr-123'),
          'message-type': Buffer.from('employee.onboard'),
          'organization-id': Buffer.from('org-456'),
        },
      };

      const headers = consumer['extractHeaders'](message);
      
      expect(headers).toEqual({
        'correlation-id': 'corr-123',
        'message-type': 'employee.onboard',
        'organization-id': 'org-456',
      });
    });

    it('should determine retry attempt count from headers', () => {
      const messageWithRetry = {
        key: Buffer.from('test-key'),
        value: Buffer.from('test-value'),
        timestamp: '1234567890',
        attributes: 0,
        offset: '100',
        headers: {
          'retry-attempt': Buffer.from('3'),
        },
      };

      const messageWithoutRetry = {
        key: Buffer.from('test-key'),
        value: Buffer.from('test-value'),
        timestamp: '1234567890',
        attributes: 0,
        offset: '100',
        headers: {},
      };

      expect(consumer['getAttemptCount'](messageWithRetry)).toBe(3);
      expect(consumer['getAttemptCount'](messageWithoutRetry)).toBe(0);
    });

    it('should identify retryable errors correctly', () => {
      const retryableError = new Error('Connection timeout');
      retryableError.name = 'NETWORK_EXCEPTION';

      const nonRetryableError = new Error('Invalid data format');
      nonRetryableError.name = 'VALIDATION_ERROR';

      expect(consumer['isRetryableError'](retryableError)).toBe(true);
      expect(consumer['isRetryableError'](nonRetryableError)).toBe(false);
    });
  });

  describe('DLQ Handler Logic', () => {
    let dlqHandler: DLQHandler;

    beforeEach(() => {
      dlqHandler = new DLQHandler(mockConfig);
    });

    afterEach(async () => {
      await dlqHandler.stop();
    });

    it('should determine if message should be reprocessed', () => {
      const transientFailure = {
        originalTopic: 'test.topic',
        originalMessage: {} as any,
        error: {
          name: 'NETWORK_EXCEPTION',
          message: 'Connection timeout',
        },
        attemptCount: 2,
        dlqTimestamp: new Date(),
      };

      const nonTransientFailure = {
        originalTopic: 'test.topic',
        originalMessage: {} as any,
        error: {
          name: 'VALIDATION_ERROR',
          message: 'Invalid payload',
        },
        attemptCount: 2,
        dlqTimestamp: new Date(),
      };

      const exceededRetries = {
        originalTopic: 'test.topic',
        originalMessage: {} as any,
        error: {
          name: 'NETWORK_EXCEPTION',
          message: 'Connection timeout',
        },
        attemptCount: 5,
        dlqTimestamp: new Date(),
      };

      expect(dlqHandler['shouldReprocess'](transientFailure)).toBe(true);
      expect(dlqHandler['shouldReprocess'](nonTransientFailure)).toBe(false);
      expect(dlqHandler['shouldReprocess'](exceededRetries)).toBe(false);
    });

    it('should initialize with correct configuration', () => {
      const customOptions = {
        maxReprocessAttempts: 5,
        reprocessDelayMs: 30000,
        quarantineAfterAttempts: 10,
        enableManualReview: false,
      };

      const customDlqHandler = new DLQHandler(mockConfig, customOptions);

      expect(customDlqHandler['options']).toEqual(
        expect.objectContaining(customOptions)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle producer connection failures gracefully', async () => {
      const mockProducer = require('kafkajs').Kafka().producer();
      mockProducer.connect.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(producer.connect()).rejects.toThrow('Connection failed');
    });

    it('should handle consumer connection failures gracefully', async () => {
      const mockConsumer = require('kafkajs').Kafka().consumer();
      mockConsumer.connect.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(consumer.connect()).rejects.toThrow('Connection failed');
    });

    it('should handle message sending failures', async () => {
      const mockProducer = require('kafkajs').Kafka().producer();
      mockProducer.send.mockRejectedValueOnce(new Error('Send failed'));

      await producer.connect();

      await expect(
        producer.sendMessage('test.topic', {
          type: 'test.message',
          payload: { test: 'data' },
        })
      ).rejects.toThrow('Send failed');
    });
  });
});