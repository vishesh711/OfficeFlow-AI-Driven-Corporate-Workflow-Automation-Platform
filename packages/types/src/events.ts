/**
 * Event types for the OfficeFlow platform
 */

import { UUID } from './common';

export type LifecycleEventType =
  | 'employee.onboard'
  | 'employee.exit'
  | 'employee.transfer'
  | 'employee.update'
  | 'employee.role_change'
  | 'employee.department_change';

export interface LifecycleEvent {
  type: LifecycleEventType;
  organizationId: UUID;
  employeeId: UUID;
  payload: Record<string, any>;
  timestamp: Date;
  correlationId: UUID;
  source: string;
  version: string;
}

export interface EmployeeOnboardEvent extends LifecycleEvent {
  type: 'employee.onboard';
  payload: {
    firstName: string;
    lastName: string;
    email: string;
    department: string;
    role: string;
    managerId?: UUID;
    startDate: Date;
    location: string;
    employeeType: 'full-time' | 'part-time' | 'contractor';
  };
}

export interface EmployeeExitEvent extends LifecycleEvent {
  type: 'employee.exit';
  payload: {
    exitDate: Date;
    exitType: 'voluntary' | 'involuntary' | 'retirement';
    reason?: string;
    lastWorkingDay: Date;
  };
}

export interface EmployeeTransferEvent extends LifecycleEvent {
  type: 'employee.transfer';
  payload: {
    fromDepartment: string;
    toDepartment: string;
    fromRole: string;
    toRole: string;
    fromManagerId?: UUID;
    toManagerId?: UUID;
    effectiveDate: Date;
  };
}

export interface WorkflowEvent {
  type:
    | 'workflow.run.request'
    | 'workflow.run.pause'
    | 'workflow.run.resume'
    | 'workflow.run.cancel';
  runId: UUID;
  organizationId: UUID;
  timestamp: Date;
  correlationId: UUID;
  payload?: Record<string, any>;
}

export interface NodeExecutionEvent {
  type: 'node.execute.request' | 'node.execute.result' | 'node.execute.retry';
  nodeRunId: UUID;
  runId: UUID;
  organizationId: UUID;
  timestamp: Date;
  correlationId: UUID;
  payload: Record<string, any>;
}
