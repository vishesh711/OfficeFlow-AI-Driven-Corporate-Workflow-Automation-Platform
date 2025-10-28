import {
  getEnv,
  getEnvAsNumber,
  getEnvAsBoolean,
  getEnvAsArray,
  loadEnvironment,
} from './environment';
import {
  validateConfig,
  databaseConfigSchema,
  redisConfigSchema,
  kafkaConfigSchema,
  serverConfigSchema,
  authConfigSchema,
  observabilityConfigSchema,
} from './validation';

/**
 * Configuration interfaces
 */

export interface DatabaseConfig {
  url: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl: boolean;
  maxConnections: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
}

export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
  ssl: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  connectionTimeout: number;
  requestTimeout: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
  sessionTimeoutMs: number;
}

export interface ObservabilityConfig {
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    format: 'json' | 'text';
    enableConsole: boolean;
    enableFile: boolean;
    filePath?: string;
  };
  metrics: {
    enabled: boolean;
    port: number;
    path: string;
  };
  tracing: {
    enabled: boolean;
    serviceName: string;
    jaegerEndpoint?: string;
    sampleRate: number;
  };
}

export interface AppConfig {
  nodeEnv: string;
  serviceName: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  kafka: KafkaConfig;
  server: ServerConfig;
  auth: AuthConfig;
  observability: ObservabilityConfig;
}

/**
 * Configuration factory functions
 */

export function createDatabaseConfig(): DatabaseConfig {
  // Support both URL and individual connection parameters
  const url = process.env.DATABASE_URL || process.env.DB_URL;

  let constructedUrl;
  if (!url && process.env.DB_USER) {
    constructedUrl = `postgresql://${getEnv('DB_USER')}:${getEnv('DB_PASSWORD')}@${getEnv('DB_HOST')}:${getEnvAsNumber('DB_PORT', 5432)}/${getEnv('DB_NAME')}`;
  }

  const config = {
    url: url || constructedUrl,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? getEnvAsNumber('DB_PORT') : undefined,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: getEnvAsBoolean('DB_SSL', false),
    maxConnections: getEnvAsNumber('DB_MAX_CONNECTIONS', 20),
    connectionTimeoutMs: getEnvAsNumber('DB_CONNECTION_TIMEOUT_MS', 2000),
    idleTimeoutMs: getEnvAsNumber('DB_IDLE_TIMEOUT_MS', 30000),
  };

  return validateConfig<DatabaseConfig>(config, databaseConfigSchema);
}

export function createRedisConfig(): RedisConfig {
  const config = {
    host: getEnv('REDIS_HOST'),
    port: getEnvAsNumber('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: getEnvAsNumber('REDIS_DB', 0),
    keyPrefix: getEnv('REDIS_KEY_PREFIX', 'officeflow:'),
    maxRetriesPerRequest: getEnvAsNumber('REDIS_MAX_RETRIES', 3),
    retryDelayOnFailover: getEnvAsNumber('REDIS_RETRY_DELAY', 100),
  };

  return validateConfig<RedisConfig>(config, redisConfigSchema);
}

export function createKafkaConfig(): KafkaConfig {
  const config = {
    brokers: getEnvAsArray('KAFKA_BROKERS'),
    clientId: getEnv('KAFKA_CLIENT_ID'),
    groupId: getEnv('KAFKA_GROUP_ID'),
    ssl: getEnvAsBoolean('KAFKA_SSL', false),
    sasl:
      process.env.KAFKA_SASL_MECHANISM && process.env.KAFKA_SASL_MECHANISM.trim()
        ? {
            mechanism: getEnv('KAFKA_SASL_MECHANISM') as any,
            username: getEnv('KAFKA_SASL_USERNAME'),
            password: getEnv('KAFKA_SASL_PASSWORD'),
          }
        : undefined,
    connectionTimeout: getEnvAsNumber('KAFKA_CONNECTION_TIMEOUT', 30000),
    requestTimeout: getEnvAsNumber('KAFKA_REQUEST_TIMEOUT', 30000),
  };

  return validateConfig<KafkaConfig>(config, kafkaConfigSchema);
}

export function createServerConfig(): ServerConfig {
  const config = {
    port: getEnvAsNumber('PORT', 3000),
    host: getEnv('HOST', '0.0.0.0'),
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: getEnvAsBoolean('CORS_CREDENTIALS', true),
    },
    rateLimit: {
      windowMs: getEnvAsNumber('RATE_LIMIT_WINDOW_MS', 900000),
      max: getEnvAsNumber('RATE_LIMIT_MAX', 100),
    },
  };

  return validateConfig<ServerConfig>(config, serverConfigSchema);
}

export function createAuthConfig(): AuthConfig {
  const config = {
    jwtSecret: getEnv('JWT_SECRET'),
    jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '24h'),
    bcryptRounds: getEnvAsNumber('BCRYPT_ROUNDS', 12),
    sessionTimeoutMs: getEnvAsNumber('SESSION_TIMEOUT_MS', 86400000),
  };

  return validateConfig<AuthConfig>(config, authConfigSchema);
}

export function createObservabilityConfig(serviceName: string): ObservabilityConfig {
  const config = {
    logging: {
      level: getEnv('LOG_LEVEL', 'info'),
      format: getEnv('LOG_FORMAT', 'json'),
      enableConsole: getEnvAsBoolean('LOG_ENABLE_CONSOLE', true),
      enableFile: getEnvAsBoolean('LOG_ENABLE_FILE', false),
      filePath:
        process.env.LOG_FILE_PATH && process.env.LOG_FILE_PATH.trim()
          ? process.env.LOG_FILE_PATH
          : undefined,
    },
    metrics: {
      enabled: getEnvAsBoolean('METRICS_ENABLED', true),
      port: getEnvAsNumber('METRICS_PORT', 9090),
      path: getEnv('METRICS_PATH', '/metrics'),
    },
    tracing: {
      enabled: getEnvAsBoolean('TRACING_ENABLED', true),
      serviceName,
      jaegerEndpoint:
        process.env.JAEGER_ENDPOINT && process.env.JAEGER_ENDPOINT.trim()
          ? process.env.JAEGER_ENDPOINT
          : undefined,
      sampleRate: getEnvAsNumber('TRACING_SAMPLE_RATE', 0.1),
    },
  };

  return validateConfig<ObservabilityConfig>(config, observabilityConfigSchema);
}

/**
 * Create complete application configuration
 */
export function createAppConfig(serviceName: string): AppConfig {
  // Load environment variables
  loadEnvironment();

  return {
    nodeEnv: getEnv('NODE_ENV', 'development'),
    serviceName,
    database: createDatabaseConfig(),
    redis: createRedisConfig(),
    kafka: createKafkaConfig(),
    server: createServerConfig(),
    auth: createAuthConfig(),
    observability: createObservabilityConfig(serviceName),
  };
}
