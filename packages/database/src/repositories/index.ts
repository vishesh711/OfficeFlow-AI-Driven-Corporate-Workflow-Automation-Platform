/**
 * Repository exports and factory
 */

export { BaseRepository } from './base';
export { OrganizationRepositoryImpl } from './organization';
export { UserRepositoryImpl } from './user';
export { EmployeeRepositoryImpl } from './employee';
export { WorkflowRepositoryImpl } from './workflow';
export { WorkflowRunRepositoryImpl } from './workflow-run';
export { NodeRunRepositoryImpl } from './node-run';
export { AuditLogRepositoryImpl } from './audit-log';
export { IntegrationAccountRepositoryImpl } from './integration-account';

import {
  OrganizationRepository,
  UserRepository,
  EmployeeRepository,
  WorkflowRepository,
  WorkflowRunRepository,
  NodeRunRepository,
  AuditLogRepository,
  IntegrationAccountRepository,
} from '@officeflow/types';

import { OrganizationRepositoryImpl } from './organization';
import { UserRepositoryImpl } from './user';
import { EmployeeRepositoryImpl } from './employee';
import { WorkflowRepositoryImpl } from './workflow';
import { WorkflowRunRepositoryImpl } from './workflow-run';
import { NodeRunRepositoryImpl } from './node-run';
import { AuditLogRepositoryImpl } from './audit-log';
import { IntegrationAccountRepositoryImpl } from './integration-account';

/**
 * Repository factory for dependency injection
 */
export class RepositoryFactory {
  private static instance: RepositoryFactory;
  
  private organizationRepo: OrganizationRepository;
  private userRepo: UserRepository;
  private employeeRepo: EmployeeRepository;
  private workflowRepo: WorkflowRepository;
  private workflowRunRepo: WorkflowRunRepository;
  private nodeRunRepo: NodeRunRepository;
  private auditLogRepo: AuditLogRepository;
  private integrationAccountRepo: IntegrationAccountRepository;

  private constructor() {
    this.organizationRepo = new OrganizationRepositoryImpl();
    this.userRepo = new UserRepositoryImpl();
    this.employeeRepo = new EmployeeRepositoryImpl();
    this.workflowRepo = new WorkflowRepositoryImpl();
    this.workflowRunRepo = new WorkflowRunRepositoryImpl();
    this.nodeRunRepo = new NodeRunRepositoryImpl();
    this.auditLogRepo = new AuditLogRepositoryImpl();
    this.integrationAccountRepo = new IntegrationAccountRepositoryImpl();
  }

  public static getInstance(): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      RepositoryFactory.instance = new RepositoryFactory();
    }
    return RepositoryFactory.instance;
  }

  public getOrganizationRepository(): OrganizationRepository {
    return this.organizationRepo;
  }

  public getUserRepository(): UserRepository {
    return this.userRepo;
  }

  public getEmployeeRepository(): EmployeeRepository {
    return this.employeeRepo;
  }

  public getWorkflowRepository(): WorkflowRepository {
    return this.workflowRepo;
  }

  public getWorkflowRunRepository(): WorkflowRunRepository {
    return this.workflowRunRepo;
  }

  public getNodeRunRepository(): NodeRunRepository {
    return this.nodeRunRepo;
  }

  public getAuditLogRepository(): AuditLogRepository {
    return this.auditLogRepo;
  }

  public getIntegrationAccountRepository(): IntegrationAccountRepository {
    return this.integrationAccountRepo;
  }
}

// Export singleton instance
export const repositories = RepositoryFactory.getInstance();