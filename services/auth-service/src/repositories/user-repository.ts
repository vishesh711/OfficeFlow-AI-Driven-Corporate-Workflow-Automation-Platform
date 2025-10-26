import { Pool } from 'pg';
import { UUID } from '@officeflow/types';
import { User, UserRole } from '../types/auth-types';
import { MockLogger } from '../utils/mock-dependencies';

export class UserRepository {
  constructor(
    private db: Pool,
    private logger: MockLogger
  ) {}

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.db.query(`
        SELECT user_id, org_id, email, password_hash, first_name, last_name,
               role, is_active, last_login_at, mfa_enabled, mfa_setup_required,
               password_changed_at, failed_login_attempts, locked_until,
               created_at, updated_at
        FROM users
        WHERE email = $1
      `, [email.toLowerCase()]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      this.logger.error('Error finding user by email', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(userId: UUID): Promise<User | null> {
    try {
      const result = await this.db.query(`
        SELECT user_id, org_id, email, password_hash, first_name, last_name,
               role, is_active, last_login_at, mfa_enabled, mfa_setup_required,
               password_changed_at, failed_login_attempts, locked_until,
               created_at, updated_at
        FROM users
        WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      this.logger.error('Error finding user by ID', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create a new user
   */
  async create(userData: {
    orgId: UUID;
    email: string;
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
    mfaSetupRequired?: boolean;
  }): Promise<User> {
    try {
      const result = await this.db.query(`
        INSERT INTO users (
          org_id, email, password_hash, first_name, last_name, role,
          mfa_setup_required, password_changed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING user_id, org_id, email, password_hash, first_name, last_name,
                  role, is_active, last_login_at, mfa_enabled, mfa_setup_required,
                  password_changed_at, failed_login_attempts, locked_until,
                  created_at, updated_at
      `, [
        userData.orgId,
        userData.email.toLowerCase(),
        userData.passwordHash,
        userData.firstName,
        userData.lastName,
        userData.role,
        userData.mfaSetupRequired || false
      ]);

      const user = this.mapRowToUser(result.rows[0]);

      this.logger.info('User created', {
        userId: user.userId,
        email: user.email,
        role: user.role
      });

      return user;
    } catch (error) {
      this.logger.error('Error creating user', {
        email: userData.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update user password
   */
  async updatePassword(userId: UUID, passwordHash: string): Promise<void> {
    try {
      // Store old password in history
      await this.db.query(`
        INSERT INTO password_history (user_id, password_hash)
        SELECT user_id, password_hash
        FROM users
        WHERE user_id = $1
      `, [userId]);

      // Update password
      await this.db.query(`
        UPDATE users
        SET password_hash = $1, password_changed_at = NOW(), failed_login_attempts = 0, locked_until = NULL
        WHERE user_id = $2
      `, [passwordHash, userId]);

      this.logger.info('User password updated', { userId });
    } catch (error) {
      this.logger.error('Error updating user password', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update last login time
   */
  async updateLastLogin(userId: UUID): Promise<void> {
    try {
      await this.db.query(`
        UPDATE users
        SET last_login_at = NOW(), failed_login_attempts = 0, locked_until = NULL
        WHERE user_id = $1
      `, [userId]);
    } catch (error) {
      this.logger.error('Error updating last login', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Increment failed login attempts
   */
  async incrementFailedLoginAttempts(userId: UUID): Promise<void> {
    try {
      const result = await this.db.query(`
        UPDATE users
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE 
              WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '30 minutes'
              ELSE locked_until
            END
        WHERE user_id = $1
        RETURNING failed_login_attempts, locked_until
      `, [userId]);

      if (result.rows.length > 0) {
        const { failed_login_attempts, locked_until } = result.rows[0];
        this.logger.warn('Failed login attempt recorded', {
          userId,
          failedAttempts: failed_login_attempts,
          lockedUntil: locked_until
        });
      }
    } catch (error) {
      this.logger.error('Error incrementing failed login attempts', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Enable MFA for user
   */
  async enableMfa(userId: UUID): Promise<void> {
    try {
      await this.db.query(`
        UPDATE users
        SET mfa_enabled = true, mfa_setup_required = false
        WHERE user_id = $1
      `, [userId]);

      this.logger.info('MFA enabled for user', { userId });
    } catch (error) {
      this.logger.error('Error enabling MFA', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Disable MFA for user
   */
  async disableMfa(userId: UUID): Promise<void> {
    try {
      await this.db.query(`
        UPDATE users
        SET mfa_enabled = false
        WHERE user_id = $1
      `, [userId]);

      // Also remove MFA secrets
      await this.db.query(`
        DELETE FROM user_mfa_secrets
        WHERE user_id = $1
      `, [userId]);

      this.logger.info('MFA disabled for user', { userId });
    } catch (error) {
      this.logger.error('Error disabling MFA', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check if user is locked
   */
  async isUserLocked(userId: UUID): Promise<boolean> {
    try {
      const result = await this.db.query(`
        SELECT locked_until
        FROM users
        WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return false;
      }

      const lockedUntil = result.rows[0].locked_until;
      return lockedUntil && new Date(lockedUntil) > new Date();
    } catch (error) {
      this.logger.error('Error checking if user is locked', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get password history for user
   */
  async getPasswordHistory(userId: UUID, limit: number = 12): Promise<string[]> {
    try {
      const result = await this.db.query(`
        SELECT password_hash
        FROM password_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [userId, limit]);

      return result.rows.map(row => row.password_hash);
    } catch (error) {
      this.logger.error('Error getting password history', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Map database row to User object
   */
  private mapRowToUser(row: any): User {
    return {
      userId: row.user_id,
      orgId: row.org_id,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role as UserRole,
      isActive: row.is_active,
      lastLoginAt: row.last_login_at,
      mfaEnabled: row.mfa_enabled || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}