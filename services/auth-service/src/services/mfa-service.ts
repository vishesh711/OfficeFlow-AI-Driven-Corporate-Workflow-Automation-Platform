import { speakeasy, QRCode } from '../utils/mock-dependencies';
import { generateId } from '@officeflow/shared';
import { authConfig } from '../config/auth-config';
import { User } from '../types/auth-types';

export class MfaService {
  /**
   * Generate MFA secret for a user
   */
  generateSecret(userEmail: string): { secret: string; otpauthUrl: string } {
    const secret = speakeasy.generateSecret({
      name: userEmail,
      issuer: authConfig.mfa.issuer,
      length: 32,
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url!,
    };
  }

  /**
   * Generate QR code for MFA setup
   */
  async generateQRCode(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  }

  /**
   * Verify MFA token
   */
  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: authConfig.mfa.window,
    });
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(providedCode: string, validCodes: string[]): boolean {
    return validCodes.includes(providedCode.toUpperCase());
  }

  /**
   * Generate recovery codes for account recovery
   */
  generateRecoveryCodes(count: number = 5): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate longer recovery codes (16 characters)
      const code = generateId().replace(/-/g, '').substring(0, 16).toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  /**
   * Check if MFA setup is required for user
   */
  isMfaSetupRequired(user: User): boolean {
    // MFA is required for admin and manager roles
    return ['admin', 'manager'].includes(user.role) && !user.mfaEnabled;
  }

  /**
   * Check if MFA is required for login
   */
  isMfaRequiredForLogin(user: User): boolean {
    return user.mfaEnabled;
  }

  /**
   * Generate time-based one-time password (for testing/debugging)
   */
  generateTOTP(secret: string): string {
    // Mock implementation - in production this would use speakeasy.totp()
    return '123456';
  }

  /**
   * Get remaining time for current TOTP window (in seconds)
   */
  getTOTPRemainingTime(): number {
    const now = Math.floor(Date.now() / 1000);
    const step = 30; // TOTP step is typically 30 seconds
    const timeInStep = now % step;
    return step - timeInStep;
  }

  /**
   * Validate MFA token format
   */
  isValidTokenFormat(token: string): boolean {
    // TOTP tokens are typically 6 digits
    return /^\d{6}$/.test(token);
  }

  /**
   * Validate backup code format
   */
  isValidBackupCodeFormat(code: string): boolean {
    // Backup codes are typically 8 alphanumeric characters
    return /^[A-Z0-9]{8}$/.test(code.toUpperCase());
  }
}
