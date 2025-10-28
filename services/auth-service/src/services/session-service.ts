import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { UUID } from '@officeflow/types';
import { generateId } from '@officeflow/shared';
import { authConfig } from '../config/auth-config';
import { UserSession } from '../types/auth-types';
import { MockLogger } from '../utils/mock-dependencies';

export class SessionService {
  constructor(
    private redis: Redis,
    private db: Pool,
    private logger: MockLogger
  ) {}

  /**
   * Create a new user session
   */
  async createSession(
    userId: UUID,
    deviceInfo: string,
    ipAddress: string,
    userAgent: string
  ): Promise<UserSession> {
    const sessionId = generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + authConfig.session.timeoutMinutes * 60 * 1000);

    // Check if user has too many active sessions
    const activeSessions = await this.getActiveSessions(userId);
    if (activeSessions.length >= authConfig.session.maxConcurrentSessions) {
      // Remove oldest session
      const oldestSession = activeSessions.sort(
        (a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime()
      )[0];
      await this.terminateSession(oldestSession.sessionId);
    }

    const session: UserSession = {
      sessionId,
      userId,
      deviceInfo,
      ipAddress,
      userAgent,
      isActive: true,
      lastActivityAt: now,
      expiresAt,
      createdAt: now,
    };

    // Store session in database
    await this.db.query(
      `
      INSERT INTO user_sessions (
        session_id, user_id, device_info, ip_address, user_agent,
        is_active, last_activity_at, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
      [
        session.sessionId,
        session.userId,
        session.deviceInfo,
        session.ipAddress,
        session.userAgent,
        session.isActive,
        session.lastActivityAt,
        session.expiresAt,
        session.createdAt,
      ]
    );

    // Store session in Redis for fast access
    await this.redis.setex(
      `session:${sessionId}`,
      authConfig.session.timeoutMinutes * 60,
      JSON.stringify(session)
    );

    // Add to user's active sessions set
    await this.redis.sadd(`user_sessions:${userId}`, sessionId);

    this.logger.info('Session created', {
      sessionId,
      userId,
      ipAddress,
      deviceInfo,
    });

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: UUID): Promise<UserSession | null> {
    // Try Redis first
    const cached = await this.redis.get(`session:${sessionId}`);
    if (cached) {
      const session = JSON.parse(cached) as UserSession;
      // Convert date strings back to Date objects
      session.lastActivityAt = new Date(session.lastActivityAt);
      session.expiresAt = new Date(session.expiresAt);
      session.createdAt = new Date(session.createdAt);
      return session;
    }

    // Fallback to database
    const result = await this.db.query(
      `
      SELECT session_id, user_id, device_info, ip_address, user_agent,
             is_active, last_activity_at, expires_at, created_at
      FROM user_sessions
      WHERE session_id = $1 AND is_active = true
    `,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const session: UserSession = {
      sessionId: row.session_id,
      userId: row.user_id,
      deviceInfo: row.device_info,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      isActive: row.is_active,
      lastActivityAt: row.last_activity_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };

    // Cache in Redis
    await this.redis.setex(
      `session:${sessionId}`,
      authConfig.session.timeoutMinutes * 60,
      JSON.stringify(session)
    );

    return session;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: UUID): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + authConfig.session.timeoutMinutes * 60 * 1000);

    // Update in database
    await this.db.query(
      `
      UPDATE user_sessions
      SET last_activity_at = $1, expires_at = $2
      WHERE session_id = $3 AND is_active = true
    `,
      [now, expiresAt, sessionId]
    );

    // Update in Redis
    const session = await this.getSession(sessionId);
    if (session) {
      session.lastActivityAt = now;
      session.expiresAt = expiresAt;

      await this.redis.setex(
        `session:${sessionId}`,
        authConfig.session.timeoutMinutes * 60,
        JSON.stringify(session)
      );
    }
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: UUID): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    // Mark as inactive in database
    await this.db.query(
      `
      UPDATE user_sessions
      SET is_active = false
      WHERE session_id = $1
    `,
      [sessionId]
    );

    // Remove from Redis
    await this.redis.del(`session:${sessionId}`);

    // Remove from user's active sessions set
    await this.redis.srem(`user_sessions:${session.userId}`, sessionId);

    this.logger.info('Session terminated', {
      sessionId,
      userId: session.userId,
    });
  }

  /**
   * Terminate all sessions for a user
   */
  async terminateAllUserSessions(userId: UUID): Promise<void> {
    const activeSessions = await this.getActiveSessions(userId);

    for (const session of activeSessions) {
      await this.terminateSession(session.sessionId);
    }

    this.logger.info('All user sessions terminated', { userId });
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessions(userId: UUID): Promise<UserSession[]> {
    const result = await this.db.query(
      `
      SELECT session_id, user_id, device_info, ip_address, user_agent,
             is_active, last_activity_at, expires_at, created_at
      FROM user_sessions
      WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
      ORDER BY last_activity_at DESC
    `,
      [userId]
    );

    return result.rows.map((row) => ({
      sessionId: row.session_id,
      userId: row.user_id,
      deviceInfo: row.device_info,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      isActive: row.is_active,
      lastActivityAt: row.last_activity_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  }

  /**
   * Validate session
   */
  async validateSession(sessionId: UUID): Promise<UserSession | null> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await this.terminateSession(sessionId);
      return null;
    }

    // Update activity
    await this.updateSessionActivity(sessionId);

    return session;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    const result = await this.db.query(`
      UPDATE user_sessions
      SET is_active = false
      WHERE expires_at < NOW() AND is_active = true
      RETURNING session_id, user_id
    `);

    for (const row of result.rows) {
      await this.redis.del(`session:${row.session_id}`);
      await this.redis.srem(`user_sessions:${row.user_id}`, row.session_id);
    }

    if (result.rowCount && result.rowCount > 0) {
      this.logger.info('Cleaned up expired sessions', { count: result.rowCount });
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    sessionsByUser: Record<string, number>;
  }> {
    const result = await this.db.query(`
      SELECT user_id, COUNT(*) as session_count
      FROM user_sessions
      WHERE is_active = true AND expires_at > NOW()
      GROUP BY user_id
    `);

    const sessionsByUser: Record<string, number> = {};
    let totalActiveSessions = 0;

    for (const row of result.rows) {
      sessionsByUser[row.user_id] = parseInt(row.session_count);
      totalActiveSessions += parseInt(row.session_count);
    }

    return {
      totalActiveSessions,
      sessionsByUser,
    };
  }
}
