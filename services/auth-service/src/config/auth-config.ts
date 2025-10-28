import { AuthConfig } from '../types/auth-types';

export function loadAuthConfig(): AuthConfig {
  return {
    jwt: {
      secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    password: {
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
      minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
    },
    mfa: {
      issuer: process.env.MFA_ISSUER || 'OfficeFlow',
      window: parseInt(process.env.MFA_WINDOW || '2'),
    },
    session: {
      timeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30'),
      maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5'),
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      loginWindowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      loginMaxAttempts: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || '5'),
    },
  };
}

export const authConfig = loadAuthConfig();
