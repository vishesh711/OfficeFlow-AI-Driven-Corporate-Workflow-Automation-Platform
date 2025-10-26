/**
 * Credential management with encryption at rest
 */

import CryptoJS from 'crypto-js';
import { Logger } from 'winston';
import { OAuth2Credentials, OAuth2Token, IdentityProvider } from '../oauth2/types';

export interface CredentialStorage {
  store(credentials: OAuth2Credentials): Promise<void>;
  retrieve(organizationId: string, provider: IdentityProvider): Promise<OAuth2Credentials | null>;
  update(id: string, tokens: OAuth2Token): Promise<void>;
  delete(id: string): Promise<void>;
  list(organizationId: string): Promise<OAuth2Credentials[]>;
}

export class CredentialManager {
  private encryptionKey: string;
  private logger: Logger;

  constructor(
    private storage: CredentialStorage,
    encryptionKey: string,
    logger: Logger
  ) {
    this.encryptionKey = encryptionKey;
    this.logger = logger;

    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters long');
    }
  }

  async storeCredentials(
    organizationId: string,
    provider: IdentityProvider,
    tokens: OAuth2Token,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      const credentials: OAuth2Credentials = {
        id: this.generateCredentialId(),
        organizationId,
        provider,
        tokens: this.encryptTokens(tokens),
        metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.storage.store(credentials);
      
      this.logger.info('Credentials stored successfully', {
        organizationId,
        provider,
        credentialId: credentials.id
      });

      return credentials.id;
    } catch (error) {
      this.logger.error('Failed to store credentials', {
        organizationId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getCredentials(
    organizationId: string,
    provider: IdentityProvider
  ): Promise<OAuth2Credentials | null> {
    try {
      const credentials = await this.storage.retrieve(organizationId, provider);
      
      if (!credentials) {
        return null;
      }

      // Decrypt tokens before returning
      credentials.tokens = this.decryptTokens(credentials.tokens);
      
      return credentials;
    } catch (error) {
      this.logger.error('Failed to retrieve credentials', {
        organizationId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateTokens(
    credentialId: string,
    tokens: OAuth2Token
  ): Promise<void> {
    try {
      const encryptedTokens = this.encryptTokens(tokens);
      await this.storage.update(credentialId, encryptedTokens);
      
      this.logger.info('Tokens updated successfully', {
        credentialId
      });
    } catch (error) {
      this.logger.error('Failed to update tokens', {
        credentialId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async deleteCredentials(credentialId: string): Promise<void> {
    try {
      await this.storage.delete(credentialId);
      
      this.logger.info('Credentials deleted successfully', {
        credentialId
      });
    } catch (error) {
      this.logger.error('Failed to delete credentials', {
        credentialId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async listCredentials(organizationId: string): Promise<OAuth2Credentials[]> {
    try {
      const credentialsList = await this.storage.list(organizationId);
      
      // Decrypt tokens for all credentials
      return credentialsList.map(cred => ({
        ...cred,
        tokens: this.decryptTokens(cred.tokens)
      }));
    } catch (error) {
      this.logger.error('Failed to list credentials', {
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  isTokenExpired(tokens: OAuth2Token): boolean {
    return new Date() >= tokens.expiresAt;
  }

  isTokenExpiringSoon(tokens: OAuth2Token, bufferMinutes: number = 5): boolean {
    const bufferMs = bufferMinutes * 60 * 1000;
    return new Date(Date.now() + bufferMs) >= tokens.expiresAt;
  }

  private encryptTokens(tokens: OAuth2Token): OAuth2Token {
    return {
      ...tokens,
      accessToken: this.encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? this.encrypt(tokens.refreshToken) : undefined
    };
  }

  private decryptTokens(tokens: OAuth2Token): OAuth2Token {
    return {
      ...tokens,
      accessToken: this.decrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? this.decrypt(tokens.refreshToken) : undefined
    };
  }

  private encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
  }

  private decrypt(encryptedText: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  private generateCredentialId(): string {
    return `cred_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}