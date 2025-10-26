/**
 * Mock types for testing
 */

export interface NodeInput {
  operation: string;
  provider: string;
  userId?: string;
  email?: string;
  groupId?: string;
  roleId?: string;
  credentials?: any;
  [key: string]: any;
}

export interface NodeOutput {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export interface MockCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
}

export interface MockUser {
  id: string;
  email: string;
  name: string;
  roles?: string[];
  groups?: string[];
}

export interface MockGroup {
  id: string;
  name: string;
  description?: string;
  members?: string[];
}