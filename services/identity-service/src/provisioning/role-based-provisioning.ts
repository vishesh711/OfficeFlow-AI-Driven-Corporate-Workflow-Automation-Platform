/**
 * Role-based provisioning service for automatic group and license assignment
 */

import { Logger } from 'winston';
import { IdentityProvider } from '../oauth2/types';

export interface RoleMapping {
  role: string;
  department?: string;
  groups: string[];
  licenses: string[];
  permissions: string[];
}

export interface ProvisioningPolicy {
  organizationId: string;
  provider: IdentityProvider;
  roleMappings: RoleMapping[];
  defaultGroups: string[];
  defaultLicenses: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeProfile {
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  role: string;
  title: string;
  manager?: string;
  startDate: Date;
  customAttributes?: Record<string, any>;
}

export class RoleBasedProvisioningService {
  private policies: Map<string, ProvisioningPolicy> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async loadProvisioningPolicy(
    organizationId: string,
    provider: IdentityProvider
  ): Promise<ProvisioningPolicy | null> {
    const policyKey = `${organizationId}:${provider}`;

    // In a real implementation, this would load from database
    // For now, return a cached policy or null
    return this.policies.get(policyKey) || null;
  }

  async saveProvisioningPolicy(policy: ProvisioningPolicy): Promise<void> {
    const policyKey = `${policy.organizationId}:${policy.provider}`;
    this.policies.set(policyKey, policy);

    this.logger.info('Provisioning policy saved', {
      organizationId: policy.organizationId,
      provider: policy.provider,
      roleMappingsCount: policy.roleMappings.length,
    });
  }

  calculateProvisioningRequirements(
    employee: EmployeeProfile,
    policy: ProvisioningPolicy
  ): {
    groups: string[];
    licenses: string[];
    permissions: string[];
  } {
    let groups = [...policy.defaultGroups];
    let licenses = [...policy.defaultLicenses];
    let permissions: string[] = [];

    // Find matching role mappings
    const matchingMappings = policy.roleMappings.filter((mapping) => {
      const roleMatch = mapping.role.toLowerCase() === employee.role.toLowerCase();
      const departmentMatch =
        !mapping.department ||
        mapping.department.toLowerCase() === employee.department.toLowerCase();

      return roleMatch && departmentMatch;
    });

    // Apply role-based assignments
    for (const mapping of matchingMappings) {
      groups.push(...mapping.groups);
      licenses.push(...mapping.licenses);
      permissions.push(...mapping.permissions);
    }

    // Add department-based groups
    const departmentGroup = this.generateDepartmentGroup(employee.department, policy.provider);
    if (departmentGroup) {
      groups.push(departmentGroup);
    }

    // Remove duplicates
    groups = [...new Set(groups)];
    licenses = [...new Set(licenses)];
    permissions = [...new Set(permissions)];

    this.logger.debug('Calculated provisioning requirements', {
      employee: employee.email,
      role: employee.role,
      department: employee.department,
      groups: groups.length,
      licenses: licenses.length,
      permissions: permissions.length,
    });

    return { groups, licenses, permissions };
  }

  generateUserAttributes(
    employee: EmployeeProfile,
    policy: ProvisioningPolicy
  ): Record<string, any> {
    const attributes: Record<string, any> = {
      employeeId: employee.customAttributes?.employeeId,
      department: employee.department,
      role: employee.role,
      title: employee.title,
      startDate: employee.startDate.toISOString(),
      manager: employee.manager,
    };

    // Add provider-specific attributes
    switch (policy.provider) {
      case 'google_workspace':
        attributes.orgUnitPath = `/Departments/${employee.department}`;
        attributes.costCenter = employee.customAttributes?.costCenter;
        break;

      case 'office365':
        attributes.companyName = employee.customAttributes?.companyName;
        attributes.officeLocation = employee.customAttributes?.officeLocation;
        break;
    }

    return attributes;
  }

  validateProvisioningPolicy(policy: ProvisioningPolicy): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!policy.organizationId) {
      errors.push('Organization ID is required');
    }

    if (!policy.provider) {
      errors.push('Provider is required');
    }

    if (!policy.roleMappings || policy.roleMappings.length === 0) {
      errors.push('At least one role mapping is required');
    }

    // Validate role mappings
    for (let i = 0; i < policy.roleMappings.length; i++) {
      const mapping = policy.roleMappings[i];

      if (!mapping.role) {
        errors.push(`Role mapping ${i + 1}: Role is required`);
      }

      if (!mapping.groups || mapping.groups.length === 0) {
        errors.push(`Role mapping ${i + 1}: At least one group is required`);
      }

      // Validate group format based on provider
      if (policy.provider === 'google_workspace') {
        const invalidGroups = mapping.groups.filter((group) => !group.includes('@'));
        if (invalidGroups.length > 0) {
          errors.push(`Role mapping ${i + 1}: Google Workspace groups must be email addresses`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private generateDepartmentGroup(department: string, provider: IdentityProvider): string | null {
    const normalizedDept = department.toLowerCase().replace(/\s+/g, '-');

    switch (provider) {
      case 'google_workspace':
        return `${normalizedDept}@company.com`; // This should be configurable

      case 'office365':
        return `${normalizedDept}-group`; // Office 365 group naming convention

      default:
        return null;
    }
  }
}

// Default role mappings for common organizational structures
export const getDefaultRoleMappings = (provider: IdentityProvider): RoleMapping[] => {
  const baseMappings: RoleMapping[] = [
    {
      role: 'Software Engineer',
      department: 'Engineering',
      groups:
        provider === 'google_workspace'
          ? ['engineering@company.com', 'developers@company.com']
          : ['engineering-group', 'developers-group'],
      licenses:
        provider === 'google_workspace'
          ? ['Google Workspace Business Standard']
          : ['Microsoft 365 E3'],
      permissions: ['code-repository-access', 'development-tools'],
    },
    {
      role: 'Product Manager',
      department: 'Product',
      groups:
        provider === 'google_workspace'
          ? ['product@company.com', 'management@company.com']
          : ['product-group', 'management-group'],
      licenses:
        provider === 'google_workspace' ? ['Google Workspace Business Plus'] : ['Microsoft 365 E5'],
      permissions: ['analytics-access', 'user-research-tools'],
    },
    {
      role: 'Sales Representative',
      department: 'Sales',
      groups:
        provider === 'google_workspace'
          ? ['sales@company.com', 'crm-users@company.com']
          : ['sales-group', 'crm-users-group'],
      licenses:
        provider === 'google_workspace'
          ? ['Google Workspace Business Standard']
          : ['Microsoft 365 E3'],
      permissions: ['crm-access', 'sales-tools'],
    },
  ];

  return baseMappings;
};
