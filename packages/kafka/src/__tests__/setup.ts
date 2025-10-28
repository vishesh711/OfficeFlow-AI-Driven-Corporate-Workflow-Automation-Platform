import { Kafka } from 'kafkajs';

// Test configuration
export const TEST_KAFKA_CONFIG = {
  clientId: 'officeflow-test',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
  connectionTimeout: 10000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 100,
    retries: 3,
  },
};

export const TEST_TOPICS = {
  EMPLOYEE_ONBOARD: 'test.employee.onboard',
  EMPLOYEE_EXIT: 'test.employee.exit',
  NODE_EXECUTE: 'test.node.execute',
  DLQ_EMPLOYEE_ONBOARD: 'dlq.test.employee.onboard',
  DLQ_NODE_EXECUTE: 'dlq.test.node.execute',
  MANUAL_REVIEW: 'test.manual.review.queue',
  QUARANTINE: 'test.quarantine.queue',
};

// Global test setup
beforeAll(async () => {
  // Create test topics if they don't exist
  const kafka = new Kafka(TEST_KAFKA_CONFIG);
  const admin = kafka.admin();

  try {
    await admin.connect();

    const existingTopics = await admin.listTopics();
    const topicsToCreate = Object.values(TEST_TOPICS).filter(
      (topic) => !existingTopics.includes(topic)
    );

    if (topicsToCreate.length > 0) {
      await admin.createTopics({
        topics: topicsToCreate.map((topic) => ({
          topic,
          numPartitions: 3,
          replicationFactor: 1,
        })),
      });

      console.log(`Created test topics: ${topicsToCreate.join(', ')}`);
    }
  } catch (error) {
    console.warn('Failed to create test topics:', error);
  } finally {
    await admin.disconnect();
  }
});

// Global test cleanup
afterAll(async () => {
  // Clean up test topics
  const kafka = new Kafka(TEST_KAFKA_CONFIG);
  const admin = kafka.admin();

  try {
    await admin.connect();
    await admin.deleteTopics({
      topics: Object.values(TEST_TOPICS),
    });
    console.log('Cleaned up test topics');
  } catch (error) {
    console.warn('Failed to clean up test topics:', error);
  } finally {
    await admin.disconnect();
  }
});

// Utility function to wait for messages
export const waitForMessages = (timeoutMs: number = 5000): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
};

// Utility function to generate test message
export const createTestMessage = (type: string, payload: any, organizationId?: string) => ({
  type,
  payload,
  metadata: {
    source: 'test',
    version: '1.0',
    organizationId,
  },
});
