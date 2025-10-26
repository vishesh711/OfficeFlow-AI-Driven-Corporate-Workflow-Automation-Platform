import { getEnv, getEnvAsNumber, getEnvAsBoolean } from '@officeflow/config';

export interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
  project?: string;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  maxRetries: number;
}

export interface AIServiceConfig {
  openai: OpenAIConfig;
  costTracking: {
    enabled: boolean;
    logLevel: 'none' | 'basic' | 'detailed';
  };
  rateLimiting: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  caching: {
    enabled: boolean;
    ttlSeconds: number;
  };
}

export function createAIServiceConfig(): AIServiceConfig {
  return {
    openai: {
      apiKey: getEnv('OPENAI_API_KEY'),
      baseURL: process.env.OPENAI_BASE_URL,
      organization: process.env.OPENAI_ORGANIZATION,
      project: process.env.OPENAI_PROJECT,
      defaultModel: getEnv('OPENAI_DEFAULT_MODEL', 'gpt-4'),
      maxTokens: getEnvAsNumber('OPENAI_MAX_TOKENS', 2000),
      temperature: getEnvAsNumber('OPENAI_TEMPERATURE', 0.7),
      timeout: getEnvAsNumber('OPENAI_TIMEOUT', 60000),
      maxRetries: getEnvAsNumber('OPENAI_MAX_RETRIES', 3),
    },
    costTracking: {
      enabled: getEnvAsBoolean('AI_COST_TRACKING_ENABLED', true),
      logLevel: getEnv('AI_COST_LOG_LEVEL', 'basic') as 'none' | 'basic' | 'detailed',
    },
    rateLimiting: {
      requestsPerMinute: getEnvAsNumber('AI_RATE_LIMIT_REQUESTS', 60),
      tokensPerMinute: getEnvAsNumber('AI_RATE_LIMIT_TOKENS', 100000),
    },
    caching: {
      enabled: getEnvAsBoolean('AI_CACHING_ENABLED', true),
      ttlSeconds: getEnvAsNumber('AI_CACHE_TTL_SECONDS', 3600),
    },
  };
}