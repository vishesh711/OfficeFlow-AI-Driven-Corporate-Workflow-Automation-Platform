/**
 * Test setup configuration
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/officeflow_test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_DB = '1'; // Use different DB for tests
process.env.KAFKA_BROKERS = 'localhost:9092';

// Increase test timeout for integration tests
jest.setTimeout(30000);