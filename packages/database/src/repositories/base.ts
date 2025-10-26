/**
 * Base repository implementation with common CRUD operations
 */

import { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { UUID } from '@officeflow/types';
import { db } from '../connection';

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface FilterOptions {
  [key: string]: any;
}

export abstract class BaseRepository<T extends { [key: string]: any }> {
  protected pool: Pool;
  protected tableName: string;
  protected primaryKey: string;
  protected createSchema: z.ZodSchema;
  protected updateSchema: z.ZodSchema;

  constructor(
    tableName: string,
    primaryKey: string,
    createSchema: z.ZodSchema,
    updateSchema: z.ZodSchema
  ) {
    this.pool = db.getPool();
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    this.createSchema = createSchema;
    this.updateSchema = updateSchema;
  }

  /**
   * Find entity by primary key
   */
  async findById(id: UUID): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all entities with optional filtering and pagination
   */
  async findAll(filters?: FilterOptions, options?: QueryOptions): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];
    let paramIndex = 1;

    // Add WHERE clause for filters
    if (filters && Object.keys(filters).length > 0) {
      const conditions: string[] = [];
      
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
            conditions.push(`${key} IN (${placeholders})`);
            params.push(...value);
          } else {
            conditions.push(`${key} = $${paramIndex++}`);
            params.push(value);
          }
        }
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    // Add ORDER BY clause
    if (options?.orderBy) {
      const direction = options.orderDirection || 'ASC';
      query += ` ORDER BY ${options.orderBy} ${direction}`;
    }

    // Add LIMIT and OFFSET
    if (options?.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Create new entity
   */
  async create(data: Omit<T, 'created_at' | 'updated_at'>): Promise<T> {
    // Validate input data
    const validatedData = this.createSchema.parse(data);
    
    // Generate UUID for primary key if not provided
    if (!validatedData[this.primaryKey]) {
      validatedData[this.primaryKey] = uuidv4();
    }

    // Add timestamps
    const now = new Date();
    validatedData.created_at = now;
    if ('updated_at' in validatedData) {
      validatedData.updated_at = now;
    }

    const columns = Object.keys(validatedData);
    const values = Object.values(validatedData);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update entity by primary key
   */
  async update(id: UUID, updates: Partial<T>): Promise<T | null> {
    // Validate update data
    const validatedUpdates = this.updateSchema.parse(updates);
    
    // Add updated_at timestamp if the table has this column
    if ('updated_at' in validatedUpdates) {
      validatedUpdates.updated_at = new Date();
    }

    const columns = Object.keys(validatedUpdates);
    const values = Object.values(validatedUpdates);
    
    if (columns.length === 0) {
      return this.findById(id);
    }

    const setClause = columns.map((col, index) => `${col} = $${index + 2}`).join(', ');
    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE ${this.primaryKey} = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [id, ...values]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete entity by primary key
   */
  async delete(id: UUID): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
    const result = await this.pool.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Count entities with optional filters
   */
  async count(filters?: FilterOptions): Promise<number> {
    let query = `SELECT COUNT(*) FROM ${this.tableName}`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters && Object.keys(filters).length > 0) {
      const conditions: string[] = [];
      
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          conditions.push(`${key} = $${paramIndex++}`);
          params.push(value);
        }
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Execute a transaction
   */
  async transaction<R>(callback: (client: PoolClient) => Promise<R>): Promise<R> {
    return db.transaction(callback);
  }

  /**
   * Execute raw SQL query
   */
  async query(sql: string, params?: any[]): Promise<any> {
    return this.pool.query(sql, params);
  }

  /**
   * Map database row to entity (override in subclasses for custom mapping)
   */
  protected mapRowToEntity(row: any): T {
    // Convert snake_case to camelCase and handle JSON fields
    const entity: any = {};
    
    for (const [key, value] of Object.entries(row)) {
      const camelKey = this.snakeToCamel(key);
      entity[camelKey] = value;
    }

    return entity as T;
  }

  /**
   * Convert snake_case to camelCase
   */
  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Convert camelCase to snake_case
   */
  protected camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}