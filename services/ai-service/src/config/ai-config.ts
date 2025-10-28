import { getEnv, getEnvAsNumber, getEnvAsBoolean } from '@officeflow/config';

export type LLMProvider = 'anthropic' | 'openai' | 'aws-bedrock';

export interface AnthropicConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  maxRetries: number;
}

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

export interface AWSConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bedrockModel?: string;
}

export interface AIServiceConfig {
  provider: LLMProvider;
  anthropic: AnthropicConfig;
  openai: OpenAIConfig;
  aws: AWSConfig;
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
  const provider = getEnv('LLM_PROVIDER', 'anthropic') as LLMProvider;

  return {
    provider,
    anthropic: {
      apiKey: getEnv('ANTHROPIC_API_KEY', ''),
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
      defaultModel: getEnv('ANTHROPIC_MODEL', 'claude-3-5-sonnet-20241022'),
      maxTokens: getEnvAsNumber('ANTHROPIC_MAX_TOKENS', 4096),
      temperature: getEnvAsNumber('ANTHROPIC_TEMPERATURE', 0.7),
      timeout: getEnvAsNumber('ANTHROPIC_TIMEOUT', 60000),
      maxRetries: getEnvAsNumber('ANTHROPIC_MAX_RETRIES', 3),
    },
    openai: {
      apiKey: getEnv('OPENAI_API_KEY', ''),
      baseURL: process.env.OPENAI_BASE_URL,
      organization: process.env.OPENAI_ORGANIZATION,
      project: process.env.OPENAI_PROJECT,
      defaultModel: getEnv('OPENAI_DEFAULT_MODEL', 'gpt-4'),
      maxTokens: getEnvAsNumber('OPENAI_MAX_TOKENS', 2000),
      temperature: getEnvAsNumber('OPENAI_TEMPERATURE', 0.7),
      timeout: getEnvAsNumber('OPENAI_TIMEOUT', 60000),
      maxRetries: getEnvAsNumber('OPENAI_MAX_RETRIES', 3),
    },
    aws: {
      accessKeyId: getEnv('AWS_ACCESS_KEY_ID', ''),
      secretAccessKey: getEnv('AWS_SECRET_ACCESS_KEY', ''),
      region: getEnv('AWS_REGION', 'us-east-1'),
      bedrockModel: process.env.AWS_BEDROCK_MODEL || 'anthropic.claude-3-sonnet-20240229-v1:0',
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
