/**
 * Token refresh service for automatic token renewal
 */

import cron from 'node-cron';
import { Logger } from 'winston';
import { CredentialManager } from '../credentials/credential-manager';
import { GenericOAuth2Client } from './oauth2-client';
import { ProviderConfig, IdentityProvider } from './types';

export class TokenRefreshService {
  private refreshJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private logger: Logger;

  constructor(
    private credentialManager: CredentialManager,
    private providerConfigs: Map<IdentityProvider, ProviderConfig>,
    logger: Logger
  ) {
    this.logger = logger;
  }

  start(): void {
    if (this.isRunning) {
      this.logger.warn('Token refresh service is already running');
      return;
    }

    // Run every 30 minutes
    this.refreshJob = cron.schedule('*/30 * * * *', async () => {
      await this.refreshExpiredTokens();
    }, {
      scheduled: false
    });

    this.refreshJob.start();
    this.isRunning = true;

    this.logger.info('Token refresh service started');
  }

  stop(): void {
    if (this.refreshJob) {
      this.refreshJob.stop();
      this.refreshJob = null;
    }

    this.isRunning = false;
    this.logger.info('Token refresh service stopped');
  }

  async refreshExpiredTokens(): Promise<void> {
    this.logger.debug('Starting token refresh cycle');

    try {
      // Get all organizations (this would typically come from a database query)
      const organizations = await this.getOrganizations();

      for (const orgId of organizations) {
        await this.refreshTokensForOrganization(orgId);
      }

      this.logger.debug('Token refresh cycle completed');
    } catch (error) {
      this.logger.error('Error during token refresh cycle', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async refreshTokensForOrganization(organizationId: string): Promise<void> {
    try {
      const credentials = await this.credentialManager.listCredentials(organizationId);

      for (const credential of credentials) {
        if (this.credentialManager.isTokenExpiringSoon(credential.tokens, 10)) {
          await this.refreshCredentialTokens(credential.id, credential.provider);
        }
      }
    } catch (error) {
      this.logger.error('Failed to refresh tokens for organization', {
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async refreshCredentialTokens(credentialId: string, provider: IdentityProvider): Promise<boolean> {
    try {
      const providerConfig = this.providerConfigs.get(provider);
      if (!providerConfig) {
        this.logger.error('Provider config not found', { provider });
        return false;
      }

      // Get current credentials
      const credentials = await this.credentialManager.getCredentials('', provider);
      if (!credentials || !credentials.tokens.refreshToken) {
        this.logger.warn('No refresh token available for credential', { credentialId });
        return false;
      }

      // Create OAuth2 client and refresh tokens
      const oauth2Client = new GenericOAuth2Client(providerConfig.oauth2, this.logger);
      const refreshResult = await oauth2Client.refreshTokens(credentials.tokens.refreshToken);

      if (refreshResult.success && refreshResult.tokens) {
        // Update stored credentials with new tokens
        await this.credentialManager.updateTokens(credentialId, refreshResult.tokens);
        
        this.logger.info('Tokens refreshed successfully', {
          credentialId,
          provider,
          expiresAt: refreshResult.tokens.expiresAt
        });

        return true;
      } else {
        this.logger.error('Failed to refresh tokens', {
          credentialId,
          provider,
          error: refreshResult.error
        });

        return false;
      }
    } catch (error) {
      this.logger.error('Error refreshing credential tokens', {
        credentialId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  async forceRefreshTokens(organizationId: string, provider: IdentityProvider): Promise<boolean> {
    try {
      const credentials = await this.credentialManager.getCredentials(organizationId, provider);
      if (!credentials) {
        this.logger.error('Credentials not found for force refresh', {
          organizationId,
          provider
        });
        return false;
      }

      return await this.refreshCredentialTokens(credentials.id, provider);
    } catch (error) {
      this.logger.error('Error during force token refresh', {
        organizationId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  private async getOrganizations(): Promise<string[]> {
    // This would typically query the database for all organization IDs
    // For now, return an empty array as a placeholder
    // In a real implementation, this would be:
    // return await this.organizationRepository.getAllOrganizationIds();
    return [];
  }
}