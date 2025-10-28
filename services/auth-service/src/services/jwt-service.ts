import { jwt } from '../utils/mock-dependencies';
import { UUID } from '@officeflow/types';
import { generateId } from '@officeflow/shared';
import { authConfig } from '../config/auth-config';
import { JwtPayload, RefreshTokenPayload, User, AUTH_ERRORS } from '../types/auth-types';

export class JwtService {
  /**
   * Generate access token
   */
  generateAccessToken(user: User, sessionId: UUID): string {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: user.userId,
      orgId: user.orgId,
      email: user.email,
      role: user.role,
      sessionId,
    };

    return jwt.sign(payload, authConfig.jwt.secret, {
      expiresIn: authConfig.jwt.expiresIn,
      issuer: 'officeflow-auth',
      audience: 'officeflow-platform',
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId: UUID, sessionId: UUID, tokenVersion: number = 1): string {
    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      userId,
      sessionId,
      tokenVersion,
    };

    return jwt.sign(payload, authConfig.jwt.secret, {
      expiresIn: authConfig.jwt.refreshExpiresIn,
      issuer: 'officeflow-auth',
      audience: 'officeflow-refresh',
    });
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, authConfig.jwt.secret, {
        issuer: 'officeflow-auth',
        audience: 'officeflow-platform',
      }) as JwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error(AUTH_ERRORS.TOKEN_EXPIRED.message);
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(AUTH_ERRORS.INVALID_TOKEN.message);
      } else {
        throw new Error(AUTH_ERRORS.INVALID_TOKEN.message);
      }
    }
  }

  /**
   * Verify and decode refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, authConfig.jwt.secret, {
        issuer: 'officeflow-auth',
        audience: 'officeflow-refresh',
      }) as RefreshTokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error(AUTH_ERRORS.TOKEN_EXPIRED.message);
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(AUTH_ERRORS.INVALID_TOKEN.message);
      } else {
        throw new Error(AUTH_ERRORS.INVALID_TOKEN.message);
      }
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): any {
    return jwt.decode(token);
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;
    return expiration < new Date();
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(userId: UUID): string {
    const payload = {
      userId,
      type: 'password-reset',
      tokenId: generateId(),
    };

    return jwt.sign(payload, authConfig.jwt.secret, {
      expiresIn: '1h', // Password reset tokens expire in 1 hour
      issuer: 'officeflow-auth',
      audience: 'officeflow-password-reset',
    });
  }

  /**
   * Verify password reset token
   */
  verifyPasswordResetToken(token: string): { userId: UUID; tokenId: UUID } {
    try {
      const decoded = jwt.verify(token, authConfig.jwt.secret, {
        issuer: 'officeflow-auth',
        audience: 'officeflow-password-reset',
      }) as any;

      if (decoded.type !== 'password-reset') {
        throw new Error(AUTH_ERRORS.INVALID_RESET_TOKEN.message);
      }

      return {
        userId: decoded.userId,
        tokenId: decoded.tokenId,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error(AUTH_ERRORS.INVALID_RESET_TOKEN.message);
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(AUTH_ERRORS.INVALID_RESET_TOKEN.message);
      } else {
        throw error;
      }
    }
  }

  /**
   * Get time until token expires (in seconds)
   */
  getTimeUntilExpiration(token: string): number {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return 0;

    const now = new Date();
    const timeUntilExpiration = Math.floor((expiration.getTime() - now.getTime()) / 1000);

    return Math.max(0, timeUntilExpiration);
  }
}
