// Mock implementations for external dependencies to make the code compile
// In production, these would be replaced with actual npm packages

// Mock winston logger
export interface MockLogger {
  info: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

export const winston = {
  createLogger: (config: any): MockLogger => ({
    info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
    error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta || ''),
    warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta || ''),
    debug: (message: string, meta?: any) => console.debug(`[DEBUG] ${message}`, meta || ''),
  }),
  format: {
    combine: (...args: any[]) => args,
    timestamp: () => ({}),
    errors: (config: any) => config,
    json: () => ({}),
    simple: () => ({}),
  },
  transports: {
    Console: class Console {
      constructor(config?: any) {}
    },
    File: class File {
      constructor(config: any) {}
    },
  },
};

// Mock express-rate-limit
export const rateLimit = (config: any) => {
  return (req: any, res: any, next: any) => {
    // Simple mock - in production this would implement actual rate limiting
    next();
  };
};

// Mock express-slow-down
export const slowDown = (config: any) => {
  return (req: any, res: any, next: any) => {
    // Simple mock - in production this would implement request slowing
    next();
  };
};

// Mock bcrypt
export const bcrypt = {
  hash: async (password: string, rounds: number): Promise<string> => {
    // Simple mock - in production this would use actual bcrypt
    return `$2b$${rounds}$mock.hash.for.${password}`;
  },
  compare: async (password: string, hash: string): Promise<boolean> => {
    // Simple mock - in production this would use actual bcrypt
    return hash.includes(password);
  },
};

// Mock jsonwebtoken
export const jwt = {
  sign: (payload: any, secret: string, options?: any): string => {
    // Simple mock - in production this would use actual JWT
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payloadStr = Buffer.from(
      JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) })
    ).toString('base64');
    return `${header}.${payloadStr}.mock-signature`;
  },
  verify: (token: string, secret: string, options?: any): any => {
    // Simple mock - in production this would use actual JWT verification
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  },
  decode: (token: string): any => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(Buffer.from(parts[1], 'base64').toString());
    } catch (error) {
      return null;
    }
  },
  TokenExpiredError: class TokenExpiredError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TokenExpiredError';
    }
  },
  JsonWebTokenError: class JsonWebTokenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'JsonWebTokenError';
    }
  },
};

// Mock speakeasy
export const speakeasy = {
  generateSecret: (config: any) => ({
    base32: 'JBSWY3DPEHPK3PXP',
    otpauth_url: `otpauth://totp/${config.name}?secret=JBSWY3DPEHPK3PXP&issuer=${config.issuer}`,
  }),
  totp: {
    verify: (config: any): boolean => {
      // Simple mock - in production this would verify actual TOTP
      return config.token === '123456';
    },
  },
};

// Mock qrcode
export const QRCode = {
  toDataURL: async (text: string): Promise<string> => {
    // Simple mock - in production this would generate actual QR code
    return `data:image/png;base64,mock-qr-code-for-${Buffer.from(text).toString('base64')}`;
  },
};

// Mock joi
export const Joi = {
  object: (schema: any) => ({
    validate: (data: any) => {
      // Simple mock validation - in production this would use actual Joi
      return { error: null, value: data };
    },
  }),
  string: () => ({
    email: () => ({ required: () => ({}) }),
    min: (length: number) => ({ required: () => ({}) }),
    pattern: (regex: RegExp) => ({ required: () => ({}), optional: () => ({}) }),
    required: () => ({}),
  }),
  boolean: () => ({
    optional: () => ({}),
  }),
};
