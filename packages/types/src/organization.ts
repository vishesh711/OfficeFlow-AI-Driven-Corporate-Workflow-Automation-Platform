/**
 * Organization and user management types
 */

import { BaseEntity, UUID } from './common';

export interface Organization extends BaseEntity {
  name: string;
  domain: string;
  plan: 'starter' | 'professional' | 'enterprise';
  settings: OrganizationSettings;
  isActive: boolean;
}

export interface OrganizationSettings {
  timezone: string;
  dateFormat: string;
  currency: string;
  workingHours: WorkingHours;
  integrations: IntegrationSettings;
  security: SecuritySettings;
  notifications: NotificationSettings;
}

export interface WorkingHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  isWorkingDay: boolean;
  startTime?: string; // HH:mm format
  endTime?: string; // HH:mm format
}

export interface IntegrationSettings {
  hrms?: HRMSIntegration;
  identity?: IdentityIntegration;
  communication?: CommunicationIntegration;
  calendar?: CalendarIntegration;
}

export interface HRMSIntegration {
  provider: 'workday' | 'successfactors' | 'bamboohr' | 'adp';
  apiEndpoint: string;
  webhookUrl?: string;
  syncInterval?: number; // minutes
  isActive: boolean;
}

export interface IdentityIntegration {
  provider: 'okta' | 'google_workspace' | 'office365' | 'active_directory';
  domain: string;
  clientId: string;
  isActive: boolean;
}

export interface CommunicationIntegration {
  slack?: {
    workspaceId: string;
    botToken: string;
    isActive: boolean;
  };
  teams?: {
    tenantId: string;
    clientId: string;
    isActive: boolean;
  };
  email?: {
    provider: 'smtp' | 'sendgrid' | 'ses';
    configuration: Record<string, any>;
    isActive: boolean;
  };
}

export interface CalendarIntegration {
  google?: {
    clientId: string;
    isActive: boolean;
  };
  office365?: {
    tenantId: string;
    clientId: string;
    isActive: boolean;
  };
}

export interface SecuritySettings {
  mfaRequired: boolean;
  sessionTimeoutMinutes: number;
  passwordPolicy: PasswordPolicy;
  ipWhitelist?: string[];
  auditLogRetentionDays: number;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number; // days
}

export interface NotificationSettings {
  workflowFailures: boolean;
  workflowCompletions: boolean;
  systemAlerts: boolean;
  weeklyReports: boolean;
  channels: ('email' | 'slack' | 'webhook')[];
}

export interface User extends BaseEntity {
  organizationId: UUID;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  preferences: UserPreferences;
}

export type UserRole = 'admin' | 'manager' | 'user' | 'viewer';

export interface UserPreferences {
  timezone: string;
  language: string;
  notifications: {
    email: boolean;
    slack: boolean;
    inApp: boolean;
  };
  dashboard: {
    defaultView: 'workflows' | 'executions' | 'analytics';
    refreshInterval: number;
  };
}

export interface Employee extends BaseEntity {
  organizationId: UUID;
  employeeId: string; // External employee ID from HRMS
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  role: string;
  managerId?: UUID;
  startDate: Date;
  endDate?: Date;
  location: string;
  employeeType: 'full-time' | 'part-time' | 'contractor';
  status: 'active' | 'inactive' | 'terminated';
}