import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Load environment variables from .env files
 */
export function loadEnvironment(envPath?: string): void {
  const paths = [
    envPath,
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), `.env.${process.env.NODE_ENV}`),
    resolve(process.cwd(), '.env'),
  ].filter(Boolean) as string[];

  for (const path of paths) {
    config({ path });
  }
}

/**
 * Get environment variable with optional default value
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

/**
 * Get environment variable as number
 */
export function getEnvAsNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
}

/**
 * Get environment variable as boolean
 */
export function getEnvAsBoolean(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get environment variable as array (comma-separated)
 */
export function getEnvAsArray(key: string, defaultValue?: string[]): string[] {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value.split(',').map(item => item.trim()).filter(Boolean);
}