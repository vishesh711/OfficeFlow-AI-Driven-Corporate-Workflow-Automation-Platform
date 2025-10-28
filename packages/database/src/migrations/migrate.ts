import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createAppConfig } from '@officeflow/config';

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

class MigrationRunner {
  private pool: Pool;

  constructor() {
    const config = createAppConfig('migration-runner');
    this.pool = new Pool({
      connectionString: config.database.url,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async initialize(): Promise<void> {
    // Create migrations table if it doesn't exist
    const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await this.pool.query(createMigrationsTable);
  }

  async getExecutedMigrations(): Promise<string[]> {
    const result = await this.pool.query('SELECT id FROM schema_migrations ORDER BY executed_at');
    return result.rows.map((row) => row.id);
  }

  async executeMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Execute the migration SQL
      await client.query(migration.sql);

      // Record the migration as executed
      await client.query('INSERT INTO schema_migrations (id, filename) VALUES ($1, $2)', [
        migration.id,
        migration.filename,
      ]);

      await client.query('COMMIT');
      console.log(`✓ Executed migration: ${migration.filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`✗ Failed to execute migration: ${migration.filename}`);
      throw error;
    } finally {
      client.release();
    }
  }

  async loadMigrations(): Promise<Migration[]> {
    const migrationsDir = join(__dirname, '../../migrations');
    const fs = require('fs');

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file: string) => file.endsWith('.sql'))
      .sort();

    return files.map((filename: string) => {
      const id = filename.replace('.sql', '');
      const sql = readFileSync(join(migrationsDir, filename), 'utf8');

      return {
        id,
        filename,
        sql,
      };
    });
  }

  async run(): Promise<void> {
    try {
      console.log('🚀 Starting database migrations...');

      await this.initialize();

      const allMigrations = await this.loadMigrations();
      const executedMigrations = await this.getExecutedMigrations();

      const pendingMigrations = allMigrations.filter(
        (migration) => !executedMigrations.includes(migration.id)
      );

      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations found. Database is up to date.');
        return;
      }

      console.log(`📋 Found ${pendingMigrations.length} pending migration(s):`);
      pendingMigrations.forEach((migration) => {
        console.log(`   - ${migration.filename}`);
      });

      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      console.log('✅ All migrations completed successfully!');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    } finally {
      await this.pool.end();
    }
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  const runner = new MigrationRunner();
  runner.run();
}

export { MigrationRunner };
