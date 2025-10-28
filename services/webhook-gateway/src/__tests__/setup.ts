// Test setup file for webhook gateway service
import { logger } from '../utils/logger';

// Suppress logs during testing
logger.transports.forEach((transport) => {
  transport.silent = true;
});

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock external dependencies
jest.mock('@officeflow/kafka', () => ({
  OfficeFlowProducer: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
  })),
}));

// Global test timeout
jest.setTimeout(30000);
