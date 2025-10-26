import crypto from 'crypto';
import { logger } from './logger';

export class SignatureVerifier {
  /**
   * Verify HMAC SHA256 signature (used by most webhook providers)
   */
  static verifyHmacSha256(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');
      
      // Handle different signature formats
      const cleanSignature = signature.replace(/^sha256=/, '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(cleanSignature, 'hex')
      );
    } catch (error) {
      logger.error('Error verifying HMAC SHA256 signature', { error, signature });
      return false;
    }
  }

  /**
   * Verify HMAC SHA1 signature (used by some legacy systems)
   */
  static verifyHmacSha1(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha1', secret)
        .update(payload, 'utf8')
        .digest('hex');
      
      const cleanSignature = signature.replace(/^sha1=/, '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(cleanSignature, 'hex')
      );
    } catch (error) {
      logger.error('Error verifying HMAC SHA1 signature', { error, signature });
      return false;
    }
  }

  /**
   * Verify signature based on source system
   */
  static verifySignature(payload: string, signature: string, secret: string, source: string): boolean {
    switch (source.toLowerCase()) {
      case 'workday':
        return this.verifyHmacSha256(payload, signature, secret);
      case 'successfactors':
        return this.verifyHmacSha256(payload, signature, secret);
      case 'bamboohr':
        return this.verifyHmacSha256(payload, signature, secret);
      case 'generic':
        return this.verifyHmacSha256(payload, signature, secret);
      default:
        logger.warn('Unknown source for signature verification', { source });
        return this.verifyHmacSha256(payload, signature, secret);
    }
  }

  /**
   * Generate signature for testing purposes
   */
  static generateSignature(payload: string, secret: string, algorithm: 'sha256' | 'sha1' = 'sha256'): string {
    return crypto
      .createHmac(algorithm, secret)
      .update(payload, 'utf8')
      .digest('hex');
  }
}