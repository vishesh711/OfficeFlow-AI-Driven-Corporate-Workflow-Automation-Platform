/**
 * Identity Service node executor implementation
 */

import { Logger } from 'winston';
import { 
  NodeExecutor, 
  NodeInput, 
  NodeResult, 
  NodeSchema, 
  IdentityNodeParams,
  ValidationResult,
  ErrorDetails,
  ExecutionMetadata
} from '@officeflow/types';
import Joi from 'joi';
import { CredentialManager } from './credentials/credential-manager';
import { ProviderFactory } from './providers/provider-factory';
import { IdentityProvider } from './oauth2/types';
import { UserAccount, ProvisioningResult } from './providers/types';
import { AuditLogger } from './audit/audit-logger';
import { CentralAuditIntegration } from './audit/central-audit-integration';

export class IdentityNodeExecutor implements NodeExecutor {
  private logger: Logger;

  constructor(
    private credentialManager: CredentialManager,
    private providerFactory: ProviderFactory,
    private auditLogger: AuditLogger,
    private centralAudit: CentralAuditIntegration,
    logger: Logger
  ) {
    this.logger = logger;
  }

  async execute(input: NodeInput): Promise<NodeResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Executing identity node', {
        nodeId: input.nodeId,
        runId: input.runId,
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        attempt: input.attempt
      });

      // Validate input parameters
      const validation = this.validate(input.params);
      if (!validation.isValid) {
        return this.createErrorResult(
          'VALIDATION_ERROR',
          'Invalid node parameters',
          validation.errors,
          input,
          startTime
        );
      }

      const params = input.params as IdentityNodeParams;      
  
    // Get credentials for the provider
      const credentials = await this.credentialManager.getCredentials(
        input.organizationId,
        params.provider
      );

      if (!credentials) {
        return this.createErrorResult(
          'CREDENTIALS_NOT_FOUND',
          `No credentials found for provider ${params.provider}`,
          { provider: params.provider, organizationId: input.organizationId },
          input,
          startTime
        );
      }

      // Check if tokens need refresh
      if (this.credentialManager.isTokenExpiringSoon(credentials.tokens)) {
        this.logger.warn('Access token is expiring soon', {
          provider: params.provider,
          expiresAt: credentials.tokens.expiresAt
        });
      }

      // Get provider adapter
      const adapter = this.providerFactory.getAdapter(params.provider);
      
      // Execute the requested action
      let result: ProvisioningResult;
      
      switch (params.action) {
        case 'provision':
          result = await this.provisionUser(adapter, credentials.tokens, params, input);
          break;
        
        case 'deprovision':
          result = await this.deprovisionUser(adapter, credentials.tokens, params, input);
          break;
        
        case 'update':
          result = await this.updateUser(adapter, credentials.tokens, params, input);
          break;
        
        case 'assign_groups':
          result = await this.assignGroups(adapter, credentials.tokens, params, input);
          break;
        
        default:
          return this.createErrorResult(
            'UNSUPPORTED_ACTION',
            `Unsupported action: ${params.action}`,
            { action: params.action },
            input,
            startTime
          );
      }

      // Log audit event
      await this.logAuditEvent(params, input, result, Date.now() - startTime);

      // Return result
      if (result.success) {
        return this.createSuccessResult(result, params, input, startTime);
      } else {
        return this.createRetryResult(result, params, input, startTime);
      }
    } catch (error) {
      this.logger.error('Identity node execution failed', {
        nodeId: input.nodeId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      return this.createErrorResult(
        'EXECUTION_ERROR',
        error instanceof Error ? error.message : 'Unknown execution error',
        { nodeId: input.nodeId, runId: input.runId },
        input,
        startTime
      );
    }
  }

  validate(params: Record<string, any>): ValidationResult {
    const schema = Joi.object({
      provider: Joi.string().valid('okta', 'google_workspace', 'office365', 'active_directory').required(),
      action: Joi.string().valid('provision', 'deprovision', 'update', 'assign_groups').required(),
      userEmail: Joi.string().email().required(),
      groups: Joi.array().items(Joi.string()).optional(),
      permissions: Joi.array().items(Joi.string()).optional(),
      licenses: Joi.array().items(Joi.string()).optional(),
      firstName: Joi.string().when('action', { is: 'provision', then: Joi.string().required() }),
      lastName: Joi.string().when('action', { is: 'provision', then: Joi.string().required() }),
      department: Joi.string().optional(),
      title: Joi.string().optional(),
      manager: Joi.string().email().optional()
    });

    const { error } = schema.validate(params, { abortEarly: false });

    if (error) {
      return {
        isValid: false,
        errors: error.details.map(detail => `${detail.path.join('.')}: ${detail.message}`)
      };
    }

    return { isValid: true, errors: [] };
  }

  getSchema(): NodeSchema {
    return {
      type: 'identity',
      name: 'Identity Management',
      description: 'Provision, update, and manage user accounts across identity providers',
      category: 'Identity & Access',
      parameters: [
        {
          name: 'provider',
          type: 'string',
          description: 'Identity provider to use',
          required: true,
          validation: {
            enum: ['okta', 'google_workspace', 'office365', 'active_directory']
          }
        },
        {
          name: 'action',
          type: 'string',
          description: 'Action to perform',
          required: true,
          validation: {
            enum: ['provision', 'deprovision', 'update', 'assign_groups']
          }
        },
        {
          name: 'userEmail',
          type: 'string',
          description: 'User email address',
          required: true,
          validation: {
            pattern: '^[^@]+@[^@]+\\.[^@]+$'
          }
        }
      ],
      outputs: [
        {
          name: 'userId',
          type: 'string',
          description: 'Created or updated user ID'
        },
        {
          name: 'email',
          type: 'string',
          description: 'User email address'
        }
      ],
      examples: []
    };
  } 
 private async provisionUser(
    adapter: any,
    tokens: any,
    params: IdentityNodeParams,
    input: NodeInput
  ): Promise<ProvisioningResult> {
    const userInfo: UserAccount = {
      email: params.userEmail,
      firstName: (params as any).firstName || input.context.variables.firstName || '',
      lastName: (params as any).lastName || input.context.variables.lastName || '',
      department: (params as any).department || input.context.variables.department,
      title: (params as any).title || input.context.variables.title,
      manager: (params as any).manager || input.context.variables.manager
    };

    const result = await adapter.createUser(tokens, userInfo);
    
    if (result.success && params.groups && params.groups.length > 0) {
      const groupResult = await adapter.assignGroups(tokens, result.userId!, params.groups);
      if (result.metadata) {
        result.metadata.groupAssignments = groupResult.metadata?.groupAssignments;
      }
    }

    return result;
  }

  private async deprovisionUser(
    adapter: any,
    tokens: any,
    params: IdentityNodeParams,
    input: NodeInput
  ): Promise<ProvisioningResult> {
    const userId = params.userEmail;
    return await adapter.deleteUser(tokens, userId);
  }

  private async updateUser(
    adapter: any,
    tokens: any,
    params: IdentityNodeParams,
    input: NodeInput
  ): Promise<ProvisioningResult> {
    const userId = params.userEmail;
    const updates: Partial<UserAccount> = {};
    
    if ((params as any).firstName) updates.firstName = (params as any).firstName;
    if ((params as any).lastName) updates.lastName = (params as any).lastName;
    if ((params as any).department) updates.department = (params as any).department;
    if ((params as any).title) updates.title = (params as any).title;
    
    return await adapter.updateUser(tokens, userId, updates);
  }

  private async assignGroups(
    adapter: any,
    tokens: any,
    params: IdentityNodeParams,
    input: NodeInput
  ): Promise<ProvisioningResult> {
    const userId = params.userEmail;
    
    if (!params.groups || params.groups.length === 0) {
      return {
        success: false,
        error: 'No groups specified for assignment'
      };
    }
    
    return await adapter.assignGroups(tokens, userId, params.groups);
  }

  private async logAuditEvent(
    params: IdentityNodeParams,
    input: NodeInput,
    result: ProvisioningResult,
    executionTimeMs: number
  ): Promise<void> {
    try {
      let auditEventId: string;

      switch (params.action) {
        case 'provision':
          auditEventId = await this.auditLogger.logAccountCreation(
            input.organizationId,
            input.employeeId,
            'system',
            params.provider,
            {
              email: params.userEmail,
              firstName: (params as any).firstName,
              lastName: (params as any).lastName,
              department: (params as any).department,
              title: (params as any).title
            },
            result,
            input.context.correlationId,
            {
              nodeId: input.nodeId,
              runId: input.runId,
              executionTimeMs,
              attempt: input.attempt
            }
          );
          break;

        case 'deprovision':
          auditEventId = await this.auditLogger.logAccountDeactivation(
            input.organizationId,
            input.employeeId,
            'system',
            params.provider,
            result.userId || params.userEmail,
            'Employee departure',
            result,
            input.context.correlationId,
            {
              nodeId: input.nodeId,
              runId: input.runId,
              executionTimeMs,
              attempt: input.attempt
            }
          );
          break;

        default:
          return;
      }

      // Publish to central audit service
      const auditEvent = {
        id: auditEventId,
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        actorId: 'system',
        actorType: 'system' as const,
        action: this.mapActionToAuditAction(params.action) as any,
        resource: result.userId || params.userEmail,
        resourceType: 'user_account' as const,
        provider: params.provider,
        status: result.success ? 'success' as const : 'failed' as const,
        details: {
          after: result.success ? result.metadata : undefined,
          error: result.error ? {
            code: 'PROVIDER_ERROR',
            message: result.error
          } : undefined,
          duration: executionTimeMs
        },
        metadata: {
          nodeId: input.nodeId,
          runId: input.runId,
          attempt: input.attempt
        },
        timestamp: new Date(),
        correlationId: input.context.correlationId
      };

      await this.centralAudit.publishAuditEvent(
        auditEvent,
        result.success ? 'medium' : 'high',
        [`node:${input.nodeId}`, `workflow:${input.runId}`]
      );

    } catch (error) {
      this.logger.error('Failed to log audit event', {
        nodeId: input.nodeId,
        action: params.action,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private mapActionToAuditAction(action: string): string {
    const actionMap: Record<string, string> = {
      'provision': 'account.create',
      'deprovision': 'account.disable',
      'update': 'account.update',
      'assign_groups': 'group.assign'
    };
    return actionMap[action] || action;
  }

  private createErrorResult(
    code: string,
    message: string,
    details: any,
    input: NodeInput,
    startTime: number
  ): NodeResult {
    return {
      status: 'failed',
      output: {},
      error: {
        code,
        message,
        details,
        timestamp: new Date()
      },
      metadata: {
        executionId: input.nodeId,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        retryCount: input.attempt,
        correlationId: input.context.correlationId
      }
    };
  }

  private createSuccessResult(
    result: ProvisioningResult,
    params: IdentityNodeParams,
    input: NodeInput,
    startTime: number
  ): NodeResult {
    return {
      status: 'success',
      output: {
        userId: result.userId,
        email: result.email,
        provider: params.provider,
        action: params.action,
        metadata: result.metadata
      },
      metadata: {
        executionId: input.nodeId,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        retryCount: input.attempt,
        correlationId: input.context.correlationId
      }
    };
  }

  private createRetryResult(
    result: ProvisioningResult,
    params: IdentityNodeParams,
    input: NodeInput,
    startTime: number
  ): NodeResult {
    return {
      status: 'retry',
      output: {},
      error: {
        code: 'PROVIDER_ERROR',
        message: result.error || 'Unknown provider error',
        details: result.metadata,
        timestamp: new Date()
      },
      metadata: {
        executionId: input.nodeId,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        retryCount: input.attempt,
        correlationId: input.context.correlationId
      }
    };
  }
}