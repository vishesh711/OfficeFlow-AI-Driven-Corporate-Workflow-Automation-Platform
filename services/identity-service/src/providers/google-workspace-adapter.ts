/**
 * Google Workspace API adapter
 */

import { google, admin_directory_v1 } from 'googleapis';
import { Logger } from 'winston';
import { OAuth2Token, ProviderConfig } from '../oauth2/types';
import { IdentityProviderAdapter, UserAccount, GroupInfo, ProvisioningResult } from './types';

export class GoogleWorkspaceAdapter implements IdentityProviderAdapter {
  private logger: Logger;
  private config: ProviderConfig;

  constructor(config: ProviderConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async createUser(
    tokens: OAuth2Token,
    userInfo: UserAccount
  ): Promise<ProvisioningResult> {
    try {
      const auth = this.createAuthClient(tokens);
      const admin = google.admin({ version: 'directory_v1', auth });

      const userResource: admin_directory_v1.Schema$User = {
        primaryEmail: userInfo.email,
        name: {
          givenName: userInfo.firstName,
          familyName: userInfo.lastName,
          fullName: `${userInfo.firstName} ${userInfo.lastName}`
        },
        password: this.generateTemporaryPassword(),
        changePasswordAtNextLogin: true,
        orgUnitPath: userInfo.department ? `/Departments/${userInfo.department}` : '/',
        suspended: false,
        includeInGlobalAddressList: true
      };

      // Add custom attributes if provided
      if (userInfo.customAttributes) {
        userResource.customSchemas = {
          Employee: userInfo.customAttributes
        };
      }

      const response = await admin.users.insert({
        requestBody: userResource
      });

      this.logger.info('Google Workspace user created successfully', {
        email: userInfo.email,
        userId: response.data.id
      });

      return {
        success: true,
        userId: response.data.id!,
        email: response.data.primaryEmail!,
        metadata: {
          orgUnitPath: response.data.orgUnitPath,
          suspended: response.data.suspended,
          creationTime: response.data.creationTime
        }
      };
    } catch (error) {
      this.logger.error('Failed to create Google Workspace user', {
        email: userInfo.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async updateUser(
    tokens: OAuth2Token,
    userId: string,
    updates: Partial<UserAccount>
  ): Promise<ProvisioningResult> {
    try {
      const auth = this.createAuthClient(tokens);
      const admin = google.admin({ version: 'directory_v1', auth });

      const userResource: admin_directory_v1.Schema$User = {};

      if (updates.firstName || updates.lastName) {
        userResource.name = {
          givenName: updates.firstName,
          familyName: updates.lastName,
          fullName: updates.firstName && updates.lastName 
            ? `${updates.firstName} ${updates.lastName}` 
            : undefined
        };
      }

      if (updates.department) {
        userResource.orgUnitPath = `/Departments/${updates.department}`;
      }

      if (updates.customAttributes) {
        userResource.customSchemas = {
          Employee: updates.customAttributes
        };
      }

      const response = await admin.users.update({
        userKey: userId,
        requestBody: userResource
      });

      this.logger.info('Google Workspace user updated successfully', {
        userId,
        email: response.data.primaryEmail
      });

      return {
        success: true,
        userId: response.data.id!,
        email: response.data.primaryEmail!,
        metadata: {
          orgUnitPath: response.data.orgUnitPath,
          suspended: response.data.suspended,
          lastLoginTime: response.data.lastLoginTime
        }
      };
    } catch (error) {
      this.logger.error('Failed to update Google Workspace user', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteUser(tokens: OAuth2Token, userId: string): Promise<ProvisioningResult> {
    try {
      const auth = this.createAuthClient(tokens);
      const admin = google.admin({ version: 'directory_v1', auth });

      // Suspend user instead of deleting to preserve data
      await admin.users.update({
        userKey: userId,
        requestBody: {
          suspended: true,
          suspensionReason: 'Employee departure'
        }
      });

      this.logger.info('Google Workspace user suspended successfully', {
        userId
      });

      return {
        success: true,
        userId,
        email: '',
        metadata: {
          suspended: true,
          suspensionReason: 'Employee departure'
        }
      };
    } catch (error) {
      this.logger.error('Failed to suspend Google Workspace user', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async assignGroups(
    tokens: OAuth2Token,
    userId: string,
    groups: string[]
  ): Promise<ProvisioningResult> {
    try {
      const auth = this.createAuthClient(tokens);
      const admin = google.admin({ version: 'directory_v1', auth });

      const results = [];

      for (const groupEmail of groups) {
        try {
          await admin.members.insert({
            groupKey: groupEmail,
            requestBody: {
              email: userId, // Can use userId or email
              role: 'MEMBER'
            }
          });

          results.push({ group: groupEmail, success: true });
          
          this.logger.debug('User added to Google Workspace group', {
            userId,
            group: groupEmail
          });
        } catch (error) {
          results.push({ 
            group: groupEmail, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          this.logger.warn('Failed to add user to Google Workspace group', {
            userId,
            group: groupEmail,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      
      return {
        success: successCount > 0,
        userId,
        email: '',
        metadata: {
          groupAssignments: results,
          successCount,
          totalCount: groups.length
        }
      };
    } catch (error) {
      this.logger.error('Failed to assign Google Workspace groups', {
        userId,
        groups,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async removeGroups(
    tokens: OAuth2Token,
    userId: string,
    groups: string[]
  ): Promise<ProvisioningResult> {
    try {
      const auth = this.createAuthClient(tokens);
      const admin = google.admin({ version: 'directory_v1', auth });

      const results = [];

      for (const groupEmail of groups) {
        try {
          await admin.members.delete({
            groupKey: groupEmail,
            memberKey: userId
          });

          results.push({ group: groupEmail, success: true });
          
          this.logger.debug('User removed from Google Workspace group', {
            userId,
            group: groupEmail
          });
        } catch (error) {
          results.push({ 
            group: groupEmail, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          this.logger.warn('Failed to remove user from Google Workspace group', {
            userId,
            group: groupEmail,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      
      return {
        success: successCount > 0,
        userId,
        email: '',
        metadata: {
          groupRemovals: results,
          successCount,
          totalCount: groups.length
        }
      };
    } catch (error) {
      this.logger.error('Failed to remove Google Workspace groups', {
        userId,
        groups,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async listGroups(tokens: OAuth2Token): Promise<GroupInfo[]> {
    try {
      const auth = this.createAuthClient(tokens);
      const admin = google.admin({ version: 'directory_v1', auth });

      const response = await admin.groups.list({
        domain: this.extractDomainFromConfig(),
        maxResults: 200
      });

      const groups = response.data.groups || [];
      
      return groups.map((group: any) => ({
        id: group.id!,
        name: group.name!,
        email: group.email!,
        description: group.description || '',
        memberCount: parseInt(group.directMembersCount || '0')
      }));
    } catch (error) {
      this.logger.error('Failed to list Google Workspace groups', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private createAuthClient(tokens: OAuth2Token) {
    const oauth2Client = new google.auth.OAuth2(
      this.config.oauth2.clientId,
      this.config.oauth2.clientSecret,
      this.config.oauth2.redirectUri
    );

    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: tokens.tokenType,
      expiry_date: tokens.expiresAt.getTime()
    });

    return oauth2Client;
  }

  private generateTemporaryPassword(): string {
    // Generate a secure temporary password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return password;
  }

  private extractDomainFromConfig(): string {
    // Extract domain from OAuth2 config or use a default
    // This would typically come from organization settings
    return 'example.com'; // This should be configurable
  }
}