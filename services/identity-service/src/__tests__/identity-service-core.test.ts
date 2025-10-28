/**
 * Core Identity Service Tests
 * Tests the main functionality without external dependencies
 */

import { IdentityNodeExecutor } from '../identity-node-executor';
import { NodeInput } from './mocks/types-mock';
import { createMockLogger } from './mocks/logger-mock';

describe('Identity Service Core Tests', () => {
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

  describe('Parameter Validation', () => {
    it('should validate required parameters correctly', () => {
      const validParams = {
        provider: 'google_workspace',
        action: 'provision',
        userEmail: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = executor.validate(validParams);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject missing required parameters', () => {
      const invalidParams = {
        provider: 'google_workspace',
        action: 'provision',
        // Missing userEmail, firstName, lastName
      };

      const result = executor.validate(invalidParams);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((error) => error.includes('userEmail'))).toBe(true);
    });

    it('should validate email format', () => {
      const invalidParams = {
        provider: 'google_workspace',
        action: 'provision',
        userEmail: 'invalid-email-format',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = executor.validate(invalidParams);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('valid email'))).toBe(true);
    });

    it('should validate provider enum values', () => {
      const invalidParams = {
        provider: 'invalid_provider',
        action: 'provision',
        userEmail: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = executor.validate(invalidParams);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('provider'))).toBe(true);
    });

    it('should validate action enum values', () => {
      const invalidParams = {
        provider: 'google_workspace',
        action: 'invalid_action',
        userEmail: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = executor.validate(invalidParams);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('action'))).toBe(true);
    });
  });

  describe('Execution Flow', () => {
    let mockInput: NodeInput;

    beforeEach(() => {
      mockInput = {
        nodeId: 'test-node-123',
        runId: 'test-run-456',
        organizationId: 'test-org-789',
        employeeId: 'test-emp-101',
        params: {
          provider: 'google_workspace',
          action: 'provision',
          userEmail: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        context: {
          organizationId: 'test-org-789',
          employeeId: 'test-emp-101',
          correlationId: 'test-corr-123',
          variables: {},
          secrets: {},
        },
        idempotencyKey: 'test-idem-key-123',
        attempt: 1,
      };

      mockCredentialManager.getCredentials.mockResolvedValue({
        tokens: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
      });
    });

    it('should handle successful user provisioning', async () => {
      const mockProvisioningResult = {
        success: true,
        userId: 'test-user-123',
        email: 'test@example.com',
        metadata: {
          created: true,
        },
      };

      mockAdapter.createUser.mockResolvedValue(mockProvisioningResult);

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('success');
      expect(result.output.userId).toBe('test-user-123');
      expect(result.output.email).toBe('test@example.com');
      expect(result.output.provider).toBe('google_workspace');
      expect(result.output.action).toBe('provision');

      expect(mockCredentialManager.getCredentials).toHaveBeenCalledWith(
        'test-org-789',
        'google_workspace'
      );
      expect(mockProviderFactory.getAdapter).toHaveBeenCalledWith('google_workspace');
      expect(mockAdapter.createUser).toHaveBeenCalled();
      expect(mockAuditLogger.logAccountCreation).toHaveBeenCalled();
    });

    it('should handle successful user deprovisioning', async () => {
      mockInput.params = {
        provider: 'google_workspace',
        action: 'deprovision',
        userEmail: 'test@example.com',
      };

      const mockDeprovisioningResult = {
        success: true,
        userId: 'test-user-123',
        email: 'test@example.com',
        metadata: {
          suspended: true,
        },
      };

      mockAdapter.deleteUser.mockResolvedValue(mockDeprovisioningResult);

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('success');
      expect(result.output.action).toBe('deprovision');
      expect(mockAdapter.deleteUser).toHaveBeenCalledWith(expect.any(Object), 'test@example.com');
      expect(mockAuditLogger.logAccountDeactivation).toHaveBeenCalled();
    });

    it('should handle missing credentials error', async () => {
      mockCredentialManager.getCredentials.mockResolvedValue(null);

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('CREDENTIALS_NOT_FOUND');
      expect(result.error?.message).toContain('No credentials found');
    });

    it('should handle provider errors with retry', async () => {
      const mockProvisioningResult = {
        success: false,
        error: 'Rate limit exceeded',
      };

      mockAdapter.createUser.mockResolvedValue(mockProvisioningResult);

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('retry');
      expect(result.error?.code).toBe('PROVIDER_ERROR');
      expect(result.error?.message).toBe('Rate limit exceeded');
    });

    it('should handle validation errors', async () => {
      mockInput.params = {
        provider: 'invalid_provider',
        action: 'provision',
        userEmail: 'invalid-email',
      };

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toBe('Invalid node parameters');
    });

    it('should handle execution exceptions', async () => {
      const error = new Error('Network connection failed');
      mockAdapter.createUser.mockRejectedValue(error);

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('EXECUTION_ERROR');
      expect(result.error?.message).toBe('Network connection failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Identity node execution failed',
        expect.objectContaining({
          nodeId: 'test-node-123',
          error: 'Network connection failed',
        })
      );
    });

    it('should handle group assignment during provisioning', async () => {
      mockInput.params = {
        provider: 'google_workspace',
        action: 'provision',
        userEmail: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        groups: ['engineering@example.com', 'all-employees@example.com'],
      };

      const mockProvisioningResult = {
        success: true,
        userId: 'test-user-123',
        email: 'test@example.com',
      };

      const mockGroupResult = {
        success: true,
        metadata: {
          groupAssignments: [
            { group: 'engineering@example.com', success: true },
            { group: 'all-employees@example.com', success: true },
          ],
        },
      };

      mockAdapter.createUser.mockResolvedValue(mockProvisioningResult);
      mockAdapter.assignGroups.mockResolvedValue(mockGroupResult);

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('success');
      expect(mockAdapter.createUser).toHaveBeenCalled();
      expect(mockAdapter.assignGroups).toHaveBeenCalledWith(expect.any(Object), 'test-user-123', [
        'engineering@example.com',
        'all-employees@example.com',
      ]);
    });

    it('should handle assign_groups action', async () => {
      mockInput.params = {
        provider: 'google_workspace',
        action: 'assign_groups',
        userEmail: 'test@example.com',
        groups: ['new-group@example.com'],
      };

      const mockGroupResult = {
        success: true,
        userId: 'test-user-123',
        email: 'test@example.com',
        metadata: {
          groupAssignments: [{ group: 'new-group@example.com', success: true }],
        },
      };

      mockAdapter.assignGroups.mockResolvedValue(mockGroupResult);

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('success');
      expect(mockAdapter.assignGroups).toHaveBeenCalledWith(
        expect.any(Object),
        'test@example.com',
        ['new-group@example.com']
      );
    });

    it('should handle assign_groups with no groups specified', async () => {
      mockInput.params = {
        provider: 'google_workspace',
        action: 'assign_groups',
        userEmail: 'test@example.com',
        groups: [],
      };

      const result = await executor.execute(mockInput);

      expect(result.status).toBe('retry');
      expect(result.error?.message).toBe('No groups specified for assignment');
    });

    it('should warn about expiring tokens', async () => {
      mockCredentialManager.isTokenExpiringSoon.mockReturnValue(true);

      const mockProvisioningResult = {
        success: true,
        userId: 'test-user-123',
        email: 'test@example.com',
      };

      mockAdapter.createUser.mockResolvedValue(mockProvisioningResult);

      await executor.execute(mockInput);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Access token is expiring soon',
        expect.objectContaining({
          provider: 'google_workspace',
        })
      );
    });
  });

  describe('Schema Definition', () => {
    it('should return correct node schema', () => {
      const schema = executor.getSchema();

      expect(schema.type).toBe('identity');
      expect(schema.name).toBe('Identity Management');
      expect(schema.description).toBe(
        'Provision, update, and manage user accounts across identity providers'
      );
      expect(schema.category).toBe('Identity & Access');

      // Check that we have the basic required parameters
      expect(schema.parameters.length).toBeGreaterThan(0);
      expect(schema.outputs.length).toBeGreaterThan(0);

      // Check required parameters exist
      const providerParam = schema.parameters.find((p) => p.name === 'provider');
      expect(providerParam).toBeDefined();
      expect(providerParam?.required).toBe(true);

      const actionParam = schema.parameters.find((p) => p.name === 'action');
      expect(actionParam).toBeDefined();
      expect(actionParam?.required).toBe(true);

      const emailParam = schema.parameters.find((p) => p.name === 'userEmail');
      expect(emailParam).toBeDefined();
      expect(emailParam?.required).toBe(true);
    });
  });
});
