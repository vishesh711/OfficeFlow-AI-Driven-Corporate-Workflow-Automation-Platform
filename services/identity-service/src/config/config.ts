/**
 * Identity Service configuration
 */

import { IdentityProvider, ProviderConfig } from '../oauth2/types';

export interface IdentityServiceConfig {
  port: number;
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
    maxConnections: number;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
    ssl: boolean;
  };
  encryption: {
    key: string;
  };
  providers: Map<IdentityProvider, ProviderConfig>;
  audit: {
    retentionDays: number;
    enableCentralAudit: boolean;
  };
  logging: {
    level: string;
    format: 'json' | 'simple';
  };
}

export function loadConfig(): IdentityServiceConfig {
  const config: IdentityServiceConfig = {
    port: parseInt(process.env.PORT || '3003'),
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'officeflow',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    },
    kafka: {
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      clientId: process.env.KAFKA_CLIENT_ID || 'identity-service',
      groupId: process.env.KAFKA_GROUP_ID || 'identity-service-group',
      ssl: process.env.KAFKA_SSL === 'true',
    },
    encryption: {
      key:
        process.env.ENCRYPTION_KEY ||
        (() => {
          throw new Error('ENCRYPTION_KEY environment variable is required');
        })(),
    },
    providers: loadProviderConfigs(),
    audit: {
      retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '2555'), // ~7 years
      enableCentralAudit: process.env.ENABLE_CENTRAL_AUDIT !== 'false',
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: (process.env.LOG_FORMAT as 'json' | 'simple') || 'json',
    },
  };

  validateConfig(config);
  return config;
}

function loadProviderConfigs(): Map<IdentityProvider, ProviderConfig> {
  const providers = new Map<IdentityProvider, ProviderConfig>();

  // Google Workspace
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.set('google_workspace', {
      provider: 'google_workspace',
      oauth2: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri:
          process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3003/auth/google/callback',
        scopes: [
          'https://www.googleapis.com/auth/admin.directory.user',
          'https://www.googleapis.com/auth/admin.directory.group',
          'https://www.googleapis.com/auth/admin.directory.orgunit',
        ],
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      },
      apiBaseUrl: 'https://admin.googleapis.com',
      adminScopes: [
        'https://www.googleapis.com/auth/admin.directory.user',
        'https://www.googleapis.com/auth/admin.directory.group',
        'https://www.googleapis.com/auth/admin.directory.orgunit',
      ],
      userScopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    });
  }

  // Office 365
  if (process.env.OFFICE365_CLIENT_ID && process.env.OFFICE365_CLIENT_SECRET) {
    const tenantId = process.env.OFFICE365_TENANT_ID || 'common';
    providers.set('office365', {
      provider: 'office365',
      oauth2: {
        clientId: process.env.OFFICE365_CLIENT_ID,
        clientSecret: process.env.OFFICE365_CLIENT_SECRET,
        redirectUri:
          process.env.OFFICE365_REDIRECT_URI || 'http://localhost:3003/auth/office365/callback',
        scopes: [
          'https://graph.microsoft.com/User.ReadWrite.All',
          'https://graph.microsoft.com/Group.ReadWrite.All',
          'https://graph.microsoft.com/Directory.ReadWrite.All',
        ],
        authUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      },
      apiBaseUrl: 'https://graph.microsoft.com/v1.0',
      adminScopes: [
        'https://graph.microsoft.com/User.ReadWrite.All',
        'https://graph.microsoft.com/Group.ReadWrite.All',
        'https://graph.microsoft.com/Directory.ReadWrite.All',
      ],
      userScopes: [
        'https://graph.microsoft.com/User.Read',
        'https://graph.microsoft.com/profile',
        'https://graph.microsoft.com/email',
      ],
    });
  }

  return providers;
}

function validateConfig(config: IdentityServiceConfig): void {
  if (!config.encryption.key || config.encryption.key.length < 32) {
    throw new Error('Encryption key must be at least 32 characters long');
  }

  if (config.providers.size === 0) {
    throw new Error('At least one identity provider must be configured');
  }

  if (!config.database.host || !config.database.database) {
    throw new Error('Database configuration is incomplete');
  }

  if (!config.kafka.brokers || config.kafka.brokers.length === 0) {
    throw new Error('Kafka brokers must be configured');
  }
}
