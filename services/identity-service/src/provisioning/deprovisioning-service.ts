/**
 * Account deprovisioning and cleanup service
 */

import { Logger } from 'winston';
import { IdentityProviderAdapter, ProvisioningResult } from '../providers/types';
import { OAuth2Token, IdentityProvider } from '../oauth2/types';

export interface DeprovisioningTask {
  id: string;
  type:
    | 'disable_account'
    | 'remove_groups'
    | 'revoke_licenses'
    | 'backup_data'
    | 'transfer_ownership';
  description: string;
  priority: number;
  dependsOn?: string[];
}

export interface DeprovisioningPlan {
  employeeId: string;
  organizationId: string;
  provider: IdentityProvider;
  tasks: DeprovisioningTask[];
  retentionPeriodDays: number;
  immediateDisable: boolean;
  transferDataTo?: string;
  createdAt: Date;
}

export interface DeprovisioningResult {
  success: boolean;
  completedTasks: string[];
  failedTasks: { taskId: string; error: string }[];
  warnings: string[];
  metadata: Record<string, any>;
}

export class DeprovisioningService {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async createDeprovisioningPlan(
    employeeId: string,
    organizationId: string,
    provider: IdentityProvider,
    options: {
      immediateDisable?: boolean;
      retentionPeriodDays?: number;
      transferDataTo?: string;
      customTasks?: DeprovisioningTask[];
    } = {}
  ): Promise<DeprovisioningPlan> {
    const tasks: DeprovisioningTask[] = [];

    // Standard deprovisioning tasks
    if (options.immediateDisable !== false) {
      tasks.push({
        id: 'disable_account',
        type: 'disable_account',
        description: 'Disable user account to prevent login',
        priority: 1,
      });
    }

    tasks.push({
      id: 'remove_groups',
      type: 'remove_groups',
      description: 'Remove user from all groups and distribution lists',
      priority: 2,
      dependsOn: options.immediateDisable !== false ? ['disable_account'] : undefined,
    });

    tasks.push({
      id: 'revoke_licenses',
      type: 'revoke_licenses',
      description: 'Revoke all assigned licenses',
      priority: 3,
      dependsOn: ['remove_groups'],
    });

    if (options.transferDataTo) {
      tasks.push({
        id: 'transfer_ownership',
        type: 'transfer_ownership',
        description: 'Transfer file and calendar ownership',
        priority: 4,
        dependsOn: ['remove_groups'],
      });
    }

    tasks.push({
      id: 'backup_data',
      type: 'backup_data',
      description: 'Create backup of user data before deletion',
      priority: 5,
      dependsOn: options.transferDataTo ? ['transfer_ownership'] : ['revoke_licenses'],
    });

    // Add custom tasks if provided
    if (options.customTasks) {
      tasks.push(...options.customTasks);
    }

    // Sort tasks by priority
    tasks.sort((a, b) => a.priority - b.priority);

    const plan: DeprovisioningPlan = {
      employeeId,
      organizationId,
      provider,
      tasks,
      retentionPeriodDays: options.retentionPeriodDays || 90,
      immediateDisable: options.immediateDisable !== false,
      transferDataTo: options.transferDataTo,
      createdAt: new Date(),
    };

    this.logger.info('Deprovisioning plan created', {
      employeeId,
      organizationId,
      provider,
      tasksCount: tasks.length,
      immediateDisable: plan.immediateDisable,
    });

    return plan;
  }

  async executeDeprovisioningPlan(
    plan: DeprovisioningPlan,
    adapter: IdentityProviderAdapter,
    tokens: OAuth2Token,
    userEmail: string
  ): Promise<DeprovisioningResult> {
    const result: DeprovisioningResult = {
      success: true,
      completedTasks: [],
      failedTasks: [],
      warnings: [],
      metadata: {
        startTime: new Date(),
        plan: {
          employeeId: plan.employeeId,
          tasksCount: plan.tasks.length,
        },
      },
    };

    this.logger.info('Starting deprovisioning execution', {
      employeeId: plan.employeeId,
      provider: plan.provider,
      tasksCount: plan.tasks.length,
    });

    // Execute tasks in dependency order
    const executedTasks = new Set<string>();

    for (const task of plan.tasks) {
      // Check if dependencies are satisfied
      if (task.dependsOn) {
        const unmetDependencies = task.dependsOn.filter((dep) => !executedTasks.has(dep));
        if (unmetDependencies.length > 0) {
          const error = `Unmet dependencies: ${unmetDependencies.join(', ')}`;
          result.failedTasks.push({ taskId: task.id, error });
          result.success = false;
          continue;
        }
      }

      try {
        await this.executeTask(task, adapter, tokens, userEmail, plan);
        result.completedTasks.push(task.id);
        executedTasks.add(task.id);

        this.logger.debug('Deprovisioning task completed', {
          taskId: task.id,
          type: task.type,
          employeeId: plan.employeeId,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.failedTasks.push({ taskId: task.id, error: errorMessage });
        result.success = false;

        this.logger.error('Deprovisioning task failed', {
          taskId: task.id,
          type: task.type,
          employeeId: plan.employeeId,
          error: errorMessage,
        });

        // Continue with other tasks unless it's a critical failure
        if (task.type === 'disable_account' && plan.immediateDisable) {
          result.warnings.push('Failed to disable account - security risk');
        }
      }
    }

    result.metadata.endTime = new Date();
    result.metadata.executionTimeMs =
      result.metadata.endTime.getTime() - result.metadata.startTime.getTime();

    this.logger.info('Deprovisioning execution completed', {
      employeeId: plan.employeeId,
      success: result.success,
      completedTasks: result.completedTasks.length,
      failedTasks: result.failedTasks.length,
      executionTimeMs: result.metadata.executionTimeMs,
    });

    return result;
  }

  private async executeTask(
    task: DeprovisioningTask,
    adapter: IdentityProviderAdapter,
    tokens: OAuth2Token,
    userEmail: string,
    plan: DeprovisioningPlan
  ): Promise<void> {
    switch (task.type) {
      case 'disable_account':
        await this.disableAccount(adapter, tokens, userEmail);
        break;

      case 'remove_groups':
        await this.removeFromAllGroups(adapter, tokens, userEmail);
        break;

      case 'revoke_licenses':
        await this.revokeLicenses(adapter, tokens, userEmail);
        break;

      case 'backup_data':
        await this.backupUserData(adapter, tokens, userEmail, plan);
        break;

      case 'transfer_ownership':
        await this.transferOwnership(adapter, tokens, userEmail, plan.transferDataTo!);
        break;

      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async disableAccount(
    adapter: IdentityProviderAdapter,
    tokens: OAuth2Token,
    userEmail: string
  ): Promise<void> {
    const result = await adapter.deleteUser(tokens, userEmail);
    if (!result.success) {
      throw new Error(result.error || 'Failed to disable account');
    }
  }

  private async removeFromAllGroups(
    adapter: IdentityProviderAdapter,
    tokens: OAuth2Token,
    userEmail: string
  ): Promise<void> {
    // First, get all groups the user is a member of
    const groups = await adapter.listGroups(tokens);

    // For simplicity, we'll attempt to remove from all groups
    // In a real implementation, you'd query group memberships first
    const groupIds = groups.map((g) => g.id);

    if (groupIds.length > 0) {
      const result = await adapter.removeGroups(tokens, userEmail, groupIds);
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove from groups');
      }
    }
  }

  private async revokeLicenses(
    adapter: IdentityProviderAdapter,
    tokens: OAuth2Token,
    userEmail: string
  ): Promise<void> {
    // License revocation is provider-specific and would require
    // additional API calls. For now, we'll log the action.
    this.logger.info('License revocation requested', {
      userEmail,
      note: 'License revocation requires provider-specific implementation',
    });
  }

  private async backupUserData(
    adapter: IdentityProviderAdapter,
    tokens: OAuth2Token,
    userEmail: string,
    plan: DeprovisioningPlan
  ): Promise<void> {
    // Data backup is complex and provider-specific
    // This would typically involve exporting emails, files, etc.
    this.logger.info('Data backup requested', {
      userEmail,
      retentionPeriodDays: plan.retentionPeriodDays,
      note: 'Data backup requires provider-specific implementation',
    });
  }

  private async transferOwnership(
    adapter: IdentityProviderAdapter,
    tokens: OAuth2Token,
    userEmail: string,
    transferTo: string
  ): Promise<void> {
    // Ownership transfer is complex and provider-specific
    // This would involve transferring files, calendars, etc.
    this.logger.info('Ownership transfer requested', {
      fromUser: userEmail,
      toUser: transferTo,
      note: 'Ownership transfer requires provider-specific implementation',
    });
  }

  async scheduleDelayedDeletion(plan: DeprovisioningPlan, delayDays: number = 30): Promise<void> {
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + delayDays);

    this.logger.info('Scheduled delayed account deletion', {
      employeeId: plan.employeeId,
      organizationId: plan.organizationId,
      deletionDate: deletionDate.toISOString(),
      delayDays,
    });

    // In a real implementation, this would create a scheduled job
    // or database record for delayed deletion
  }
}
