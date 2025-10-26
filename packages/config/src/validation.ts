import Joi from 'joi';

/**
 * Base configuration validation schemas
 */

export const databaseConfigSchema = Joi.object({
  url: Joi.string().required(),
  host: Joi.string().optional(),
  port: Joi.number().port().optional(),
  database: Joi.string().optional(),
  username: Joi.string().optional(),
  password: Joi.string().optional(),
  ssl: Joi.boolean().default(false),
  maxConnections: Joi.number().min(1).default(20),
  connectionTimeoutMs: Joi.number().min(1000).default(2000),
  idleTimeoutMs: Joi.number().min(1000).default(30000),
});

export const redisConfigSchema = Joi.object({
  host: Joi.string().required(),
  port: Joi.number().port().default(6379),
  password: Joi.string().optional(),
  db: Joi.number().min(0).default(0),
  keyPrefix: Joi.string().default('officeflow:'),
  maxRetriesPerRequest: Joi.number().min(0).default(3),
  retryDelayOnFailover: Joi.number().min(100).default(100),
});

export const kafkaConfigSchema = Joi.object({
  brokers: Joi.array().items(Joi.string()).min(1).required(),
  clientId: Joi.string().required(),
  groupId: Joi.string().required(),
  ssl: Joi.boolean().default(false),
  sasl: Joi.object({
    mechanism: Joi.string().valid('plain', 'scram-sha-256', 'scram-sha-512').required(),
    username: Joi.string().required(),
    password: Joi.string().required(),
  }).optional(),
  connectionTimeout: Joi.number().min(1000).default(30000),
  requestTimeout: Joi.number().min(1000).default(30000),
});

export const serverConfigSchema = Joi.object({
  port: Joi.number().port().default(3000),
  host: Joi.string().default('0.0.0.0'),
  cors: Joi.object({
    origin: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string()),
      Joi.boolean()
    ).default('*'),
    credentials: Joi.boolean().default(true),
  }).default(),
  rateLimit: Joi.object({
    windowMs: Joi.number().min(1000).default(900000), // 15 minutes
    max: Joi.number().min(1).default(100),
  }).default(),
});

export const authConfigSchema = Joi.object({
  jwtSecret: Joi.string().min(32).required(),
  jwtExpiresIn: Joi.string().default('24h'),
  bcryptRounds: Joi.number().min(10).max(15).default(12),
  sessionTimeoutMs: Joi.number().min(300000).default(86400000), // 24 hours
});

export const observabilityConfigSchema = Joi.object({
  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    format: Joi.string().valid('json', 'text').default('json'),
    enableConsole: Joi.boolean().default(true),
    enableFile: Joi.boolean().default(false),
    filePath: Joi.string().when('enableFile', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  }).default(),
  metrics: Joi.object({
    enabled: Joi.boolean().default(true),
    port: Joi.number().port().default(9090),
    path: Joi.string().default('/metrics'),
  }).default(),
  tracing: Joi.object({
    enabled: Joi.boolean().default(true),
    serviceName: Joi.string().required(),
    jaegerEndpoint: Joi.string().uri().optional(),
    sampleRate: Joi.number().min(0).max(1).default(0.1),
  }).default(),
});

/**
 * Validate configuration object against schema
 */
export function validateConfig<T>(config: unknown, schema: Joi.ObjectSchema): T {
  const { error, value } = schema.validate(config, {
    allowUnknown: false,
    stripUnknown: true,
    abortEarly: false,
  });

  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    throw new Error(`Configuration validation failed: ${errorMessage}`);
  }

  return value as T;
}