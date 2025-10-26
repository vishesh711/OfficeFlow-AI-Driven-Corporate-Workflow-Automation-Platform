/**
 * Database-backed credential storage implementation
 */

import { Pool } from 'pg';
import { Logger } from 'winston';
import { CredentialStorage } from './credential-manager';
import { OAuth2Credentials, OAuth2Token, IdentityProvider } from '../oauth2/types';

export class DatabaseCredentialStorage implements CredentialStorage {
  private logger: Logger;

  constructor(
    private db: Pool,
    logger: Logger
  ) {
    this.logger = logger;
  }

  async store(credentials: OAuth2Credentials): Promise<void> {
    const query = `
      INSERT INTO oauth2_credentials (
        id, organization_id, provider, access_token, refresh_token, 
        token_type, expires_in, expires_at, scope, metadata, 
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (organization_id, provider) 
      DO UPDATE SET
        id = EXCLUDED.id,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_type = EXCLUDED.token_type,
        expires_in = EXCLUDED.expires_in,
        expires_at = EXCLUDED.expires_at,
        scope = EXCLUDED.scope,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
    `;

    const values = [
      credentials.id,
      credentials.organizationId,
      credentials.provider,
      credentials.tokens.accessToken,
      credentials.tokens.refreshToken,
      credentials.tokens.tokenType,
      credentials.tokens.expiresIn,
      credentials.tokens.expiresAt,
      credentials.tokens.scope,
      JSON.stringify(credentials.metadata),
      credentials.createdAt,
      credentials.updatedAt
    ];

    try {
      await this.db.query(query, values);
      
      this.logger.debug('Credentials stored in database', {
        credentialId: credentials.id,
        organizationId: credentials.organizationId,
        provider: credentials.provider
      });
    } catch (error) {
      this.logger.error('Failed to store credentials in database', {
        credentialId: credentials.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async retrieve(organizationId: string, provider: IdentityProvider): Promise<OAuth2Credentials | null> {
    const query = `
      SELECT id, organization_id, provider, access_token, refresh_token,
             token_type, expires_in, expires_at, scope, metadata,
             created_at, updated_at
      FROM oauth2_credentials
      WHERE organization_id = $1 AND provider = $2
    `;

    try {
      const result = await this.db.query(query, [organizationId, provider]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return this.mapRowToCredentials(row);
    } catch (error) {
      this.logger.error('Failed to retrieve credentials from database', {
        organizationId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async update(id: string, tokens: OAuth2Token): Promise<void> {
    const query = `
      UPDATE oauth2_credentials
      SET access_token = $2,
          refresh_token = $3,
          token_type = $4,
          expires_in = $5,
          expires_at = $6,
          scope = $7,
          updated_at = $8
      WHERE id = $1
    `;

    const values = [
      id,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.tokenType,
      tokens.expiresIn,
      tokens.expiresAt,
      tokens.scope,
      new Date()
    ];

    try {
      const result = await this.db.query(query, values);
      
      if (result.rowCount === 0) {
        throw new Error(`Credential with id ${id} not found`);
      }

      this.logger.debug('Credentials updated in database', { credentialId: id });
    } catch (error) {
      this.logger.error('Failed to update credentials in database', {
        credentialId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM oauth2_credentials WHERE id = $1';

    try {
      const result = await this.db.query(query, [id]);
      
      if (result.rowCount === 0) {
        throw new Error(`Credential with id ${id} not found`);
      }

      this.logger.debug('Credentials deleted from database', { credentialId: id });
    } catch (error) {
      this.logger.error('Failed to delete credentials from database', {
        credentialId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async list(organizationId: string): Promise<OAuth2Credentials[]> {
    const query = `
      SELECT id, organization_id, provider, access_token, refresh_token,
             token_type, expires_in, expires_at, scope, metadata,
             created_at, updated_at
      FROM oauth2_credentials
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.db.query(query, [organizationId]);
      
      return result.rows.map(row => this.mapRowToCredentials(row));
    } catch (error) {
      this.logger.error('Failed to list credentials from database', {
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private mapRowToCredentials(row: any): OAuth2Credentials {
    return {
      id: row.id,
      organizationId: row.organization_id,
      provider: row.provider as IdentityProvider,
      tokens: {
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        tokenType: row.token_type,
        expiresIn: row.expires_in,
        expiresAt: new Date(row.expires_at),
        scope: row.scope
      },
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}