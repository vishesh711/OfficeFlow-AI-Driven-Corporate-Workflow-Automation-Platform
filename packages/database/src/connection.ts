import { Pool, PoolClient, PoolConfig } from 'pg';
import { createAppConfig } from '@officeflow/config';

export interface DatabaseConfig {
  url: string;
  maxConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  ssl?: boolean;
}

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;
  private isConnected: boolean = false;

  private constructor() {
    const config = createAppConfig('database');
    const dbConfig: PoolConfig = {
      connectionString: config.database.url,
      max: config.database.maxConnections || 20,
      idleTimeoutMillis: config.database.idleTimeoutMs || 30000,
      connectionTimeoutMillis: config.database.connectionTimeoutMs || 2000,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    };

    this.pool = new Pool(dbConfig);
    this.setupEventHandlers();
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', (client: PoolClient) => {
      console.log('Database client connected');
      this.isConnected = true;
    });

    this.pool.on('error', (err: Error) => {
      console.error('Database pool error:', err);
      this.isConnected = false;
    });

    this.pool.on('remove', () => {
      console.log('Database client removed from pool');
    });
  }

  public async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      console.log('✅ Database connection established');
    } catch (error) {
      this.isConnected = false;
      console.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database connection:', error);
      throw error;
    }
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async getClient(): Promise<PoolClient> {
    if (!this.isConnected) {
      await this.connect();
    }
    return this.pool.connect();
  }

  public async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected) {
      await this.connect();
    }
    return this.pool.query(text, params);
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public isHealthy(): boolean {
    return this.isConnected && this.pool.totalCount > 0;
  }

  public getStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      isConnected: this.isConnected,
    };
  }
}

// Export singleton instance
export const db = DatabaseConnection.getInstance();
export { DatabaseConnection };
export default db;
