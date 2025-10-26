import { config } from '@officeflow/config';

export interface WebhookGatewayConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  kafkaBrokers: string;
  kafkaClientId: string;
  redisUrl: string;
  webhookSecretKey: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  logLevel: string;
  hrmsConfigs: {
    workday: {
      tenantUrl: string;
      username: string;
      password: string;
      pollIntervalMs: number;
    };
    successfactors: {
      apiUrl: string;
      companyId: string;
      username: string;
      password: string;
      pollIntervalMs: number;
    };
    bamboohr: {
      subdomain: string;
      apiKey: string;
      pollIntervalMs: number;
    };
  };
}

export const webhookConfig: WebhookGatewayConfig = {
  port: config.getNumber('PORT', 3010),
  nodeEnv: config.getString('NODE_ENV', 'development'),
  databaseUrl: config.getString('DATABASE_URL'),
  kafkaBrokers: config.getString('KAFKA_BROKERS', 'localhost:9092'),
  kafkaClientId: config.getString('KAFKA_CLIENT_ID', 'webhook-gateway'),
  redisUrl: config.getString('REDIS_URL', 'redis://localhost:6379'),
  webhookSecretKey: config.getString('WEBHOOK_SECRET_KEY'),
  rateLimitWindowMs: config.getNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
  rateLimitMaxRequests: config.getNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  logLevel: config.getString('LOG_LEVEL', 'info'),
  hrmsConfigs: {
    workday: {
      tenantUrl: config.getString('WORKDAY_TENANT_URL', ''),
      username: config.getString('WORKDAY_USERNAME', ''),
      password: config.getString('WORKDAY_PASSWORD', ''),
      pollIntervalMs: config.getNumber('WORKDAY_POLL_INTERVAL_MS', 300000), // 5 minutes
    },
    successfactors: {
      apiUrl: config.getString('SUCCESSFACTORS_API_URL', ''),
      companyId: config.getString('SUCCESSFACTORS_COMPANY_ID', ''),
      username: config.getString('SUCCESSFACTORS_USERNAME', ''),
      password: config.getString('SUCCESSFACTORS_PASSWORD', ''),
      pollIntervalMs: config.getNumber('SUCCESSFACTORS_POLL_INTERVAL_MS', 300000),
    },
    bamboohr: {
      subdomain: config.getString('BAMBOOHR_SUBDOMAIN', ''),
      apiKey: config.getString('BAMBOOHR_API_KEY', ''),
      pollIntervalMs: config.getNumber('BAMBOOHR_POLL_INTERVAL_MS', 300000),
    },
  },
};