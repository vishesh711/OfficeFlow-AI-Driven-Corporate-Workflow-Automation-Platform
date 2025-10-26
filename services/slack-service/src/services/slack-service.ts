import { WebClient } from '@slack/web-api';
import { 
  SlackCredentials,
  SlackServiceConfig,
  SlackUser,
  SlackChannel,
  SendMessageRequest,
  SendMessageResponse,
  CreateChannelRequest,
  CreateChannelResponse,
  InviteToChannelRequest,
  InviteToChannelResponse,
  RemoveFromChannelRequest,
  RemoveFromChannelResponse,
  ArchiveChannelRequest,
  ArchiveChannelResponse,
  GetUserRequest,
  GetUserResponse,
  ListUsersRequest,
  ListUsersResponse,
  GetChannelRequest,
  GetChannelResponse,
  ListChannelsRequest,
  ListChannelsResponse,
  GetChannelMembersRequest,
  GetChannelMembersResponse
} from '../types/slack-types';
import { logger } from '../utils/logger';

export class SlackService {
  private webClient: WebClient;

  constructor(private config: SlackServiceConfig) {
    this.webClient = new WebClient(config.slack.botToken);
  }

  private createClientForCredentials(credentials: SlackCredentials): WebClient {
    return new WebClient(credentials.botToken);
  }

  private convertSlackUser(slackUser: any): SlackUser {
    return {
      id: slackUser.id,
      name: slackUser.name,
      realName: slackUser.real_name,
      email: slackUser.profile?.email,
      displayName: slackUser.profile?.display_name,
      title: slackUser.profile?.title,
      phone: slackUser.profile?.phone,
      image: slackUser.profile?.image_192,
      isBot: slackUser.is_bot || false,
      isAdmin: slackUser.is_admin || false,
      isOwner: slackUser.is_owner || false,
      isRestricted: slackUser.is_restricted || false,
      isUltraRestricted: slackUser.is_ultra_restricted || false,
      deleted: slackUser.deleted || false,
      profile: slackUser.profile ? {
        firstName: slackUser.profile.first_name,
        lastName: slackUser.profile.last_name,
        realName: slackUser.profile.real_name,
        displayName: slackUser.profile.display_name,
        email: slackUser.profile.email,
        phone: slackUser.profile.phone,
        title: slackUser.profile.title,
        statusText: slackUser.profile.status_text,
        statusEmoji: slackUser.profile.status_emoji,
        image24: slackUser.profile.image_24,
        image32: slackUser.profile.image_32,
        image48: slackUser.profile.image_48,
        image72: slackUser.profile.image_72,
        image192: slackUser.profile.image_192,
        image512: slackUser.profile.image_512,
      } : undefined,
    };
  }

  private convertSlackChannel(slackChannel: any): SlackChannel {
    return {
      id: slackChannel.id,
      name: slackChannel.name,
      isChannel: slackChannel.is_channel || false,
      isGroup: slackChannel.is_group || false,
      isIm: slackChannel.is_im || false,
      isMpim: slackChannel.is_mpim || false,
      isPrivate: slackChannel.is_private || false,
      isArchived: slackChannel.is_archived || false,
      isGeneral: slackChannel.is_general || false,
      isShared: slackChannel.is_shared || false,
      isExtShared: slackChannel.is_ext_shared || false,
      isOrgShared: slackChannel.is_org_shared || false,
      creator: slackChannel.creator,
      created: slackChannel.created,
      topic: slackChannel.topic ? {
        value: slackChannel.topic.value,
        creator: slackChannel.topic.creator,
        lastSet: slackChannel.topic.last_set,
      } : undefined,
      purpose: slackChannel.purpose ? {
        value: slackChannel.purpose.value,
        creator: slackChannel.purpose.creator,
        lastSet: slackChannel.purpose.last_set,
      } : undefined,
      members: slackChannel.members,
      numMembers: slackChannel.num_members,
    };
  }

  async sendMessage(
    request: SendMessageRequest,
    credentials: SlackCredentials
  ): Promise<SendMessageResponse> {
    try {
      const client = this.createClientForCredentials(credentials);
      
      const result = await client.chat.postMessage({
        channel: request.channel,
        text: request.text,
        blocks: request.blocks,
        attachments: request.attachments,
        thread_ts: request.threadTs,
        reply_broadcast: request.replyBroadcast,
        as_user: request.asUser,
        icon_emoji: request.iconEmoji,
        icon_url: request.iconUrl,
        username: request.username,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to send message');
      }

      logger.info('Slack message sent', {
        channel: request.channel,
        messageTs: result.ts,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: true,
        messageTs: result.ts as string,
        channel: result.channel as string,
      };
    } catch (error) {
      logger.error('Failed to send Slack message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        channel: request.channel,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createChannel(
    request: CreateChannelRequest,
    credentials: SlackCredentials
  ): Promise<CreateChannelResponse> {
    try {
      const client = this.createClientForCredentials(credentials);
      
      const result = await client.conversations.create({
        name: request.name,
        is_private: request.isPrivate,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to create channel');
      }

      const channel = this.convertSlackChannel(result.channel);

      // Set topic if provided
      if (request.topic) {
        await client.conversations.setTopic({
          channel: channel.id,
          topic: request.topic,
        });
      }

      // Set purpose if provided
      if (request.purpose) {
        await client.conversations.setPurpose({
          channel: channel.id,
          purpose: request.purpose,
        });
      }

      // Invite members if provided
      if (request.members && request.members.length > 0) {
        await client.conversations.invite({
          channel: channel.id,
          users: request.members.join(','),
        });
      }

      logger.info('Slack channel created', {
        channelId: channel.id,
        channelName: channel.name,
        isPrivate: request.isPrivate,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: true,
        channel,
      };
    } catch (error) {
      logger.error('Failed to create Slack channel', {
        error: error instanceof Error ? error.message : 'Unknown error',
        channelName: request.name,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async inviteToChannel(
    request: InviteToChannelRequest,
    credentials: SlackCredentials
  ): Promise<InviteToChannelResponse> {
    try {
      const client = this.createClientForCredentials(credentials);
      
      const result = await client.conversations.invite({
        channel: request.channel,
        users: request.users.join(','),
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to invite users to channel');
      }

      logger.info('Users invited to Slack channel', {
        channel: request.channel,
        users: request.users,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: true,
        channel: request.channel,
      };
    } catch (error) {
      logger.error('Failed to invite users to Slack channel', {
        error: error instanceof Error ? error.message : 'Unknown error',
        channel: request.channel,
        users: request.users,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async removeFromChannel(
    request: RemoveFromChannelRequest,
    credentials: SlackCredentials
  ): Promise<RemoveFromChannelResponse> {
    try {
      const client = this.createClientForCredentials(credentials);
      
      const result = await client.conversations.kick({
        channel: request.channel,
        user: request.user,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to remove user from channel');
      }

      logger.info('User removed from Slack channel', {
        channel: request.channel,
        user: request.user,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to remove user from Slack channel', {
        error: error instanceof Error ? error.message : 'Unknown error',
        channel: request.channel,
        user: request.user,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async archiveChannel(
    request: ArchiveChannelRequest,
    credentials: SlackCredentials
  ): Promise<ArchiveChannelResponse> {
    try {
      const client = this.createClientForCredentials(credentials);
      
      const result = await client.conversations.archive({
        channel: request.channel,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to archive channel');
      }

      logger.info('Slack channel archived', {
        channel: request.channel,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to archive Slack channel', {
        error: error instanceof Error ? error.message : 'Unknown error',
        channel: request.channel,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getUser(
    request: GetUserRequest,
    credentials: SlackCredentials
  ): Promise<GetUserResponse> {
    try {
      const client = this.createClientForCredentials(credentials);
      
      const result = await client.users.info({
        user: request.user,
        include_locale: request.includeLocale,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to get user');
      }

      const user = this.convertSlackUser(result.user);

      logger.info('Slack user retrieved', {
        userId: user.id,
        userName: user.name,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: true,
        user,
      };
    } catch (error) {
      logger.error('Failed to get Slack user', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: request.user,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async listUsers(
    request: ListUsersRequest,
    credentials: SlackCredentials
  ): Promise<ListUsersResponse> {
    try {
      const client = this.createClientForCredentials(credentials);
      
      const result = await client.users.list({
        cursor: request.cursor,
        limit: request.limit,
        include_locale: request.includeLocale,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to list users');
      }

      const users = result.members?.map(member => this.convertSlackUser(member)) || [];

      logger.info('Slack users listed', {
        count: users.length,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: true,
        users,
        nextCursor: result.response_metadata?.next_cursor,
      };
    } catch (error) {
      logger.error('Failed to list Slack users', {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getChannel(
    request: GetChannelRequest,
    credentials: SlackCredentials
  ): Promise<GetChannelResponse> {
    try {
      const client = this.createClientForCredentials(credentials);
      
      const result = await client.conversations.info({
        channel: request.channel,
        include_locale: request.includeLocale,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to get channel');
      }

      const channel = this.convertSlackChannel(result.channel);

      logger.info('Slack channel retrieved', {
        channelId: channel.id,
        channelName: channel.name,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: true,
        channel,
      };
    } catch (error) {
      logger.error('Failed to get Slack channel', {
        error: error instanceof Error ? error.message : 'Unknown error',
        channelId: request.channel,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async listChannels(
    request: ListChannelsRequest,
    credentials: SlackCredentials
  ): Promise<ListChannelsResponse> {
    try {
      const client = this.createClientForCredentials(credentials);
      
      const result = await client.conversations.list({
        cursor: request.cursor,
        limit: request.limit,
        exclude_archived: request.excludeArchived,
        types: request.types,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to list channels');
      }

      const channels = result.channels?.map(channel => this.convertSlackChannel(channel)) || [];

      logger.info('Slack channels listed', {
        count: channels.length,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: true,
        channels,
        nextCursor: result.response_metadata?.next_cursor,
      };
    } catch (error) {
      logger.error('Failed to list Slack channels', {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getChannelMembers(
    request: GetChannelMembersRequest,
    credentials: SlackCredentials
  ): Promise<GetChannelMembersResponse> {
    try {
      const client = this.createClientForCredentials(credentials);
      
      const result = await client.conversations.members({
        channel: request.channel,
        cursor: request.cursor,
        limit: request.limit,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to get channel members');
      }

      logger.info('Slack channel members retrieved', {
        channelId: request.channel,
        memberCount: result.members?.length || 0,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: true,
        members: result.members,
        nextCursor: result.response_metadata?.next_cursor,
      };
    } catch (error) {
      logger.error('Failed to get Slack channel members', {
        error: error instanceof Error ? error.message : 'Unknown error',
        channelId: request.channel,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async findUserByEmail(
    email: string,
    credentials: SlackCredentials
  ): Promise<GetUserResponse> {
    try {
      const client = this.createClientForCredentials(credentials);
      
      const result = await client.users.lookupByEmail({
        email,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to find user by email');
      }

      const user = this.convertSlackUser(result.user);

      logger.info('Slack user found by email', {
        email,
        userId: user.id,
        userName: user.name,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: true,
        user,
      };
    } catch (error) {
      logger.error('Failed to find Slack user by email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email,
        organizationId: credentials.organizationId,
        teamId: credentials.teamId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getAuthUrl(state?: string): string {
    const scopes = [
      'channels:read',
      'channels:write',
      'channels:manage',
      'groups:read',
      'groups:write',
      'im:read',
      'im:write',
      'mpim:read',
      'mpim:write',
      'chat:write',
      'users:read',
      'users:read.email',
      'team:read',
    ];

    const params = new URLSearchParams({
      client_id: this.config.slack.clientId,
      scope: scopes.join(','),
      redirect_uri: this.config.slack.redirectUri,
    });

    if (state) {
      params.append('state', state);
    }

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<{
    botToken: string;
    userToken?: string;
    teamId: string;
    teamName: string;
    installedBy: string;
  }> {
    try {
      const result = await this.webClient.oauth.v2.access({
        client_id: this.config.slack.clientId,
        client_secret: this.config.slack.clientSecret,
        code,
        redirect_uri: this.config.slack.redirectUri,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to exchange code for tokens');
      }

      return {
        botToken: result.access_token as string,
        userToken: result.authed_user?.access_token,
        teamId: result.team?.id as string,
        teamName: result.team?.name as string,
        installedBy: result.authed_user?.id as string,
      };
    } catch (error) {
      logger.error('Failed to exchange code for Slack tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }
}