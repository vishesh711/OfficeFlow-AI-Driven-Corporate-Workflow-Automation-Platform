/**
 * Test setup and configuration
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';