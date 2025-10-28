import express from 'express';
import Joi from 'joi';
import { SlackService } from '../services/slack-service';
import { getSlackConfig } from '../config/slack-config';
import { logger } from '../utils/logger';
import {
  SendMessageRequest,
  CreateChannelRequest,
  InviteToChannelRequest,
  RemoveFromChannelRequest,
  ArchiveChannelRequest,
  GetUserRequest,
  ListUsersRequest,
  GetChannelRequest,
  ListChannelsRequest,
  GetChannelMembersRequest,
  SlackCredentials,
} from '../types/slack-types';

const router = express.Router();
const slackService = new SlackService(getSlackConfig());

// Validation schemas
const blockSchema = Joi.object({
  type: Joi.string().required(),
  text: Joi.object({
    type: Joi.string().valid('plain_text', 'mrkdwn').required(),
    text: Joi.string().required(),
    emoji: Joi.boolean().optional(),
  }).optional(),
  elements: Joi.array().optional(),
  accessory: Joi.any().optional(),
  fields: Joi.array().optional(),
});

const attachmentSchema = Joi.object({
  fallback: Joi.string().optional(),
  color: Joi.string().optional(),
  pretext: Joi.string().optional(),
  authorName: Joi.string().optional(),
  authorLink: Joi.string().uri().optional(),
  authorIcon: Joi.string().uri().optional(),
  title: Joi.string().optional(),
  titleLink: Joi.string().uri().optional(),
  text: Joi.string().optional(),
  fields: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().required(),
        value: Joi.string().required(),
        short: Joi.boolean().optional(),
      })
    )
    .optional(),
  imageUrl: Joi.string().uri().optional(),
  thumbUrl: Joi.string().uri().optional(),
  footer: Joi.string().optional(),
  footerIcon: Joi.string().uri().optional(),
  ts: Joi.number().optional(),
});

const sendMessageSchema = Joi.object({
  channel: Joi.string().required(),
  text: Joi.string().optional(),
  blocks: Joi.array().items(blockSchema).optional(),
  attachments: Joi.array().items(attachmentSchema).optional(),
  threadTs: Joi.string().optional(),
  replyBroadcast: Joi.boolean().optional(),
  asUser: Joi.boolean().optional(),
  iconEmoji: Joi.string().optional(),
  iconUrl: Joi.string().uri().optional(),
  username: Joi.string().optional(),
}).or('text', 'blocks', 'attachments');

const createChannelSchema = Joi.object({
  name: Joi.string()
    .pattern(/^[a-z0-9\-_]+$/)
    .max(21)
    .required(),
  isPrivate: Joi.boolean().default(false),
  topic: Joi.string().max(250).optional(),
  purpose: Joi.string().max(250).optional(),
  members: Joi.array().items(Joi.string()).optional(),
});

const inviteToChannelSchema = Joi.object({
  channel: Joi.string().required(),
  users: Joi.array().items(Joi.string()).min(1).required(),
});

const removeFromChannelSchema = Joi.object({
  channel: Joi.string().required(),
  user: Joi.string().required(),
});

const archiveChannelSchema = Joi.object({
  channel: Joi.string().required(),
});

const getUserSchema = Joi.object({
  user: Joi.string().required(),
  includeLocale: Joi.boolean().default(false),
});

const listUsersSchema = Joi.object({
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  includeLocale: Joi.boolean().default(false),
});

const getChannelSchema = Joi.object({
  channel: Joi.string().required(),
  includeLocale: Joi.boolean().default(false),
});

const listChannelsSchema = Joi.object({
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  excludeArchived: Joi.boolean().default(true),
  types: Joi.string().default('public_channel,private_channel'),
});

const getChannelMembersSchema = Joi.object({
  channel: Joi.string().required(),
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(1000).default(100),
});

// Middleware to extract credentials (in a real implementation, this would validate JWT tokens)
const extractCredentials = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  // This is a simplified version - in production, you'd validate JWT tokens
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authorization header required',
    });
  }

  // Mock credentials extraction - replace with actual JWT validation
  req.credentials = {
    botToken: authHeader.replace('Bearer ', ''),
    teamId: 'T1234567890', // This would come from the token
    teamName: 'Example Team', // This would come from the token
    organizationId: 'org-123', // This would come from the token
    userId: 'user-123', // This would come from the token
    installedBy: 'U1234567890', // This would come from the token
  } as SlackCredentials;

  next();
};

// Send message
router.post('/messages', extractCredentials, async (req, res) => {
  try {
    const { error, value } = sendMessageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const request: SendMessageRequest = value;
    const result = await slackService.sendMessage(request, req.credentials!);

    res.json(result);
  } catch (error) {
    logger.error('Error sending Slack message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Create channel
router.post('/channels', extractCredentials, async (req, res) => {
  try {
    const { error, value } = createChannelSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const request: CreateChannelRequest = value;
    const result = await slackService.createChannel(request, req.credentials!);

    res.json(result);
  } catch (error) {
    logger.error('Error creating Slack channel', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Invite to channel
router.post('/channels/:channelId/invite', extractCredentials, async (req, res) => {
  try {
    const { error, value } = inviteToChannelSchema.validate({
      ...req.body,
      channel: req.params.channelId,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const request: InviteToChannelRequest = value;
    const result = await slackService.inviteToChannel(request, req.credentials!);

    res.json(result);
  } catch (error) {
    logger.error('Error inviting to Slack channel', {
      error: error instanceof Error ? error.message : 'Unknown error',
      channelId: req.params.channelId,
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Remove from channel
router.delete('/channels/:channelId/members/:userId', extractCredentials, async (req, res) => {
  try {
    const { error, value } = removeFromChannelSchema.validate({
      channel: req.params.channelId,
      user: req.params.userId,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const request: RemoveFromChannelRequest = value;
    const result = await slackService.removeFromChannel(request, req.credentials!);

    res.json(result);
  } catch (error) {
    logger.error('Error removing from Slack channel', {
      error: error instanceof Error ? error.message : 'Unknown error',
      channelId: req.params.channelId,
      userId: req.params.userId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Archive channel
router.post('/channels/:channelId/archive', extractCredentials, async (req, res) => {
  try {
    const { error, value } = archiveChannelSchema.validate({
      channel: req.params.channelId,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const request: ArchiveChannelRequest = value;
    const result = await slackService.archiveChannel(request, req.credentials!);

    res.json(result);
  } catch (error) {
    logger.error('Error archiving Slack channel', {
      error: error instanceof Error ? error.message : 'Unknown error',
      channelId: req.params.channelId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Get user
router.get('/users/:userId', extractCredentials, async (req, res) => {
  try {
    const { error, value } = getUserSchema.validate({
      user: req.params.userId,
      includeLocale: req.query.includeLocale === 'true',
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const request: GetUserRequest = value;
    const result = await slackService.getUser(request, req.credentials!);

    res.json(result);
  } catch (error) {
    logger.error('Error getting Slack user', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.params.userId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// List users
router.get('/users', extractCredentials, async (req, res) => {
  try {
    const { error, value } = listUsersSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const request: ListUsersRequest = value;
    const result = await slackService.listUsers(request, req.credentials!);

    res.json(result);
  } catch (error) {
    logger.error('Error listing Slack users', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: req.query,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Find user by email
router.get('/users/by-email/:email', extractCredentials, async (req, res) => {
  try {
    const email = req.params.email;
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address required',
      });
    }

    const result = await slackService.findUserByEmail(email, req.credentials!);

    res.json(result);
  } catch (error) {
    logger.error('Error finding Slack user by email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email: req.params.email,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Get channel
router.get('/channels/:channelId', extractCredentials, async (req, res) => {
  try {
    const { error, value } = getChannelSchema.validate({
      channel: req.params.channelId,
      includeLocale: req.query.includeLocale === 'true',
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const request: GetChannelRequest = value;
    const result = await slackService.getChannel(request, req.credentials!);

    res.json(result);
  } catch (error) {
    logger.error('Error getting Slack channel', {
      error: error instanceof Error ? error.message : 'Unknown error',
      channelId: req.params.channelId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// List channels
router.get('/channels', extractCredentials, async (req, res) => {
  try {
    const { error, value } = listChannelsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const request: ListChannelsRequest = value;
    const result = await slackService.listChannels(request, req.credentials!);

    res.json(result);
  } catch (error) {
    logger.error('Error listing Slack channels', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: req.query,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Get channel members
router.get('/channels/:channelId/members', extractCredentials, async (req, res) => {
  try {
    const { error, value } = getChannelMembersSchema.validate({
      channel: req.params.channelId,
      cursor: req.query.cursor,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const request: GetChannelMembersRequest = value;
    const result = await slackService.getChannelMembers(request, req.credentials!);

    res.json(result);
  } catch (error) {
    logger.error('Error getting Slack channel members', {
      error: error instanceof Error ? error.message : 'Unknown error',
      channelId: req.params.channelId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// OAuth authorization URL
router.get('/auth/url', (req, res) => {
  try {
    const state = req.query.state as string;
    const authUrl = slackService.getAuthUrl(state);

    res.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    logger.error('Error generating Slack auth URL', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// OAuth callback
router.post('/auth/callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code required',
      });
    }

    const tokens = await slackService.exchangeCodeForTokens(code);

    res.json({
      success: true,
      tokens,
    });
  } catch (error) {
    logger.error('Error exchanging code for Slack tokens', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      credentials?: SlackCredentials;
    }
  }
}

export default router;
