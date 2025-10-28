/**
 * Integration account repository implementation
 */

import { IntegrationAccountEntity, IntegrationAccountRepository, UUID } from '@officeflow/types';
import { BaseRepository } from './base';
import {
  integrationAccountSchema,
  createIntegrationAccountSchema,
  updateIntegrationAccountSchema,
} from '../validation/schemas';

export class IntegrationAccountRepositoryImpl
  extends BaseRepository<IntegrationAccountEntity>
  implements IntegrationAccountRepository
{
  constructor() {
    super(
      'integration_accounts',
      'account_id',
      createIntegrationAccountSchema,
      updateIntegrationAccountSchema
    );
  }

  /**
   * Find integration accounts by organization
   */
  async findByOrganization(orgId: UUID): Promise<IntegrationAccountEntity[]> {
    return this.findAll(
      { org_id: orgId },
      {
        orderBy: 'created_at',
        orderDirection: 'DESC',
      }
    );
  }

  /**
   * Find integration accounts by provider
   */
  async findByProvider(orgId: UUID, provider: string): Promise<IntegrationAccountEntity[]> {
    return this.findAll(
      {
        org_id: orgId,
        provider,
      },
      {
        orderBy: 'created_at',
        orderDirection: 'DESC',
      }
    );
  }

  /**
   * Find active integration accounts by provider
   */
  async findActiveByProvider(orgId: UUID, provider: string): Promise<IntegrationAccountEntity[]> {
    return this.findAll(
      {
        org_id: orgId,
        provider,
        is_active: true,
      },
      {
        orderBy: 'created_at',
        orderDirection: 'DESC',
      }
    );
  }

  /**
   * Find integration account by provider and account name
   */
  async findByProviderAndName(
    orgId: UUID,
    provider: string,
    accountName: string
  ): Promise<IntegrationAccountEntity | null> {
    const query = `
      SELECT * FROM integration_accounts 
      WHERE org_id = $1 AND provider = $2 AND account_name = $3
    `;

    const result = await this.pool.query(query, [orgId, provider, accountName]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find expired integration accounts
   */
  async findExpired(): Promise<IntegrationAccountEntity[]> {
    const query = `
      SELECT * FROM integration_accounts 
      WHERE expires_at IS NOT NULL 
        AND expires_at < NOW()
        AND is_active = true
      ORDER BY expires_at ASC
    `;

    const result = await this.pool.query(query);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find accounts expiring soon
   */
  async findExpiringSoon(daysAhead: number = 7): Promise<IntegrationAccountEntity[]> {
    const query = `
      SELECT * FROM integration_accounts 
      WHERE expires_at IS NOT NULL 
        AND expires_at > NOW()
        AND expires_at <= NOW() + INTERVAL '${daysAhead} days'
        AND is_active = true
      ORDER BY expires_at ASC
    `;

    const result = await this.pool.query(query);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(accountId: UUID): Promise<void> {
    const query = `
      UPDATE integration_accounts 
      SET last_used_at = NOW(), updated_at = NOW()
      WHERE account_id = $1
    `;
    await this.pool.query(query, [accountId]);
  }

  /**
   * Activate/deactivate integration account
   */
  async setActive(accountId: UUID, isActive: boolean): Promise<IntegrationAccountEntity | null> {
    return this.update(accountId, { is_active: isActive });
  }

  /**
   * Get integration statistics for organization
   */
  async getIntegrationStats(orgId: UUID): Promise<{
    totalAccounts: number;
    activeAccounts: number;
    accountsByProvider: Array<{ provider: string; count: number }>;
    recentlyUsed: Array<{
      accountId: UUID;
      accountName: string;
      provider: string;
      lastUsedAt: Date;
    }>;
  }> {
    // Total and active accounts
    const statsQuery = `
      SELECT 
        COUNT(*) as total_accounts,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_accounts
      FROM integration_accounts 
      WHERE org_id = $1
    `;
    const statsResult = await this.pool.query(statsQuery, [orgId]);

    // Accounts by provider
    const providerQuery = `
      SELECT provider, COUNT(*) as count
      FROM integration_accounts 
      WHERE org_id = $1
      GROUP BY provider
      ORDER BY count DESC
    `;
    const providerResult = await this.pool.query(providerQuery, [orgId]);

    // Recently used accounts
    const recentQuery = `
      SELECT account_id, account_name, provider, last_used_at
      FROM integration_accounts 
      WHERE org_id = $1 
        AND last_used_at IS NOT NULL
        AND is_active = true
      ORDER BY last_used_at DESC
      LIMIT 10
    `;
    const recentResult = await this.pool.query(recentQuery, [orgId]);

    const stats = statsResult.rows[0];

    return {
      totalAccounts: parseInt(stats.total_accounts, 10),
      activeAccounts: parseInt(stats.active_accounts, 10),
      accountsByProvider: providerResult.rows.map((row) => ({
        provider: row.provider,
        count: parseInt(row.count, 10),
      })),
      recentlyUsed: recentResult.rows.map((row) => ({
        accountId: row.account_id,
        accountName: row.account_name,
        provider: row.provider,
        lastUsedAt: row.last_used_at,
      })),
    };
  }

  /**
   * Test integration account connectivity
   */
  async testConnection(accountId: UUID): Promise<{
    success: boolean;
    error?: string;
    responseTime?: number;
  }> {
    // This would typically call the actual integration service
    // For now, we'll just update the last_used_at timestamp
    const startTime = Date.now();

    try {
      await this.updateLastUsed(accountId);
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Rotate credentials for integration account
   */
  async rotateCredentials(
    accountId: UUID,
    newCredentials: Record<string, any>
  ): Promise<IntegrationAccountEntity | null> {
    // In a real implementation, you'd encrypt the credentials
    return this.update(accountId, {
      credentials: newCredentials,
      updated_at: new Date(),
    });
  }

  /**
   * Search integration accounts
   */
  async search(
    orgId: UUID,
    searchTerm: string,
    provider?: string
  ): Promise<IntegrationAccountEntity[]> {
    let query = `
      SELECT * FROM integration_accounts 
      WHERE org_id = $1 
        AND LOWER(account_name) LIKE LOWER($2)
    `;
    const params: any[] = [orgId, `%${searchTerm}%`];

    if (provider) {
      query += ' AND provider = $3';
      params.push(provider);
    }

    query += ' ORDER BY account_name LIMIT 50';

    const result = await this.pool.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }
}
