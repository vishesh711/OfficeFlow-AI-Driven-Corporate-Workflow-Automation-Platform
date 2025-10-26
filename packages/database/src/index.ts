/**
 * Database package main exports
 */

// Connection and configuration
export { db, DatabaseConnection } from './connection';

// Migration system
export { MigrationRunner } from './migrations/migrate';

// Validation schemas
export * from './validation/schemas';

// Repositories
export * from './repositories';

// Seeding
export { DatabaseSeeder } from './seeds/seed';

// Re-export database types from types package
export type * from '@officeflow/types';