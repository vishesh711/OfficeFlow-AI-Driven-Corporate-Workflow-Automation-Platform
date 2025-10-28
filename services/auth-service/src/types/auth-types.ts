import { UUID } from '@officeflow/types';

export interface User {
  userId: UUID;
  orgId: UUID;
  email: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  mfaEnabled: boolean;
  mfaSecret?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'manager' | 'user' | 'viewer';

export interface LoginRequest {
  email: string;
  password: string;
  mfaToken?: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
  expiresIn: number;
  mfaRequired?: boolean;
  mfaSetupRequired?: boolean;
}

export interface PublicUser {
  userId: UUID;
  orgId: UUID;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  mfaEnabled: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ResetPasswordConfirmRequest {
  token: string;
  newPassword: string;
}

export interface MfaSetupRequest {
  password: string;
}

export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MfaVerifyRequest {
  token: string;
  backupCode?: string;
}

export interface MfaDisableRequest {
  password: string;
  mfaToken: string;
}

export interface JwtPayload {
  userId: UUID;
  orgId: UUID;
  email: string;
  role: UserRole;
  sessionId: UUID;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: UUID;
  sessionId: UUID;
  tokenVersion: number;
  iat: number;
  exp: number;
}

export interface UserSession {
  sessionId: UUID;
  userId: UUID;
  deviceInfo: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface PasswordResetToken {
  tokenId: UUID;
  userId: UUID;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export interface AuthConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  password: {
    bcryptRounds: number;
    minLength: number;
  };
  mfa: {
    issuer: string;
    window: number;
  };
  session: {
    timeoutMinutes: number;
    maxConcurrentSessions: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    loginWindowMs: number;
    loginMaxAttempts: number;
  };
}

export interface AuthError {
  code: string;
  message: string;
  statusCode: number;
}

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
    statusCode: 401,
  },
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: 'User not found',
    statusCode: 404,
  },
  USER_INACTIVE: {
    code: 'USER_INACTIVE',
    message: 'User account is inactive',
    statusCode: 401,
  },
  MFA_REQUIRED: {
    code: 'MFA_REQUIRED',
    message: 'Multi-factor authentication required',
    statusCode: 401,
  },
  INVALID_MFA_TOKEN: {
    code: 'INVALID_MFA_TOKEN',
    message: 'Invalid MFA token',
    statusCode: 401,
  },
  MFA_SETUP_REQUIRED: {
    code: 'MFA_SETUP_REQUIRED',
    message: 'MFA setup required for this account',
    statusCode: 401,
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    message: 'Invalid or expired token',
    statusCode: 401,
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: 'Token has expired',
    statusCode: 401,
  },
  SESSION_EXPIRED: {
    code: 'SESSION_EXPIRED',
    message: 'Session has expired',
    statusCode: 401,
  },
  TOO_MANY_SESSIONS: {
    code: 'TOO_MANY_SESSIONS',
    message: 'Maximum concurrent sessions exceeded',
    statusCode: 429,
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later',
    statusCode: 429,
  },
  WEAK_PASSWORD: {
    code: 'WEAK_PASSWORD',
    message: 'Password does not meet security requirements',
    statusCode: 400,
  },
  PASSWORD_REUSE: {
    code: 'PASSWORD_REUSE',
    message: 'Cannot reuse recent passwords',
    statusCode: 400,
  },
  INVALID_RESET_TOKEN: {
    code: 'INVALID_RESET_TOKEN',
    message: 'Invalid or expired reset token',
    statusCode: 400,
  },
} as const;
