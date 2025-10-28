import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import {
  CalendarEvent,
  CalendarEventResponse,
  CalendarListResponse,
  AvailabilityRequest,
  AvailabilityResponse,
  CalendarCredentials,
  GoogleCalendarConfig,
} from '../types/calendar-types';
import { logger } from '../utils/logger';
import moment from 'moment-timezone';

export class GoogleCalendarProvider {
  private oauth2Client: OAuth2Client;
  private calendar: calendar_v3.Calendar;

  constructor(private config: GoogleCalendarConfig) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  private setCredentials(credentials: CalendarCredentials): void {
    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiresAt?.getTime(),
    });
  }

  private convertToGoogleEvent(event: CalendarEvent): calendar_v3.Schema$Event {
    const googleEvent: calendar_v3.Schema$Event = {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: event.timezone,
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: event.timezone,
      },
      attendees: event.attendees.map((attendee) => ({
        email: attendee.email,
        displayName: attendee.name,
        responseStatus: this.mapAttendeeStatus(attendee.status),
        optional: !attendee.required,
      })),
      reminders: {
        useDefault: false,
        overrides:
          event.reminders?.map((reminder) => ({
            method: reminder.method,
            minutes: reminder.minutes,
          })) || [],
      },
    };

    // Handle recurrence
    if (event.recurrence) {
      googleEvent.recurrence = this.convertRecurrenceRule(event.recurrence);
    }

    return googleEvent;
  }

  private convertFromGoogleEvent(googleEvent: calendar_v3.Schema$Event): CalendarEvent {
    return {
      id: googleEvent.id,
      title: googleEvent.summary || '',
      description: googleEvent.description,
      startTime: new Date(googleEvent.start?.dateTime || googleEvent.start?.date || ''),
      endTime: new Date(googleEvent.end?.dateTime || googleEvent.end?.date || ''),
      timezone: googleEvent.start?.timeZone || 'UTC',
      location: googleEvent.location,
      attendees:
        googleEvent.attendees?.map((attendee) => ({
          email: attendee.email || '',
          name: attendee.displayName,
          status: this.mapGoogleAttendeeStatus(attendee.responseStatus),
          required: !attendee.optional,
        })) || [],
      organizer: googleEvent.organizer
        ? {
            email: googleEvent.organizer.email || '',
            name: googleEvent.organizer.displayName,
          }
        : undefined,
      reminders:
        googleEvent.reminders?.overrides?.map((reminder) => ({
          method: reminder.method as 'email' | 'popup',
          minutes: reminder.minutes || 0,
        })) || [],
    };
  }

  private mapAttendeeStatus(status?: string): string {
    switch (status) {
      case 'accepted':
        return 'accepted';
      case 'declined':
        return 'declined';
      case 'tentative':
        return 'tentative';
      default:
        return 'needsAction';
    }
  }

  private mapGoogleAttendeeStatus(
    status?: string
  ): 'accepted' | 'declined' | 'tentative' | 'needsAction' {
    switch (status) {
      case 'accepted':
        return 'accepted';
      case 'declined':
        return 'declined';
      case 'tentative':
        return 'tentative';
      default:
        return 'needsAction';
    }
  }

  private convertRecurrenceRule(recurrence: any): string[] {
    // Convert our recurrence rule to Google's RRULE format
    let rrule = `FREQ=${recurrence.frequency.toUpperCase()}`;

    if (recurrence.interval) {
      rrule += `;INTERVAL=${recurrence.interval}`;
    }

    if (recurrence.count) {
      rrule += `;COUNT=${recurrence.count}`;
    }

    if (recurrence.until) {
      rrule += `;UNTIL=${moment(recurrence.until).format('YYYYMMDD')}`;
    }

    if (recurrence.byWeekDay && recurrence.byWeekDay.length > 0) {
      const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const weekDays = recurrence.byWeekDay.map((day: number) => days[day]).join(',');
      rrule += `;BYDAY=${weekDays}`;
    }

    return [`RRULE:${rrule}`];
  }

  async createEvent(
    credentials: CalendarCredentials,
    event: CalendarEvent,
    calendarId: string = 'primary',
    sendNotifications: boolean = true
  ): Promise<CalendarEventResponse> {
    try {
      this.setCredentials(credentials);

      const googleEvent = this.convertToGoogleEvent(event);

      const response = await this.calendar.events.insert({
        calendarId,
        resource: googleEvent,
        sendNotifications,
      });

      logger.info('Google Calendar event created', {
        eventId: response.data.id,
        calendarId,
        organizationId: credentials.organizationId,
      });

      return {
        success: true,
        eventId: response.data.id,
        event: this.convertFromGoogleEvent(response.data),
      };
    } catch (error) {
      logger.error('Failed to create Google Calendar event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        calendarId,
        organizationId: credentials.organizationId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateEvent(
    credentials: CalendarCredentials,
    eventId: string,
    event: CalendarEvent,
    calendarId: string = 'primary',
    sendNotifications: boolean = true
  ): Promise<CalendarEventResponse> {
    try {
      this.setCredentials(credentials);

      const googleEvent = this.convertToGoogleEvent(event);

      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        resource: googleEvent,
        sendNotifications,
      });

      logger.info('Google Calendar event updated', {
        eventId,
        calendarId,
        organizationId: credentials.organizationId,
      });

      return {
        success: true,
        eventId: response.data.id,
        event: this.convertFromGoogleEvent(response.data),
      };
    } catch (error) {
      logger.error('Failed to update Google Calendar event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId,
        calendarId,
        organizationId: credentials.organizationId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteEvent(
    credentials: CalendarCredentials,
    eventId: string,
    calendarId: string = 'primary',
    sendNotifications: boolean = true
  ): Promise<CalendarEventResponse> {
    try {
      this.setCredentials(credentials);

      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendNotifications,
      });

      logger.info('Google Calendar event deleted', {
        eventId,
        calendarId,
        organizationId: credentials.organizationId,
      });

      return {
        success: true,
        eventId,
      };
    } catch (error) {
      logger.error('Failed to delete Google Calendar event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId,
        calendarId,
        organizationId: credentials.organizationId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async listEvents(
    credentials: CalendarCredentials,
    calendarId: string = 'primary',
    startTime?: Date,
    endTime?: Date,
    maxResults: number = 250
  ): Promise<CalendarListResponse> {
    try {
      this.setCredentials(credentials);

      const response = await this.calendar.events.list({
        calendarId,
        timeMin: startTime?.toISOString(),
        timeMax: endTime?.toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items?.map((item) => this.convertFromGoogleEvent(item)) || [];

      logger.info('Google Calendar events listed', {
        count: events.length,
        calendarId,
        organizationId: credentials.organizationId,
      });

      return {
        success: true,
        events,
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      logger.error('Failed to list Google Calendar events', {
        error: error instanceof Error ? error.message : 'Unknown error',
        calendarId,
        organizationId: credentials.organizationId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getAvailability(
    credentials: CalendarCredentials,
    request: AvailabilityRequest
  ): Promise<AvailabilityResponse[]> {
    try {
      this.setCredentials(credentials);

      const response = await this.calendar.freebusy.query({
        resource: {
          timeMin: request.startTime.toISOString(),
          timeMax: request.endTime.toISOString(),
          items: request.emails.map((email) => ({ id: email })),
          timeZone: request.timezone,
        },
      });

      const results: AvailabilityResponse[] = [];

      for (const email of request.emails) {
        const busyTimes = response.data.calendars?.[email]?.busy || [];
        const slots = busyTimes.map((busy) => ({
          startTime: new Date(busy.start || ''),
          endTime: new Date(busy.end || ''),
          status: 'busy' as const,
        }));

        results.push({
          email,
          slots,
        });
      }

      logger.info('Google Calendar availability retrieved', {
        emails: request.emails,
        organizationId: credentials.organizationId,
      });

      return results;
    } catch (error) {
      logger.error('Failed to get Google Calendar availability', {
        error: error instanceof Error ? error.message : 'Unknown error',
        emails: request.emails,
        organizationId: credentials.organizationId,
      });

      throw error;
    }
  }

  getAuthUrl(state?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
    });
  }

  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);

    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }> {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.oauth2Client.refreshAccessToken();

    return {
      accessToken: credentials.access_token!,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
    };
  }
}
