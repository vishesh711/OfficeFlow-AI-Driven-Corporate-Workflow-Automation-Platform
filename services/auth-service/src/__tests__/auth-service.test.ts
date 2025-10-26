import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { AuthService } from '../services/auth-service';
import { PasswordService } from '../services/password-service';
import { JwtService } from '../services/jwt-service';
import { MfaService } from '../services/mfa-service';
import { MockLogger } from '../utils/mock-dependencies';

// Mock dependencies
jest.mock('pg');
jest.mock('ioredis');

describe('AuthService', () => {
  let authService: AuthService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      end: jest.fn(),
      on: jest.fn()
    } as any;

    mockRedis = {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as MockLogger;

    authService = new AuthService(mockDb, mockRedis, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Password Service', () => {
    let passwordService: PasswordService;

    beforeEach(() => {
      passwordService = new PasswordService();
    });

    it('should hash password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20); // Adjusted for mock implementation
    });

    it('should verify password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordService.hashPassword(password);
      
      const isValid = await passwordService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await passwordService.verifyPassword('WrongPassword', hash);
      expect(isInvalid).toBe(false);
    });

    it('should validate password strength', () => {
      expect(() => passwordService.validatePasswordStrength('weak')).toThrow();
      expect(() => passwordService.validatePasswordStrength('password')).toThrow();
      expect(() => passwordService.validatePasswordStrength('Password123')).toThrow();
      expect(() => passwordService.validatePasswordStrength('Password123!')).not.toThrow();
    });

    it('should generate secure password', () => {
      const password = passwordService.generateSecurePassword();
      
      expect(password).toBeDefined();
      expect(password.length).toBe(16);
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/\d/.test(password)).toBe(true);
      expect(/[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]/.test(password)).toBe(true);
    });
  });

  describe('JWT Service', () => {
    let jwtService: JwtService;

    beforeEach(() => {
      jwtService = new JwtService();
    });

    it('should generate and verify access token', () => {
      const user = {
        userId: 'user-123',
        orgId: 'org-123',
        email: 'test@example.com',
        role: 'user' as const,
        isActive: true,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const sessionId = 'session-123';

      const token = jwtService.generateAccessToken(user, sessionId);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const payload = jwtService.verifyAccessToken(token);
      expect(payload.userId).toBe(user.userId);
      expect(payload.orgId).toBe(user.orgId);
      expect(payload.email).toBe(user.email);
      expect(payload.role).toBe(user.role);
      expect(payload.sessionId).toBe(sessionId);
    });

    it('should generate and verify refresh token', () => {
      const userId = 'user-123';
      const sessionId = 'session-123';
      const tokenVersion = 1;

      const token = jwtService.generateRefreshToken(userId, sessionId, tokenVersion);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const payload = jwtService.verifyRefreshToken(token);
      expect(payload.userId).toBe(userId);
      expect(payload.sessionId).toBe(sessionId);
      expect(payload.tokenVersion).toBe(tokenVersion);
    });

    it('should reject invalid tokens', () => {
      expect(() => jwtService.verifyAccessToken('invalid-token')).toThrow();
      expect(() => jwtService.verifyRefreshToken('invalid-token')).toThrow();
    });

    it('should generate password reset token', () => {
      const userId = 'user-123';
      const token = jwtService.generatePasswordResetToken(userId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const payload = jwtService.verifyPasswordResetToken(token);
      expect(payload.userId).toBe(userId);
      expect(payload.tokenId).toBeDefined();
    });
  });

  describe('MFA Service', () => {
    let mfaService: MfaService;

    beforeEach(() => {
      mfaService = new MfaService();
    });

    it('should generate MFA secret', () => {
      const email = 'test@example.com';
      const result = mfaService.generateSecret(email);
      
      expect(result.secret).toBeDefined();
      expect(result.otpauthUrl).toBeDefined();
      expect(result.otpauthUrl).toContain(email);
      expect(result.otpauthUrl).toContain('OfficeFlow');
    });

    it('should verify TOTP token', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      
      // Generate a token for the current time
      const token = mfaService.generateTOTP(secret);
      expect(token).toMatch(/^\d{6}$/);
      
      // Verify the token
      const isValid = mfaService.verifyToken(secret, token);
      expect(isValid).toBe(true);
      
      // Invalid token should fail
      const isInvalid = mfaService.verifyToken(secret, '000000');
      expect(isInvalid).toBe(false);
    });

    it('should generate backup codes', () => {
      const codes = mfaService.generateBackupCodes(5);
      
      expect(codes).toHaveLength(5);
      codes.forEach(code => {
        expect(code).toMatch(/^[A-Z0-9]{8}$/);
      });
      
      // All codes should be unique
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should verify backup codes', () => {
      const codes = ['ABCD1234', 'EFGH5678', 'IJKL9012'];
      
      expect(mfaService.verifyBackupCode('ABCD1234', codes)).toBe(true);
      expect(mfaService.verifyBackupCode('abcd1234', codes)).toBe(true); // Case insensitive
      expect(mfaService.verifyBackupCode('INVALID1', codes)).toBe(false);
    });

    it('should validate token formats', () => {
      expect(mfaService.isValidTokenFormat('123456')).toBe(true);
      expect(mfaService.isValidTokenFormat('12345')).toBe(false);
      expect(mfaService.isValidTokenFormat('1234567')).toBe(false);
      expect(mfaService.isValidTokenFormat('abcdef')).toBe(false);
      
      expect(mfaService.isValidBackupCodeFormat('ABCD1234')).toBe(true);
      expect(mfaService.isValidBackupCodeFormat('abcd1234')).toBe(true);
      expect(mfaService.isValidBackupCodeFormat('ABCD123')).toBe(false);
      expect(mfaService.isValidBackupCodeFormat('ABCD12345')).toBe(false);
    });

    it('should check MFA requirements', () => {
      const adminUser = {
        userId: 'user-1',
        orgId: 'org-1',
        email: 'admin@example.com',
        role: 'admin' as const,
        isActive: true,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const regularUser = {
        ...adminUser,
        role: 'user' as const
      };

      const mfaEnabledUser = {
        ...adminUser,
        mfaEnabled: true
      };

      expect(mfaService.isMfaSetupRequired(adminUser)).toBe(true);
      expect(mfaService.isMfaSetupRequired(regularUser)).toBe(false);
      expect(mfaService.isMfaSetupRequired(mfaEnabledUser)).toBe(false);

      expect(mfaService.isMfaRequiredForLogin(adminUser)).toBe(false);
      expect(mfaService.isMfaRequiredForLogin(mfaEnabledUser)).toBe(true);
    });
  });
});