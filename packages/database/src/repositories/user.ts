/**
 * User repository implementation
 */

import { UserEntity, UserRepository, UUID } from '@officeflow/types';
import { BaseRepository } from './base';
import { userSchema, createUserSchema, updateUserSchema } from '../validation/schemas';

export class UserRepositoryImpl extends BaseRepository<UserEntity> implements UserRepository {
  constructor() {
    super('users', 'user_id', createUserSchema, updateUserSchema);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserEntity | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.pool.query(query, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find users by organization
   */
  async findByOrganization(orgId: UUID): Promise<UserEntity[]> {
    return this.findAll({ org_id: orgId });
  }

  /**
   * Find active users by organization
   */
  async findActiveByOrganization(orgId: UUID): Promise<UserEntity[]> {
    return this.findAll({
      org_id: orgId,
      is_active: true,
    });
  }

  /**
   * Find users by role
   */
  async findByRole(orgId: UUID, role: string): Promise<UserEntity[]> {
    return this.findAll({
      org_id: orgId,
      role,
    });
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: UUID): Promise<void> {
    const query = `
      UPDATE users 
      SET last_login_at = NOW(), updated_at = NOW()
      WHERE user_id = $1
    `;
    await this.pool.query(query, [userId]);
  }

  /**
   * Check if email is available within organization
   */
  async isEmailAvailable(email: string, orgId: UUID, excludeUserId?: UUID): Promise<boolean> {
    let query = 'SELECT COUNT(*) FROM users WHERE email = $1 AND org_id = $2';
    const params: any[] = [email, orgId];

    if (excludeUserId) {
      query += ' AND user_id != $3';
      params.push(excludeUserId);
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10) === 0;
  }

  /**
   * Deactivate user
   */
  async deactivate(userId: UUID): Promise<boolean> {
    const result = await this.update(userId, { is_active: false });
    return result !== null;
  }

  /**
   * Activate user
   */
  async activate(userId: UUID): Promise<boolean> {
    const result = await this.update(userId, { is_active: true });
    return result !== null;
  }
}
