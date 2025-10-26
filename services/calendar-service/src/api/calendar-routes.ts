import express from 'express';
import Joi from 'joi';
import { CalendarService } from '../services/calendar-service';
import { getCalendarConfig } from '../config/calendar-config';
import { logger } from '../utils/logger';
import { 
  CalendarEventRequest,
  CalendarListRequest,
  AvailabilityRequest,
  FindMeetingTimeRequest,
  CalendarCredentials
} from '../types/calendar-types';

const router = express.Router();
const calendarService = new CalendarService(getCalendarConfig());

// Validation schemas
const eventSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().optional(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
  timezone: Joi.string().required(),
  location: Joi.string().optional(),
  attendees: Joi.array().items(Joi.object({
    email: Joi.string().email().required(),
    name: Joi.string().optional(),
    required: Joi.boolean().default(true),
  })).default([]),
  recurrence: Joi.object({
    frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').required(),
    interval: Joi.number().integer().min(1).optional(),
    count: Joi.number().integer().min(1).optional(),
    until: Joi.date().iso().optional(),
    byWeekDay: Joi.array().items(Joi.number().integer().min(0).max(6)).optional(),
    byMonthDay: Joi.array().items(Joi.number().integer().min(1).max(31)).optional(),
  }).optional(),
  reminders: Joi.array().items(Joi.object({
    method: Joi.string().valid('email', 'popup').required(),
    minutes: Joi.number().integer().min(0).required(),
  })).optional(),
});

const createEventSchema = Joi.object({
  provider: Joi.string().valid('google', 'microsoft').required(),
  calendarId: Joi.string().optional(),
  event: eventSchema.required(),
  sendNotifications: Joi.boolean().default(true),
});

const updateEventSchema = Joi.object({
  provider: Joi.string().valid('google', 'microsoft').required(),
  eventId: Joi.string().required(),
  calendarId: Joi.string().optional(),
  event: eventSchema.required(),
  sendNotifications: Joi.boolean().default(true),
});

const listEventsSchema = Joi.object({
  provider: Joi.string().valid('google', 'microsoft').required(),
  calendarId: Joi.string().optional(),
  startTime: Joi.date().iso().optional(),
  endTime: Joi.date().iso().optional(),
  maxResults: Joi.number().integer().min(1).max(2500).default(250),
});

const availabilitySchema = Joi.object({
  provider: Joi.string().valid('google', 'microsoft').required(),
  emails: Joi.array().items(Joi.string().email()).min(1).required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
  timezone: Joi.string().required(),
});

const findMeetingTimeSchema = Joi.object({
  provider: Joi.string().valid('google', 'microsoft').required(),
  attendees: Joi.array().items(Joi.string().email()).min(1).required(),
  duration: Joi.number().integer().min(15).max(480).required(), // 15 minutes to 8 hours
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
  workingHours: Joi.object({
    start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    days: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).required(),
  }).optional(),
  timezone: Joi.string().required(),
  bufferTime: Joi.number().integer().min(0).max(60).optional(),
});

// Middleware to extract credentials (in a real implementation, this would validate JWT tokens)
const extractCredentials = (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    provider: 'google', // This would come from the token
    accessToken: authHeader.replace('Bearer ', ''),
    email: 'user@example.com', // This would come from the token
    organizationId: 'org-123', // This would come from the token
    userId: 'user-123', // This would come from the token
  } as CalendarCredentials;

  next();
};

// Create calendar event
router.post('/events', extractCredentials, async (req, res) => {
  try {
    const { error, value } = createEventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const request: CalendarEventRequest = value;
    const result = await calendarService.createEvent(request, req.credentials!);

    res.json(result);
  } catch (error) {
    logger.error('Error creating calendar event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Update calendar event
router.put('/events/:eventId', extractCredentials, async (req, res) => {
  try {
    const { error, value } = updateEventSchema.validate({
      ...req.body,
      eventId: req.params.eventId,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const result = await calendarService.updateEvent(
      value.provider,
      value.eventId,
      value.event,
      req.credentials!,
      value.calendarId,
      value.sendNotifications
    );

    res.json(result);
  } catch (error) {
    logger.error('Error updating calendar event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      eventId: req.params.eventId,
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Delete calendar event
router.delete('/events/:eventId', extractCredentials, async (req, res) => {
  try {
    const provider = req.query.provider as string;
    const calendarId = req.query.calendarId as string;
    const sendNotifications = req.query.sendNotifications === 'true';

    if (!provider || !['google', 'microsoft'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Valid provider parameter required',
      });
    }

    const result = await calendarService.deleteEvent(
      provider,
      req.params.eventId,
      req.credentials!,
      calendarId,
      sendNotifications
    );

    res.json(result);
  } catch (error) {
    logger.error('Error deleting calendar event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      eventId: req.params.eventId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// List calendar events
router.get('/events', extractCredentials, async (req, res) => {
  try {
    const { error, value } = listEventsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const request: CalendarListRequest = value;
    const result = await calendarService.listEvents(request, req.credentials!);

    res.json(result);
  } catch (error) {
    logger.error('Error listing calendar events', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: req.query,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Get availability
router.post('/availability', extractCredentials, async (req, res) => {
  try {
    const { error, value } = availabilitySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { provider, ...availabilityRequest } = value;
    const result = await calendarService.getAvailability(
      provider,
      availabilityRequest as AvailabilityRequest,
      req.credentials!
    );

    res.json({
      success: true,
      availability: result,
    });
  } catch (error) {
    logger.error('Error getting availability', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Find meeting time
router.post('/find-meeting-time', extractCredentials, async (req, res) => {
  try {
    const { error, value } = findMeetingTimeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { provider, ...findMeetingRequest } = value;
    const result = await calendarService.findMeetingTime(
      provider,
      findMeetingRequest as FindMeetingTimeRequest,
      req.credentials!
    );

    res.json(result);
  } catch (error) {
    logger.error('Error finding meeting time', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// OAuth authorization URLs
router.get('/auth/:provider/url', (req, res) => {
  try {
    const provider = req.params.provider;
    if (!['google', 'microsoft'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider',
      });
    }

    const state = req.query.state as string;
    const authUrl = calendarService.getAuthUrl(provider, state);

    res.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    logger.error('Error generating auth URL', {
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: req.params.provider,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// OAuth callback
router.post('/auth/:provider/callback', async (req, res) => {
  try {
    const provider = req.params.provider;
    if (!['google', 'microsoft'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider',
      });
    }

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code required',
      });
    }

    const tokens = await calendarService.exchangeCodeForTokens(provider, code);

    res.json({
      success: true,
      tokens,
    });
  } catch (error) {
    logger.error('Error exchanging code for tokens', {
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: req.params.provider,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Refresh token
router.post('/auth/:provider/refresh', async (req, res) => {
  try {
    const provider = req.params.provider;
    if (!['google', 'microsoft'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider',
      });
    }

    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
      });
    }

    const tokens = await calendarService.refreshAccessToken(provider, refreshToken);

    res.json({
      success: true,
      tokens,
    });
  } catch (error) {
    logger.error('Error refreshing access token', {
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: req.params.provider,
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
      credentials?: CalendarCredentials;
    }
  }
}

export default router;