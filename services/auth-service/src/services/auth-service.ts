import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { UUID } from '@officeflow/types';
import { generateId } from '@officeflow/shared';
import { MockLogger } from '../utils/mock-dependencies';

import { UserRepository } from '../repositories/user-repository';
import { PasswordService } from './password-service';
import { JwtService } from './jwt-service';
import { MfaService } from './mfa-service';
import { SessionService } from './session-service';
import { RbacService } from './rbac-service';
import { authConfig } from '../config/auth-config';

import {
  User,
  PublicUser,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ChangePasswordRequest,
  ResetPasswordRequest,
  ResetPasswordConfirmRequest,
  MfaSetupRequest,
  MfaSetupResponse,
  MfaVerifyRequest,
  MfaDisableRequest,
  AUTH_ERRORS,
} from '../types/auth-types';

export class AuthService {
  private userRepository: UserRepository;
  private passwordService: PasswordService;
  private jwtService: JwtService;
  private mfaService: MfaService;
  private sessionService: SessionService;
  private rbacService: RbacService;

  constructor(
    private db: Pool,
    private redis: Redis,
    private logger: MockLogger
  ) {
    this.userRepository = new UserRepository(db, logger);
    this.passwordService = new PasswordService();
    this.jwtService = new JwtService();
    this.mfaService = new MfaService();
    this.sessionService = new SessionService(redis, db, logger);
    this.rbacService = new RbacService(db, logger);
  }

  /**
   * Register a new user
   */
  async register(
    registerRequest: { email: string; password: string; name: string; organizationName?: string },
    ipAddress: string,
    userAgent: string
  ): Promise<LoginResponse> {
    const { email, password, name, organizationName } = registerRequest;

    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await this.passwordService.hashPassword(password);

      // Create organization ID (for now, use a generated ID or find existing)
      // First, check if we have any organizations
      const orgResult = await this.db.query('SELECT org_id FROM organizations LIMIT 1');
      const organizationId = orgResult.rows.length > 0 ? orgResult.rows[0].org_id : generateId();

      // If no org exists, create a default one
      if (orgResult.rows.length === 0) {
        // Extract domain from email or use a default
        const emailDomain = email.split('@')[1] || 'default.local';
        await this.db.query(
          'INSERT INTO organizations (org_id, name, domain, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
          [organizationId, organizationName || 'Default Organization', emailDomain]
        );
      }

      // Split name into first and last
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      // Create user directly with SQL to match existing schema
      const userId = generateId();
      await this.db.query(
        `INSERT INTO users (
          user_id, org_id, email, password_hash, first_name, last_name, 
          role, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [userId, organizationId, email, passwordHash, firstName, lastName, 'user', true]
      );

      this.logger.info('User registered successfully', { userId, email });

      // Auto-login after registration
      return this.login({ email, password }, ipAddress, userAgent);
    } catch (error) {
      this.logger.error('Registration failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email,
      });
      throw error;
    }
  }

  /**
   * Authenticate user and generate tokens
   */
  async login(
    loginRequest: LoginRequest,
    ipAddress: string,
    userAgent: string
  ): Promise<LoginResponse> {
    const { email, password, mfaToken, rememberMe } = loginRequest;

    try {
      // Find user by email
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        await this.logLoginAttempt(email, ipAddress, userAgent, false, 'USER_NOT_FOUND');
        throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS.message);
      }

      // Check if user is active
      if (!user.isActive) {
        await this.logLoginAttempt(email, ipAddress, userAgent, false, 'USER_INACTIVE');
        throw new Error(AUTH_ERRORS.USER_INACTIVE.message);
      }

      // Check if user is locked
      const isLocked = await this.userRepository.isUserLocked(user.userId);
      if (isLocked) {
        await this.logLoginAttempt(email, ipAddress, userAgent, false, 'USER_LOCKED');
        throw new Error(AUTH_ERRORS.RATE_LIMIT_EXCEEDED.message);
      }

      // Verify password
      if (!user.passwordHash) {
        await this.logLoginAttempt(email, ipAddress, userAgent, false, 'NO_PASSWORD');
        throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS.message);
      }

      const isPasswordValid = await this.passwordService.verifyPassword(
        password,
        user.passwordHash
      );
      if (!isPasswordValid) {
        await this.userRepository.incrementFailedLoginAttempts(user.userId);
        await this.logLoginAttempt(email, ipAddress, userAgent, false, 'INVALID_PASSWORD');
        throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS.message);
      }

      // Check if MFA setup is required
      if (this.mfaService.isMfaSetupRequired(user)) {
        await this.logLoginAttempt(email, ipAddress, userAgent, false, 'MFA_SETUP_REQUIRED');
        return {
          accessToken: '',
          refreshToken: '',
          user: this.toPublicUser(user),
          expiresIn: 0,
          mfaSetupRequired: true,
        };
      }

      // Check if MFA is required
      if (this.mfaService.isMfaRequiredForLogin(user)) {
        if (!mfaToken) {
          await this.logLoginAttempt(email, ipAddress, userAgent, false, 'MFA_REQUIRED', true);
          return {
            accessToken: '',
            refreshToken: '',
            user: this.toPublicUser(user),
            expiresIn: 0,
            mfaRequired: true,
          };
        }

        // Verify MFA token
        const mfaValid = await this.verifyMfaToken(user.userId, mfaToken);
        if (!mfaValid) {
          await this.userRepository.incrementFailedLoginAttempts(user.userId);
          await this.logLoginAttempt(
            email,
            ipAddress,
            userAgent,
            false,
            'INVALID_MFA_TOKEN',
            true,
            false
          );
          throw new Error(AUTH_ERRORS.INVALID_MFA_TOKEN.message);
        }
      }

      // Create session
      const deviceInfo = this.extractDeviceInfo(userAgent);
      const session = await this.sessionService.createSession(
        user.userId,
        deviceInfo,
        ipAddress,
        userAgent
      );

      // Generate tokens
      const accessToken = this.jwtService.generateAccessToken(user, session.sessionId);
      const refreshToken = this.jwtService.generateRefreshToken(user.userId, session.sessionId);

      // Update last login
      await this.userRepository.updateLastLogin(user.userId);

      // Log successful login
      await this.logLoginAttempt(
        email,
        ipAddress,
        userAgent,
        true,
        null,
        this.mfaService.isMfaRequiredForLogin(user),
        this.mfaService.isMfaRequiredForLogin(user) ? true : undefined
      );

      const expiresIn = this.jwtService.getTimeUntilExpiration(accessToken);

      this.logger.info('User logged in successfully', {
        userId: user.userId,
        email: user.email,
        sessionId: session.sessionId,
        ipAddress,
        mfaUsed: this.mfaService.isMfaRequiredForLogin(user),
      });

      return {
        accessToken,
        refreshToken,
        user: this.toPublicUser(user),
        expiresIn,
      };
    } catch (error) {
      this.logger.error('Login failed', {
        email,
        ipAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    try {
      const { refreshToken } = request;

      // Verify refresh token
      const payload = this.jwtService.verifyRefreshToken(refreshToken);

      // Validate session
      const session = await this.sessionService.validateSession(payload.sessionId);
      if (!session) {
        throw new Error(AUTH_ERRORS.SESSION_EXPIRED.message);
      }

      // Get user
      const user = await this.userRepository.findById(payload.userId);
      if (!user || !user.isActive) {
        throw new Error(AUTH_ERRORS.USER_NOT_FOUND.message);
      }

      // Generate new tokens
      const newAccessToken = this.jwtService.generateAccessToken(user, session.sessionId);
      const newRefreshToken = this.jwtService.generateRefreshToken(
        user.userId,
        session.sessionId,
        payload.tokenVersion + 1
      );

      const expiresIn = this.jwtService.getTimeUntilExpiration(newAccessToken);

      this.logger.info('Token refreshed', {
        userId: user.userId,
        sessionId: session.sessionId,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn,
      };
    } catch (error) {
      this.logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(sessionId: UUID): Promise<void> {
    try {
      await this.sessionService.terminateSession(sessionId);

      this.logger.info('User logged out', { sessionId });
    } catch (error) {
      this.logger.error('Logout failed', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Logout from all sessions
   */
  async logoutAll(userId: UUID): Promise<void> {
    try {
      await this.sessionService.terminateAllUserSessions(userId);

      this.logger.info('User logged out from all sessions', { userId });
    } catch (error) {
      this.logger.error('Logout all failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: UUID, request: ChangePasswordRequest): Promise<void> {
    try {
      const { currentPassword, newPassword } = request;

      // Get user
      const user = await this.userRepository.findById(userId);
      if (!user || !user.passwordHash) {
        throw new Error(AUTH_ERRORS.USER_NOT_FOUND.message);
      }

      // Verify current password
      const isCurrentPasswordValid = await this.passwordService.verifyPassword(
        currentPassword,
        user.passwordHash
      );
      if (!isCurrentPasswordValid) {
        throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS.message);
      }

      // Check password history to prevent reuse
      const passwordHistory = await this.userRepository.getPasswordHistory(userId);
      for (const oldPasswordHash of passwordHistory) {
        const isReused = await this.passwordService.verifyPassword(newPassword, oldPasswordHash);
        if (isReused) {
          throw new Error(AUTH_ERRORS.PASSWORD_REUSE.message);
        }
      }

      // Hash new password
      const newPasswordHash = await this.passwordService.hashPassword(newPassword);

      // Update password
      await this.userRepository.updatePassword(userId, newPasswordHash);

      // Terminate all other sessions (force re-login)
      await this.sessionService.terminateAllUserSessions(userId);

      this.logger.info('Password changed successfully', { userId });
    } catch (error) {
      this.logger.error('Password change failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Setup MFA for user
   */
  async setupMfa(userId: UUID, request: MfaSetupRequest): Promise<MfaSetupResponse> {
    try {
      const { password } = request;

      // Get user
      const user = await this.userRepository.findById(userId);
      if (!user || !user.passwordHash) {
        throw new Error(AUTH_ERRORS.USER_NOT_FOUND.message);
      }

      // Verify password
      const isPasswordValid = await this.passwordService.verifyPassword(
        password,
        user.passwordHash
      );
      if (!isPasswordValid) {
        throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS.message);
      }

      // Generate MFA secret
      const { secret, otpauthUrl } = this.mfaService.generateSecret(user.email);

      // Generate QR code
      const qrCode = await this.mfaService.generateQRCode(otpauthUrl);

      // Generate backup codes
      const backupCodes = this.mfaService.generateBackupCodes();

      // Store encrypted secret and backup codes
      await this.storeMfaSecret(userId, secret, backupCodes);

      this.logger.info('MFA setup initiated', { userId });

      return {
        secret,
        qrCode,
        backupCodes,
      };
    } catch (error) {
      this.logger.error('MFA setup failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Verify MFA setup
   */
  async verifyMfaSetup(userId: UUID, request: MfaVerifyRequest): Promise<void> {
    try {
      const { token } = request;

      // Get MFA secret
      const secret = await this.getMfaSecret(userId);
      if (!secret) {
        throw new Error(AUTH_ERRORS.INVALID_MFA_TOKEN.message);
      }

      // Verify token
      const isValid = this.mfaService.verifyToken(secret, token);
      if (!isValid) {
        throw new Error(AUTH_ERRORS.INVALID_MFA_TOKEN.message);
      }

      // Enable MFA for user
      await this.userRepository.enableMfa(userId);

      // Mark MFA secret as verified
      await this.db.query(
        `
        UPDATE user_mfa_secrets
        SET is_verified = true
        WHERE user_id = $1
      `,
        [userId]
      );

      this.logger.info('MFA setup completed', { userId });
    } catch (error) {
      this.logger.error('MFA verification failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Disable MFA for user
   */
  async disableMfa(userId: UUID, request: MfaDisableRequest): Promise<void> {
    try {
      const { password, mfaToken } = request;

      // Get user
      const user = await this.userRepository.findById(userId);
      if (!user || !user.passwordHash) {
        throw new Error(AUTH_ERRORS.USER_NOT_FOUND.message);
      }

      // Verify password
      const isPasswordValid = await this.passwordService.verifyPassword(
        password,
        user.passwordHash
      );
      if (!isPasswordValid) {
        throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS.message);
      }

      // Verify MFA token
      const mfaValid = await this.verifyMfaToken(userId, mfaToken);
      if (!mfaValid) {
        throw new Error(AUTH_ERRORS.INVALID_MFA_TOKEN.message);
      }

      // Disable MFA
      await this.userRepository.disableMfa(userId);

      this.logger.info('MFA disabled', { userId });
    } catch (error) {
      this.logger.error('MFA disable failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Verify MFA token for user
   */
  private async verifyMfaToken(userId: UUID, token: string): Promise<boolean> {
    try {
      // Get MFA secret
      const secret = await this.getMfaSecret(userId);
      if (!secret) {
        return false;
      }

      // Try regular TOTP token first
      if (this.mfaService.isValidTokenFormat(token)) {
        return this.mfaService.verifyToken(secret, token);
      }

      // Try backup code
      if (this.mfaService.isValidBackupCodeFormat(token)) {
        const backupCodes = await this.getBackupCodes(userId);
        const isValid = this.mfaService.verifyBackupCode(token, backupCodes);

        if (isValid) {
          // Remove used backup code
          await this.removeBackupCode(userId, token);
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('MFA token verification failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Store MFA secret and backup codes (encrypted)
   */
  private async storeMfaSecret(userId: UUID, secret: string, backupCodes: string[]): Promise<void> {
    // In a real implementation, these would be encrypted
    // For now, we'll store them as-is but in production, use proper encryption
    await this.db.query(
      `
      INSERT INTO user_mfa_secrets (user_id, secret_encrypted, backup_codes_encrypted)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        secret_encrypted = $2,
        backup_codes_encrypted = $3,
        updated_at = NOW()
    `,
      [userId, secret, backupCodes]
    );
  }

  /**
   * Get MFA secret for user
   */
  private async getMfaSecret(userId: UUID): Promise<string | null> {
    const result = await this.db.query(
      `
      SELECT secret_encrypted
      FROM user_mfa_secrets
      WHERE user_id = $1 AND is_verified = true
    `,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0].secret_encrypted : null;
  }

  /**
   * Get backup codes for user
   */
  private async getBackupCodes(userId: UUID): Promise<string[]> {
    const result = await this.db.query(
      `
      SELECT backup_codes_encrypted
      FROM user_mfa_secrets
      WHERE user_id = $1 AND is_verified = true
    `,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0].backup_codes_encrypted || [] : [];
  }

  /**
   * Remove used backup code
   */
  private async removeBackupCode(userId: UUID, usedCode: string): Promise<void> {
    const backupCodes = await this.getBackupCodes(userId);
    const updatedCodes = backupCodes.filter((code) => code !== usedCode.toUpperCase());

    await this.db.query(
      `
      UPDATE user_mfa_secrets
      SET backup_codes_encrypted = $1
      WHERE user_id = $2
    `,
      [updatedCodes, userId]
    );
  }

  /**
   * Log login attempt
   */
  private async logLoginAttempt(
    email: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    failureReason?: string | null,
    mfaRequired?: boolean,
    mfaSuccess?: boolean
  ): Promise<void> {
    try {
      await this.db.query(
        `
        INSERT INTO login_attempts (
          email, ip_address, user_agent, success, failure_reason,
          mfa_required, mfa_success
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
        [email, ipAddress, userAgent, success, failureReason, mfaRequired, mfaSuccess]
      );
    } catch (error) {
      this.logger.error('Failed to log login attempt', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Extract device info from user agent
   */
  private extractDeviceInfo(userAgent: string): string {
    // Simple device detection - in production, use a proper user agent parser
    if (userAgent.includes('Mobile')) {
      return 'Mobile Device';
    } else if (userAgent.includes('Tablet')) {
      return 'Tablet';
    } else {
      return 'Desktop';
    }
  }

  /**
   * Convert User to PublicUser (remove sensitive fields)
   */
  private toPublicUser(user: User): PublicUser {
    return {
      userId: user.userId,
      orgId: user.orgId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      mfaEnabled: user.mfaEnabled,
    };
  }
}
