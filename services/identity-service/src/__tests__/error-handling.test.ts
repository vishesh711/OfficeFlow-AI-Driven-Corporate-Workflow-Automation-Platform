/**
 * Error Handling and Retry Logic Tests
 * Tests error scenarios and retry behavior
 */

import { IdentityNodeExecutor } from '../identity-node-executor';
import { NodeInput } from '@officeflow/types';
import { createMockLogger } from './mocks/logger-mock';

describe('Identity Service Error Handling Tests', () => {
  let executor: IdentityNodeExecutor;
  let mockCredentialManager: any;
  let mockProviderFactory: any;
  let mockAuditLogger: any;
  let mockCentralAudit: any;
  let mockLogger: any;
  let mockAdapter: any;

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockCredentialManager = {
      getCredentials: jest.fn(),
      isTokenExpiringSoon: jest.fn().mockReturnValue(false),
    };

    mockAdapter = {
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      assignGroups: jest.fn(),
    };

    mockProviderFactory = {
      getAdapter: jest.fn().mockReturnValue(mockAdapter),
    };

    mockAuditLogger = {
      logAccountCreation: jest.fn().mockResolvedValue('audit-id-123'),
      logAccountDeactivation: jest.fn().mockResolvedValue('audit-id-456'),
    };

    mockCentralAudit = {
      publishAuditEvent: jest.fn().mockResolvedValue(undefined),
    };

    executor = new IdentityNodeExecutor(
      mockCredentialManager,
      mockProviderFactory,
      mockAuditLogger,
      mockCentralAudit,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider Error Scenarios', () => {
    let mockInput: NodeInput;

    beforeEach(() => {
      mockInput = {
        nodeId: 'error-test-node',
        runId: 'error-test-run',
        organizationId: 'test-org',
        employeeId: 'test-emp',
        params: {
          provider: 'google_workspace',
          action: 'provision',
          userEmail: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        context: {
          organizationId: 'test-org',
          employeeId: 'test-emp',
          correlationId: 'error-test-corr',
          variables: {},
          secrets: {},
          triggerEvent: 'manual',
        },
        idempotencyKey: 'error-test-idem',
        attempt: 1,
      };

      mockCredentialManager.getCredentials.mockResolvedValue({
        tokens: {
          accessToken: 'test-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
      });
    });

    it('should handle rate limiting errors with retry status', async () => {
      const rateLimitError = {
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
      };

      mockAdapter.createUser.mockResolvedValue(rateLimitError);

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('retry');
      expect(result.error?.code).toBe('PROVIDER_ERROR');
      expect(result.error?.message).toBe('Rate limit exceeded. Please try again later.');
      expect(result.metadata?.retryCount).toBe(1);
    });

    it('should handle authentication errors', async () => {
      const authError = {
        success: false,
        error: 'Invalid credentials or insufficient permissions',
      };

      mockAdapter.createUser.mockResolvedValue(authError);

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('retry');
      expect(result.error?.code).toBe('PROVIDER_ERROR');
      expect(result.error?.message).toBe('Invalid credentials or insufficient permissions');
    });

    it('should handle user already exists errors', async () => {
      const userExistsError = {
        success: false,
        error: 'User already exists with this email address',
      };

      mockAdapter.createUser.mockResolvedValue(userExistsError);

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('retry');
      expect(result.error?.code).toBe('PROVIDER_ERROR');
      expect(result.error?.message).toBe('User already exists with this email address');
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('ETIMEDOUT: Connection timed out');
      mockAdapter.createUser.mockRejectedValue(timeoutError);

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('EXECUTION_ERROR');
      expect(result.error?.message).toBe('ETIMEDOUT: Connection timed out');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Identity node execution failed',
        expect.objectContaining({
          nodeId: 'error-test-node',
          error: 'ETIMEDOUT: Connection timed out',
        })
      );
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = {
        success: false,
        error: 'Service temporarily unavailable',
      };

      mockAdapter.createUser.mockResolvedValue(serviceError);

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('retry');
      expect(result.error?.code).toBe('PROVIDER_ERROR');
      expect(result.error?.message).toBe('Service temporarily unavailable');
    });
  });

  describe('Token Refresh Scenarios', () => {
    let mockInput: NodeInput;

    beforeEach(() => {
      mockInput = {
        nodeId: 'token-test-node',
        runId: 'token-test-run',
        organizationId: 'test-org',
        employeeId: 'test-emp',
        params: {
          provider: 'office365',
          action: 'provision',
          userEmail: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
        context: {
          organizationId: 'test-org',
          employeeId: 'test-emp',
          correlationId: 'token-test-corr',
          variables: {},
          secrets: {},
          triggerEvent: 'manual',
        },
        idempotencyKey: 'token-test-idem',
        attempt: 1,
      };
    });

    it('should warn about expiring tokens', async () => {
      const expiringTokens = {
        accessToken: 'expiring-token',
        tokenType: 'Bearer',
        expiresIn: 300,
        expiresAt: new Date(Date.now() + 300 * 1000), // 5 minutes from now
      };

      mockCredentialManager.getCredentials.mockResolvedValue({
        tokens: expiringTokens,
      });

      mockCredentialManager.isTokenExpiringSoon.mockReturnValue(true);

      mockAdapter.createUser.mockResolvedValue({
        success: true,
        userId: 'test-user-123',
        email: 'test@example.com',
      });

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('success');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Access token is expiring soon',
        expect.objectContaining({
          provider: 'office365',
          expiresAt: expiringTokens.expiresAt,
        })
      );
    });

    it('should handle expired tokens gracefully', async () => {
      const expiredTokens = {
        accessToken: 'expired-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      };

      mockCredentialManager.getCredentials.mockResolvedValue({
        tokens: expiredTokens,
      });

      mockCredentialManager.isTokenExpiringSoon.mockReturnValue(true);

      // Simulate token expired error from provider
      const tokenExpiredError = {
        success: false,
        error: 'Access token has expired',
      };

      mockAdapter.createUser.mockResolvedValue(tokenExpiredError);

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('retry');
      expect(result.error?.message).toBe('Access token has expired');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Access token is expiring soon',
        expect.objectContaining({
          provider: 'office365',
        })
      );
    });
  });

  describe('Group Assignment Error Scenarios', () => {
    let mockInput: NodeInput;

    beforeEach(() => {
      mockInput = {
        nodeId: 'group-test-node',
        runId: 'group-test-run',
        organizationId: 'test-org',
        employeeId: 'test-emp',
        params: {
          provider: 'google_workspace',
          action: 'provision',
          userEmail: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          groups: ['valid-group@example.com', 'invalid-group@example.com'],
        },
        context: {
          organizationId: 'test-org',
          employeeId: 'test-emp',
          correlationId: 'group-test-corr',
          variables: {},
          secrets: {},
          triggerEvent: 'manual',
        },
        idempotencyKey: 'group-test-idem',
        attempt: 1,
      };

      mockCredentialManager.getCredentials.mockResolvedValue({
        tokens: {
          accessToken: 'test-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
      });
    });

    it('should handle partial group assignment failures', async () => {
      // User creation succeeds
      mockAdapter.createUser.mockResolvedValue({
        success: true,
        userId: 'test-user-123',
        email: 'test@example.com',
      });

      // Group assignment partially fails
      mockAdapter.assignGroups.mockResolvedValue({
        success: true, // At least one group succeeded
        metadata: {
          groupAssignments: [
            { group: 'valid-group@example.com', success: true },
            { group: 'invalid-group@example.com', success: false, error: 'Group not found' },
          ],
          successCount: 1,
          totalCount: 2,
        },
      });

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('success');
      expect(result.output.userId).toBe('test-user-123');

      // Verify both user creation and group assignment were called
      expect(mockAdapter.createUser).toHaveBeenCalled();
      expect(mockAdapter.assignGroups).toHaveBeenCalledWith(expect.any(Object), 'test-user-123', [
        'valid-group@example.com',
        'invalid-group@example.com',
      ]);
    });

    it('should handle complete group assignment failure', async () => {
      // User creation succeeds
      mockAdapter.createUser.mockResolvedValue({
        success: true,
        userId: 'test-user-123',
        email: 'test@example.com',
      });

      // All group assignments fail
      mockAdapter.assignGroups.mockResolvedValue({
        success: false,
        error: 'Permission denied for group operations',
        metadata: {
          groupAssignments: [
            { group: 'valid-group@example.com', success: false, error: 'Permission denied' },
            { group: 'invalid-group@example.com', success: false, error: 'Permission denied' },
          ],
          successCount: 0,
          totalCount: 2,
        },
      });

      const result = await executor.execute(mockInput);

      // Should still be success since user was created, even though groups failed
      expect(result.status).toBe('success');
      expect(result.output.userId).toBe('test-user-123');
    });

    it('should handle assign_groups action with empty groups array', async () => {
      mockInput.params = {
        provider: 'google_workspace',
        action: 'assign_groups',
        userEmail: 'test@example.com',
        groups: [],
      };

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('retry');
      expect(result.error?.message).toBe('No groups specified for assignment');

      // Should not call the adapter since validation fails
      expect(mockAdapter.assignGroups).not.toHaveBeenCalled();
    });
  });

  describe('Audit Logging Error Scenarios', () => {
    let mockInput: NodeInput;

    beforeEach(() => {
      mockInput = {
        nodeId: 'audit-test-node',
        runId: 'audit-test-run',
        organizationId: 'test-org',
        employeeId: 'test-emp',
        params: {
          provider: 'google_workspace',
          action: 'provision',
          userEmail: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        context: {
          organizationId: 'test-org',
          employeeId: 'test-emp',
          correlationId: 'audit-test-corr',
          variables: {},
          secrets: {},
          triggerEvent: 'manual',
        },
        idempotencyKey: 'audit-test-idem',
        attempt: 1,
      };

      mockCredentialManager.getCredentials.mockResolvedValue({
        tokens: {
          accessToken: 'test-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
      });
    });

    it('should continue execution even if audit logging fails', async () => {
      // User creation succeeds
      mockAdapter.createUser.mockResolvedValue({
        success: true,
        userId: 'test-user-123',
        email: 'test@example.com',
      });

      // Audit logging fails
      mockAuditLogger.logAccountCreation.mockRejectedValue(new Error('Audit service unavailable'));

      const result = await executor.execute(mockInput);

      // Should still succeed despite audit failure
      expect(result.status).toBe('success');
      expect(result.output.userId).toBe('test-user-123');

      // Should log the audit error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to log audit event',
        expect.objectContaining({
          nodeId: 'audit-test-node',
          action: 'provision',
          error: 'Audit service unavailable',
        })
      );
    });

    it('should continue execution even if central audit publishing fails', async () => {
      // User creation succeeds
      mockAdapter.createUser.mockResolvedValue({
        success: true,
        userId: 'test-user-123',
        email: 'test@example.com',
      });

      // Local audit logging succeeds
      mockAuditLogger.logAccountCreation.mockResolvedValue('audit-id-123');

      // Central audit publishing fails
      mockCentralAudit.publishAuditEvent.mockRejectedValue(new Error('Central audit service down'));

      const result = await executor.execute(mockInput);

      // Should still succeed despite central audit failure
      expect(result.status).toBe('success');
      expect(result.output.userId).toBe('test-user-123');

      // Should log the audit error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to log audit event',
        expect.objectContaining({
          nodeId: 'audit-test-node',
          action: 'provision',
          error: 'Central audit service down',
        })
      );
    });
  });
});
