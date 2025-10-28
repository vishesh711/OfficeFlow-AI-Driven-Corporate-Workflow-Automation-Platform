/**
 * Generic OAuth2 client implementation
 */

import axios, { AxiosInstance } from 'axios';
import { OAuth2Client, OAuth2Config, OAuth2Token, TokenRefreshResult } from './types';
import { Logger } from 'winston';

export class GenericOAuth2Client implements OAuth2Client {
  private httpClient: AxiosInstance;
  private logger: Logger;

  constructor(
    private config: OAuth2Config,
    logger: Logger
  ) {
    this.logger = logger;
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });

    // Add request/response interceptors for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug('OAuth2 request', {
          method: config.method,
          url: config.url,
          headers: config.headers,
        });
        return config;
      },
      (error) => {
        this.logger.error('OAuth2 request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug('OAuth2 response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        this.logger.error('OAuth2 response error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.config.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, state?: string): Promise<OAuth2Token> {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
      });

      const response = await this.httpClient.post(this.config.tokenUrl, params);

      return this.parseTokenResponse(response.data);
    } catch (error) {
      this.logger.error('Failed to exchange code for tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: code.substring(0, 10) + '...', // Log partial code for debugging
      });
      throw new Error(
        `Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async refreshTokens(refreshToken: string): Promise<TokenRefreshResult> {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const response = await this.httpClient.post(this.config.tokenUrl, params);
      const tokens = this.parseTokenResponse(response.data);

      return {
        success: true,
        tokens,
      };
    } catch (error) {
      this.logger.error('Failed to refresh tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async revokeTokens(accessToken: string): Promise<boolean> {
    try {
      // Note: Revocation endpoint varies by provider
      // This is a generic implementation that may need provider-specific overrides
      const params = new URLSearchParams({
        token: accessToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      await this.httpClient.post(this.config.tokenUrl.replace('/token', '/revoke'), params);

      return true;
    } catch (error) {
      this.logger.error('Failed to revoke tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      if (!this.config.userInfoUrl) {
        // If no userinfo endpoint, assume token is valid if it exists
        return !!accessToken;
      }

      await this.httpClient.get(this.config.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return true;
    } catch (error) {
      this.logger.debug('Token validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  private parseTokenResponse(data: any): OAuth2Token {
    const expiresIn = parseInt(data.expires_in) || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type || 'Bearer',
      expiresIn,
      expiresAt,
      scope: data.scope,
    };
  }
}
