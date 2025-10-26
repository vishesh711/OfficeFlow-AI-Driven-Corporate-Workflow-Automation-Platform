/**
 * Provider factory for creating identity provider adapters
 */

import { Logger } from 'winston';
import { IdentityProvider, ProviderConfig } from '../oauth2/types';
import { IdentityProviderAdapter } from './types';
import { GoogleWorkspaceAdapter } from './google-workspace-adapter';
import { Office365Adapter } from './office365-adapter';

export class ProviderFactory {
  private providers: Map<IdentityProvider, ProviderConfig> = new Map();
  private adapters: Map<IdentityProvider, IdentityProviderAdapter> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  registerProvider(provider: IdentityProvider, config: ProviderConfig): void {
    this.providers.set(provider, config);
    
    // Create and cache the adapter
    const adapter = this.createAdapter(provider, config);
    this.adapters.set(provider, adapter);

    this.logger.info('Identity provider registered', {
      provider,
      apiBaseUrl: config.apiBaseUrl
    });
  }

  getAdapter(provider: IdentityProvider): IdentityProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Identity provider adapter not found: ${provider}`);
    }
    return adapter;
  }

  getProviderConfig(provider: IdentityProvider): ProviderConfig {
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`Identity provider config not found: ${provider}`);
    }
    return config;
  }

  getSupportedProviders(): IdentityProvider[] {
    return Array.from(this.providers.keys());
  }

  isProviderSupported(provider: IdentityProvider): boolean {
    return this.providers.has(provider);
  }

  private createAdapter(provider: IdentityProvider, config: ProviderConfig): IdentityProviderAdapter {
    switch (provider) {
      case 'google_workspace':
        return new GoogleWorkspaceAdapter(config, this.logger);
      
      case 'office365':
        return new Office365Adapter(config, this.logger);
      
      case 'okta':
        // TODO: Implement Okta adapter
        throw new Error('Okta adapter not yet implemented');
      
      case 'active_directory':
        // TODO: Implement Active Directory adapter
        throw new Error('Active Directory adapter not yet implemented');
      
      default:
        throw new Error(`Unsupported identity provider: ${provider}`);
    }
  }
}

// Default provider configurations
export const getDefaultProviderConfigs = (): Map<IdentityProvider, Partial<ProviderConfig>> => {
  const configs = new Map<IdentityProvider, Partial<ProviderConfig>>();

  configs.set('google_workspace', {
    provider: 'google_workspace',
    apiBaseUrl: 'https://admin.googleapis.com',
    adminScopes: [
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/admin.directory.group',
      'https://www.googleapis.com/auth/admin.directory.orgunit'
    ],
    userScopes: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    oauth2: {
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scopes: []
    }
  });

  configs.set('office365', {
    provider: 'office365',
    apiBaseUrl: 'https://graph.microsoft.com/v1.0',
    adminScopes: [
      'https://graph.microsoft.com/User.ReadWrite.All',
      'https://graph.microsoft.com/Group.ReadWrite.All',
      'https://graph.microsoft.com/Directory.ReadWrite.All'
    ],
    userScopes: [
      'https://graph.microsoft.com/User.Read',
      'https://graph.microsoft.com/profile',
      'https://graph.microsoft.com/email'
    ],
    oauth2: {
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      scopes: []
    }
  });

  return configs;
};