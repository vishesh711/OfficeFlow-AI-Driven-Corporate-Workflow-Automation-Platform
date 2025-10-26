/**
 * Office 365 / Microsoft Graph API adapter
 */

import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';
import { OAuth2Token, ProviderConfig } from '../oauth2/types';
import { IdentityProviderAdapter, UserAccount, GroupInfo, ProvisioningResult } from './types';

export class Office365Adapter implements IdentityProviderAdapter {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private config: ProviderConfig;

  constructor(config: ProviderConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request/response interceptors
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug('Microsoft Graph request', {
          method: config.method,
          url: config.url
        });
        return config;
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug('Microsoft Graph response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error('Microsoft Graph error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.response?.data || error.message
        });
        return Promise.reject(error);
      }
    );
  }

  async createUser(
    tokens: OAuth2Token,
    userInfo: UserAccount
  ): Promise<ProvisioningResult> {
    try {
      const userPrincipalName = userInfo.email;
      const displayName = `${userInfo.firstName} ${userInfo.lastName}`;
      
      const userPayload = {
        accountEnabled: true,
        displayName,
        mailNickname: userInfo.email.split('@')[0],
        userPrincipalName,
        givenName: userInfo.firstName,
        surname: userInfo.lastName,
        jobTitle: userInfo.title,
        department: userInfo.department,
        passwordProfile: {
          forceChangePasswordNextSignIn: true,
          password: this.generateTemporaryPassword()
        },
        usageLocation: 'US' // Required for license assignment
      };

      const response = await this.httpClient.post('https://graph.microsoft.com/v1.0/users', userPayload, {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`
        }
      });

      this.logger.info('Office 365 user created successfully', {
        email: userInfo.email,
        userId: response.data.id
      });

      return {
        success: true,
        userId: response.data.id,
        email: response.data.userPrincipalName,
        metadata: {
          displayName: response.data.displayName,
          accountEnabled: response.data.accountEnabled,
          createdDateTime: response.data.createdDateTime
        }
      };
    } catch (error) {
      this.logger.error('Failed to create Office 365 user', {
        email: userInfo.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  async updateUser(
    tokens: OAuth2Token,
    userId: string,
    updates: Partial<UserAccount>
  ): Promise<ProvisioningResult> {
    try {
      const updatePayload: any = {};

      if (updates.firstName) {
        updatePayload.givenName = updates.firstName;
      }

      if (updates.lastName) {
        updatePayload.surname = updates.lastName;
      }

      if (updates.firstName || updates.lastName) {
        updatePayload.displayName = `${updates.firstName || ''} ${updates.lastName || ''}`.trim();
      }

      if (updates.title) {
        updatePayload.jobTitle = updates.title;
      }

      if (updates.department) {
        updatePayload.department = updates.department;
      }

      const response = await this.httpClient.patch(`/users/${userId}`, updatePayload, {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`
        }
      });

      this.logger.info('Office 365 user updated successfully', {
        userId
      });

      return {
        success: true,
        userId,
        email: '',
        metadata: {
          updated: true
        }
      };
    } catch (error) {
      this.logger.error('Failed to update Office 365 user', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  async deleteUser(tokens: OAuth2Token, userId: string): Promise<ProvisioningResult> {
    try {
      // Disable user instead of deleting to preserve data
      await this.httpClient.patch(`/users/${userId}`, {
        accountEnabled: false
      }, {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`
        }
      });

      this.logger.info('Office 365 user disabled successfully', {
        userId
      });

      return {
        success: true,
        userId,
        email: '',
        metadata: {
          accountEnabled: false,
          disabledDateTime: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error('Failed to disable Office 365 user', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  async assignGroups(
    tokens: OAuth2Token,
    userId: string,
    groups: string[]
  ): Promise<ProvisioningResult> {
    try {
      const results = [];

      for (const groupId of groups) {
        try {
          await this.httpClient.post(`/groups/${groupId}/members/$ref`, {
            '@odata.id': `https://graph.microsoft.com/v1.0/users/${userId}`
          }, {
            headers: {
              'Authorization': `Bearer ${tokens.accessToken}`
            }
          });

          results.push({ group: groupId, success: true });
          
          this.logger.debug('User added to Office 365 group', {
            userId,
            groupId
          });
        } catch (error) {
          results.push({ 
            group: groupId, 
            success: false, 
            error: this.extractErrorMessage(error)
          });
          
          this.logger.warn('Failed to add user to Office 365 group', {
            userId,
            groupId,
            error: this.extractErrorMessage(error)
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
      this.logger.error('Failed to assign Office 365 groups', {
        userId,
        groups,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  async removeGroups(
    tokens: OAuth2Token,
    userId: string,
    groups: string[]
  ): Promise<ProvisioningResult> {
    try {
      const results = [];

      for (const groupId of groups) {
        try {
          await this.httpClient.delete(`/groups/${groupId}/members/${userId}/$ref`, {
            headers: {
              'Authorization': `Bearer ${tokens.accessToken}`
            }
          });

          results.push({ group: groupId, success: true });
          
          this.logger.debug('User removed from Office 365 group', {
            userId,
            groupId
          });
        } catch (error) {
          results.push({ 
            group: groupId, 
            success: false, 
            error: this.extractErrorMessage(error)
          });
          
          this.logger.warn('Failed to remove user from Office 365 group', {
            userId,
            groupId,
            error: this.extractErrorMessage(error)
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
      this.logger.error('Failed to remove Office 365 groups', {
        userId,
        groups,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  async listGroups(tokens: OAuth2Token): Promise<GroupInfo[]> {
    try {
      const response = await this.httpClient.get('/groups', {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`
        },
        params: {
          '$select': 'id,displayName,mail,description',
          '$top': 200
        }
      });

      const groups = response.data.value || [];
      
      return groups.map((group: any) => ({
        id: group.id,
        name: group.displayName,
        email: group.mail || '',
        description: group.description || '',
        memberCount: 0 // Microsoft Graph requires separate call for member count
      }));
    } catch (error) {
      this.logger.error('Failed to list Office 365 groups', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private generateTemporaryPassword(): string {
    // Generate a secure temporary password that meets Office 365 requirements
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += symbols.charAt(Math.floor(Math.random() * symbols.length));
    
    // Fill remaining characters
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = 4; i < 16; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  private extractErrorMessage(error: any): string {
    if (error.response?.data?.error?.message) {
      return error.response.data.error.message;
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return 'Unknown error';
  }
}