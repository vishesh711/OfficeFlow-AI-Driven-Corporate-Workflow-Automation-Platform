/**
 * OAuth2 integration types and interfaces
 */

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
}

export interface OAuth2Token {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: Date;
  scope?: string;
}

export interface OAuth2Credentials {
  id: string;
  organizationId: string;
  provider: IdentityProvider;
  tokens: OAuth2Token;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type IdentityProvider = 
  | 'okta'
  | 'google_workspace'
  | 'office365'
  | 'active_directory';

export interface ProviderConfig {
  provider: IdentityProvider;
  oauth2: OAuth2Config;
  apiBaseUrl: string;
  adminScopes: string[];
  userScopes: string[];
}

export interface TokenRefreshResult {
  success: boolean;
  tokens?: OAuth2Token;
  error?: string;
}

export interface OAuth2Client {
  getAuthorizationUrl(state?: string): string;
  exchangeCodeForTokens(code: string, state?: string): Promise<OAuth2Token>;
  refreshTokens(refreshToken: string): Promise<TokenRefreshResult>;
  revokeTokens(accessToken: string): Promise<boolean>;
  validateToken(accessToken: string): Promise<boolean>;
}