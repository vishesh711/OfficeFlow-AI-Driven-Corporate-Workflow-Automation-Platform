export interface SlackConfig {
  botToken: string;
  signingSecret: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  appToken?: string;
}

export interface SlackServiceConfig {
  port: number;
  slack: SlackConfig;
  rateLimiting: {
    requestsPerMinute: number;
    burstSize: number;
  };
}

export interface SlackCredentials {
  botToken: string;
  userToken?: string;
  teamId: string;
  teamName: string;
  organizationId: string;
  userId: string;
  installedBy: string;
}

export interface SlackUser {
  id: string;
  name: string;
  realName?: string;
  email?: string;
  displayName?: string;
  title?: string;
  phone?: string;
  image?: string;
  isBot: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isRestricted: boolean;
  isUltraRestricted: boolean;
  deleted: boolean;
  profile?: SlackUserProfile;
}

export interface SlackUserProfile {
  firstName?: string;
  lastName?: string;
  realName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  title?: string;
  statusText?: string;
  statusEmoji?: string;
  image24?: string;
  image32?: string;
  image48?: string;
  image72?: string;
  image192?: string;
  image512?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  isChannel: boolean;
  isGroup: boolean;
  isIm: boolean;
  isMpim: boolean;
  isPrivate: boolean;
  isArchived: boolean;
  isGeneral: boolean;
  isShared: boolean;
  isExtShared: boolean;
  isOrgShared: boolean;
  creator?: string;
  created: number;
  topic?: {
    value: string;
    creator: string;
    lastSet: number;
  };
  purpose?: {
    value: string;
    creator: string;
    lastSet: number;
  };
  members?: string[];
  numMembers?: number;
}

export interface SlackMessage {
  channel: string;
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  threadTs?: string;
  replyBroadcast?: boolean;
  unfurlLinks?: boolean;
  unfurlMedia?: boolean;
  asUser?: boolean;
  iconEmoji?: string;
  iconUrl?: string;
  username?: string;
  linkNames?: boolean;
  parse?: 'full' | 'none';
}

export interface SlackBlock {
  type: string;
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  };
  elements?: any[];
  accessory?: any;
  fields?: any[];
}

export interface SlackAttachment {
  fallback?: string;
  color?: string;
  pretext?: string;
  authorName?: string;
  authorLink?: string;
  authorIcon?: string;
  title?: string;
  titleLink?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  imageUrl?: string;
  thumbUrl?: string;
  footer?: string;
  footerIcon?: string;
  ts?: number;
}

export interface SendMessageRequest {
  channel: string;
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  threadTs?: string;
  replyBroadcast?: boolean;
  asUser?: boolean;
  iconEmoji?: string;
  iconUrl?: string;
  username?: string;
}

export interface SendMessageResponse {
  success: boolean;
  messageTs?: string;
  channel?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface CreateChannelRequest {
  name: string;
  isPrivate?: boolean;
  topic?: string;
  purpose?: string;
  members?: string[];
}

export interface CreateChannelResponse {
  success: boolean;
  channel?: SlackChannel;
  error?: string;
}

export interface InviteToChannelRequest {
  channel: string;
  users: string[];
}

export interface InviteToChannelResponse {
  success: boolean;
  channel?: string;
  error?: string;
}

export interface RemoveFromChannelRequest {
  channel: string;
  user: string;
}

export interface RemoveFromChannelResponse {
  success: boolean;
  error?: string;
}

export interface ArchiveChannelRequest {
  channel: string;
}

export interface ArchiveChannelResponse {
  success: boolean;
  error?: string;
}

export interface GetUserRequest {
  user: string;
  includeLocale?: boolean;
}

export interface GetUserResponse {
  success: boolean;
  user?: SlackUser;
  error?: string;
}

export interface ListUsersRequest {
  cursor?: string;
  limit?: number;
  includeLocale?: boolean;
}

export interface ListUsersResponse {
  success: boolean;
  users?: SlackUser[];
  nextCursor?: string;
  error?: string;
}

export interface GetChannelRequest {
  channel: string;
  includeLocale?: boolean;
}

export interface GetChannelResponse {
  success: boolean;
  channel?: SlackChannel;
  error?: string;
}

export interface ListChannelsRequest {
  cursor?: string;
  limit?: number;
  excludeArchived?: boolean;
  types?: string; // 'public_channel,private_channel,mpim,im'
}

export interface ListChannelsResponse {
  success: boolean;
  channels?: SlackChannel[];
  nextCursor?: string;
  error?: string;
}

export interface GetChannelMembersRequest {
  channel: string;
  cursor?: string;
  limit?: number;
}

export interface GetChannelMembersResponse {
  success: boolean;
  members?: string[];
  nextCursor?: string;
  error?: string;
}

export interface SlackWebhookEvent {
  token: string;
  teamId: string;
  apiAppId: string;
  event: {
    type: string;
    user?: string;
    channel?: string;
    text?: string;
    ts?: string;
    eventTs?: string;
    channelType?: string;
    [key: string]: any;
  };
  type: 'event_callback' | 'url_verification';
  challenge?: string;
  eventId: string;
  eventTime: number;
  authedUsers?: string[];
}

export interface SlackInteractiveEvent {
  type: 'block_actions' | 'interactive_message' | 'dialog_submission';
  user: {
    id: string;
    name: string;
  };
  channel: {
    id: string;
    name: string;
  };
  team: {
    id: string;
    domain: string;
  };
  actions?: Array<{
    type: string;
    actionId?: string;
    blockId?: string;
    text?: {
      type: string;
      text: string;
    };
    value?: string;
    actionTs?: string;
  }>;
  responseUrl?: string;
  triggerId?: string;
}