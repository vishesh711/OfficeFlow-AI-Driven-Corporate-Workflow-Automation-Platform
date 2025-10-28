export { BaseHRMSAdapter } from './base-hrms-adapter';
export { WorkdayAdapter } from './workday-adapter';
export { SuccessFactorsAdapter } from './successfactors-adapter';
export { BambooHRAdapter } from './bamboohr-adapter';

// Adapter factory for creating adapters dynamically
import { BaseHRMSAdapter } from './base-hrms-adapter';
import { WorkdayAdapter } from './workday-adapter';
import { SuccessFactorsAdapter } from './successfactors-adapter';
import { BambooHRAdapter } from './bamboohr-adapter';
import { PollingConfig } from '../types/webhook-types';

export class AdapterFactory {
  /**
   * Create an adapter instance based on source type
   */
  static createAdapter(source: string, config: PollingConfig): BaseHRMSAdapter {
    switch (source.toLowerCase()) {
      case 'workday':
        return new WorkdayAdapter(config);
      case 'successfactors':
        return new SuccessFactorsAdapter(config);
      case 'bamboohr':
        return new BambooHRAdapter(config);
      default:
        throw new Error(`Unsupported HRMS source: ${source}`);
    }
  }

  /**
   * Get list of supported adapter sources
   */
  static getSupportedSources(): string[] {
    return ['workday', 'successfactors', 'bamboohr'];
  }

  /**
   * Validate adapter configuration
   */
  static validateConfig(
    source: string,
    config: PollingConfig
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Common validation
    if (!config.organizationId) {
      errors.push('organizationId is required');
    }

    if (!config.credentials) {
      errors.push('credentials are required');
    }

    if (config.intervalMs && config.intervalMs < 60000) {
      errors.push('intervalMs must be at least 60000 (1 minute)');
    }

    // Source-specific validation
    switch (source.toLowerCase()) {
      case 'workday':
        if (!config.credentials?.tenantUrl) {
          errors.push('Workday tenantUrl is required');
        }
        if (!config.credentials?.username) {
          errors.push('Workday username is required');
        }
        if (!config.credentials?.password) {
          errors.push('Workday password is required');
        }
        break;

      case 'successfactors':
        if (!config.credentials?.apiUrl) {
          errors.push('SuccessFactors apiUrl is required');
        }
        if (!config.credentials?.companyId) {
          errors.push('SuccessFactors companyId is required');
        }
        if (!config.credentials?.username) {
          errors.push('SuccessFactors username is required');
        }
        if (!config.credentials?.password) {
          errors.push('SuccessFactors password is required');
        }
        break;

      case 'bamboohr':
        if (!config.credentials?.subdomain) {
          errors.push('BambooHR subdomain is required');
        }
        if (!config.credentials?.apiKey) {
          errors.push('BambooHR apiKey is required');
        }
        break;

      default:
        errors.push(`Unsupported source: ${source}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
