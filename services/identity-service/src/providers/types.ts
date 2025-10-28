/**
 * Identity provider adapter types and interfaces
 */

import { OAuth2Token } from '../oauth2/types';

export interface UserAccount {
  email: string;
  firstName: string;
  lastName: string;
  department?: string;
  title?: string;
  manager?: string;
  customAttributes?: Record<string, any>;
}

export interface GroupInfo {
  id: string;
  name: string;
  email: string;
  description: string;
  memberCount: number;
}

export interface ProvisioningResult {
  success: boolean;
  userId?: string;
  email?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface IdentityProviderAdapter {
  createUser(tokens: OAuth2Token, userInfo: UserAccount): Promise<ProvisioningResult>;
  updateUser(
    tokens: OAuth2Token,
    userId: string,
    updates: Partial<UserAccount>
  ): Promise<ProvisioningResult>;
  deleteUser(tokens: OAuth2Token, userId: string): Promise<ProvisioningResult>;
  assignGroups(tokens: OAuth2Token, userId: string, groups: string[]): Promise<ProvisioningResult>;
  removeGroups(tokens: OAuth2Token, userId: string, groups: string[]): Promise<ProvisioningResult>;
  listGroups(tokens: OAuth2Token): Promise<GroupInfo[]>;
}
