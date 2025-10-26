import { ConfidentialClientApplication } from '@azure/msal-node';
import axios, { AxiosInstance } from 'axios';
import { 
  CalendarEvent, 
  CalendarEventResponse, 
  CalendarListResponse, 
  AvailabilityRequest, 
  AvailabilityResponse,
  CalendarCredentials,
  MicrosoftCalendarConfig
} from '../types/calendar-types';
import { logger } from '../utils/logger';
import moment from 'moment-timezone';

interface MicrosoftEvent {
  id?: string;
  subject: string;
  body?: {
    contentType: 'HTML' | 'Text';
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    status: {
      response: string;
      time: string;
    };
    type: string;
  }>;
  organizer?: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  recurrence?: any;
  isReminderOn?: boolean;
  reminderMinutesBeforeStart?: number;
}

export class MicrosoftCalendarProvider {
  private msalClient: ConfidentialClientApplication;
  private graphClient: AxiosInstance;

  constructor(private config: MicrosoftCalendarConfig) {
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
      },
    });

    this.graphClient = axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private setAuthHeader(accessToken: string): void {
    this.graphClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  }

  private convertToMicrosoftEvent(event: CalendarEvent): MicrosoftEvent {
    const microsoftEvent: MicrosoftEvent = {
      subject: event.title,
      body: event.description ? {
        contentType: 'HTML',
        content: event.description,
      } : undefined,
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: event.timezone,
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: event.timezone,
      },
      location: event.location ? {
        displayName: event.location,
      } : undefined,
      attendees: event.attendees.map(attendee => ({
        emailAddress: {
          address: attendee.email,
          name: attendee.name,
        },
        status: {
          response: this.mapAttendeeStatus(attendee.status),
          time: new Date().toISOString(),
        },
        type: attendee.required ? 'required' : 'optional',
      })),
      isReminderOn: event.reminders && event.reminders.length > 0,
      reminderMinutesBeforeStart: event.reminders?.[0]?.minutes || 15,
    };

    // Handle recurrence
    if (event.recurrence) {
      microsoftEvent.recurrence = this.convertRecurrenceRule(event.recurrence);
    }

    return microsoftEvent;
  }

  private convertFromMicrosoftEvent(microsoftEvent: MicrosoftEvent): CalendarEvent {
    return {
      id: microsoftEvent.id,
      title: microsoftEvent.subject || '',
      description: microsoftEvent.body?.content,
      startTime: new Date(microsoftEvent.start.dateTime),
      endTime: new Date(microsoftEvent.end.dateTime),
      timezone: microsoftEvent.start.timeZone || 'UTC',
      location: microsoftEvent.location?.displayName,
      attendees: microsoftEvent.attendees?.map(attendee => ({
        email: attendee.emailAddress.address,
        name: attendee.emailAddress.name,
        status: this.mapMicrosoftAttendeeStatus(attendee.status.response),
        required: attendee.type === 'required',
      })) || [],
      organizer: microsoftEvent.organizer ? {
        email: microsoftEvent.organizer.emailAddress.address,
        name: microsoftEvent.organizer.emailAddress.name,
      } : undefined,
      reminders: microsoftEvent.isReminderOn ? [{
        method: 'popup',
        minutes: microsoftEvent.reminderMinutesBeforeStart || 15,
      }] : [],
    };
  }

  private mapAttendeeStatus(status?: string): string {
    switch (status) {
      case 'accepted': return 'accepted';
      case 'declined': return 'declined';
      case 'tentative': return 'tentativelyAccepted';
      default: return 'none';
    }
  }

  private mapMicrosoftAttendeeStatus(status: string): 'accepted' | 'declined' | 'tentative' | 'needsAction' {
    switch (status) {
      case 'accepted': return 'accepted';
      case 'declined': return 'declined';
      case 'tentativelyAccepted': return 'tentative';
      default: return 'needsAction';
    }
  }

  private convertRecurrenceRule(recurrence: any): any {
    // Convert our recurrence rule to Microsoft Graph format
    const pattern: any = {
      type: recurrence.frequency,
      interval: recurrence.interval || 1,
    };

    if (recurrence.byWeekDay && recurrence.byWeekDay.length > 0) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      pattern.daysOfWeek = recurrence.byWeekDay.map((day: number) => days[day]);
    }

    if (recurrence.byMonthDay && recurrence.byMonthDay.length > 0) {
      pattern.dayOfMonth = recurrence.byMonthDay[0];
    }

    const range: any = {
      type: recurrence.count ? 'numbered' : recurrence.until ? 'endDate' : 'noEnd',
    };

    if (recurrence.count) {
      range.numberOfOccurrences = recurrence.count;
    }

    if (recurrence.until) {
      range.endDate = moment(recurrence.until).format('YYYY-MM-DD');
    }

    return {
      pattern,
      range,
    };
  }

  async createEvent(
    credentials: CalendarCredentials,
    event: CalendarEvent,
    calendarId: string = 'primary'
  ): Promise<CalendarEventResponse> {
    try {
      this.setAuthHeader(credentials.accessToken);
      
      const microsoftEvent = this.convertToMicrosoftEvent(event);
      const endpoint = calendarId === 'primary' ? '/me/events' : `/me/calendars/${calendarId}/events`;
      
      const response = await this.graphClient.post(endpoint, microsoftEvent);

      logger.info('Microsoft Calendar event created', {
        eventId: response.data.id,
        calendarId,
        organizationId: credentials.organizationId,
      });

      return {
        success: true,
        eventId: response.data.id,
        event: this.convertFromMicrosoftEvent(response.data),
      };
    } catch (error) {
      logger.error('Failed to create Microsoft Calendar event', {
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
    calendarId: string = 'primary'
  ): Promise<CalendarEventResponse> {
    try {
      this.setAuthHeader(credentials.accessToken);
      
      const microsoftEvent = this.convertToMicrosoftEvent(event);
      const endpoint = calendarId === 'primary' ? 
        `/me/events/${eventId}` : 
        `/me/calendars/${calendarId}/events/${eventId}`;
      
      const response = await this.graphClient.patch(endpoint, microsoftEvent);

      logger.info('Microsoft Calendar event updated', {
        eventId,
        calendarId,
        organizationId: credentials.organizationId,
      });

      return {
        success: true,
        eventId: response.data.id,
        event: this.convertFromMicrosoftEvent(response.data),
      };
    } catch (error) {
      logger.error('Failed to update Microsoft Calendar event', {
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
    calendarId: string = 'primary'
  ): Promise<CalendarEventResponse> {
    try {
      this.setAuthHeader(credentials.accessToken);
      
      const endpoint = calendarId === 'primary' ? 
        `/me/events/${eventId}` : 
        `/me/calendars/${calendarId}/events/${eventId}`;
      
      await this.graphClient.delete(endpoint);

      logger.info('Microsoft Calendar event deleted', {
        eventId,
        calendarId,
        organizationId: credentials.organizationId,
      });

      return {
        success: true,
        eventId,
      };
    } catch (error) {
      logger.error('Failed to delete Microsoft Calendar event', {
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
      this.setAuthHeader(credentials.accessToken);
      
      const params = new URLSearchParams();
      if (startTime) params.append('startDateTime', startTime.toISOString());
      if (endTime) params.append('endDateTime', endTime.toISOString());
      params.append('$top', maxResults.toString());
      params.append('$orderby', 'start/dateTime');

      const endpoint = calendarId === 'primary' ? 
        `/me/events?${params.toString()}` : 
        `/me/calendars/${calendarId}/events?${params.toString()}`;
      
      const response = await this.graphClient.get(endpoint);
      const events = response.data.value?.map((item: MicrosoftEvent) => this.convertFromMicrosoftEvent(item)) || [];

      logger.info('Microsoft Calendar events listed', {
        count: events.length,
        calendarId,
        organizationId: credentials.organizationId,
      });

      return {
        success: true,
        events,
        nextPageToken: response.data['@odata.nextLink'],
      };
    } catch (error) {
      logger.error('Failed to list Microsoft Calendar events', {
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
      this.setAuthHeader(credentials.accessToken);
      
      const requestBody = {
        schedules: request.emails,
        startTime: {
          dateTime: request.startTime.toISOString(),
          timeZone: request.timezone,
        },
        endTime: {
          dateTime: request.endTime.toISOString(),
          timeZone: request.timezone,
        },
        availabilityViewInterval: 15, // 15-minute intervals
      };

      const response = await this.graphClient.post('/me/calendar/getSchedule', requestBody);
      const results: AvailabilityResponse[] = [];
      
      response.data.value?.forEach((schedule: any, index: number) => {
        const email = request.emails[index];
        const slots = schedule.busyViewEntries?.map((entry: any) => ({
          startTime: new Date(entry.start.dateTime),
          endTime: new Date(entry.end.dateTime),
          status: this.mapMicrosoftBusyStatus(entry.status),
        })) || [];

        results.push({
          email,
          slots,
        });
      });

      logger.info('Microsoft Calendar availability retrieved', {
        emails: request.emails,
        organizationId: credentials.organizationId,
      });

      return results;
    } catch (error) {
      logger.error('Failed to get Microsoft Calendar availability', {
        error: error instanceof Error ? error.message : 'Unknown error',
        emails: request.emails,
        organizationId: credentials.organizationId,
      });

      throw error;
    }
  }

  private mapMicrosoftBusyStatus(status: string): 'free' | 'busy' | 'tentative' | 'outOfOffice' {
    switch (status) {
      case 'free': return 'free';
      case 'busy': return 'busy';
      case 'tentative': return 'tentative';
      case 'oof': return 'outOfOffice';
      default: return 'free';
    }
  }

  getAuthUrl(state?: string): string {
    const scopes = [
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'https://graph.microsoft.com/Calendars.ReadWrite.Shared',
    ];

    return `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${this.config.clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(this.config.redirectUri)}&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `response_mode=query&` +
      (state ? `state=${encodeURIComponent(state)}&` : '');
  }

  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const clientCredentialRequest = {
      scopes: [
        'https://graph.microsoft.com/Calendars.ReadWrite',
        'https://graph.microsoft.com/Calendars.ReadWrite.Shared',
      ],
      code,
      redirectUri: this.config.redirectUri,
    };

    const response = await this.msalClient.acquireTokenByCode(clientCredentialRequest);
    
    return {
      accessToken: response!.accessToken,
      refreshToken: response!.refreshToken,
      expiresAt: response!.expiresOn ? new Date(response!.expiresOn) : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }> {
    const refreshTokenRequest = {
      scopes: [
        'https://graph.microsoft.com/Calendars.ReadWrite',
        'https://graph.microsoft.com/Calendars.ReadWrite.Shared',
      ],
      refreshToken,
    };

    const response = await this.msalClient.acquireTokenByRefreshToken(refreshTokenRequest);
    
    return {
      accessToken: response!.accessToken,
      expiresAt: response!.expiresOn ? new Date(response!.expiresOn) : undefined,
    };
  }
}