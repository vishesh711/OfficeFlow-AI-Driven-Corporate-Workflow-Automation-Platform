import { GoogleCalendarProvider } from '../providers/google-calendar-provider';
import { MicrosoftCalendarProvider } from '../providers/microsoft-calendar-provider';
import {
  CalendarEvent,
  CalendarEventRequest,
  CalendarEventResponse,
  CalendarListRequest,
  CalendarListResponse,
  AvailabilityRequest,
  AvailabilityResponse,
  FindMeetingTimeRequest,
  FindMeetingTimeResponse,
  MeetingTimeSuggestion,
  CalendarCredentials,
  CalendarServiceConfig,
} from '../types/calendar-types';
import { logger } from '../utils/logger';
import moment from 'moment-timezone';

export class CalendarService {
  private googleProvider?: GoogleCalendarProvider;
  private microsoftProvider?: MicrosoftCalendarProvider;

  constructor(private config: CalendarServiceConfig) {
    // Initialize providers based on configuration
    const googleConfig = config.providers.find((p) => p.type === 'google');
    if (googleConfig && googleConfig.type === 'google') {
      this.googleProvider = new GoogleCalendarProvider(googleConfig.config);
    }

    const microsoftConfig = config.providers.find((p) => p.type === 'microsoft');
    if (microsoftConfig && microsoftConfig.type === 'microsoft') {
      this.microsoftProvider = new MicrosoftCalendarProvider(microsoftConfig.config);
    }
  }

  private getProvider(providerName: string) {
    switch (providerName) {
      case 'google':
        if (!this.googleProvider) {
          throw new Error('Google Calendar provider not configured');
        }
        return this.googleProvider;
      case 'microsoft':
        if (!this.microsoftProvider) {
          throw new Error('Microsoft Calendar provider not configured');
        }
        return this.microsoftProvider;
      default:
        throw new Error(`Unknown calendar provider: ${providerName}`);
    }
  }

  async createEvent(
    request: CalendarEventRequest,
    credentials: CalendarCredentials
  ): Promise<CalendarEventResponse> {
    try {
      const provider = this.getProvider(request.provider);

      // Validate timezone
      if (!moment.tz.zone(request.event.timezone)) {
        request.event.timezone = this.config.defaultTimezone;
      }

      const result = await provider.createEvent(
        credentials,
        request.event,
        request.calendarId,
        request.sendNotifications
      );

      logger.info('Calendar event created', {
        provider: request.provider,
        eventId: result.eventId,
        organizationId: credentials.organizationId,
        success: result.success,
      });

      return result;
    } catch (error) {
      logger.error('Failed to create calendar event', {
        provider: request.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: credentials.organizationId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateEvent(
    provider: string,
    eventId: string,
    event: CalendarEvent,
    credentials: CalendarCredentials,
    calendarId?: string,
    sendNotifications: boolean = true
  ): Promise<CalendarEventResponse> {
    try {
      const calendarProvider = this.getProvider(provider);

      // Validate timezone
      if (!moment.tz.zone(event.timezone)) {
        event.timezone = this.config.defaultTimezone;
      }

      const result = await calendarProvider.updateEvent(
        credentials,
        eventId,
        event,
        calendarId,
        sendNotifications
      );

      logger.info('Calendar event updated', {
        provider,
        eventId,
        organizationId: credentials.organizationId,
        success: result.success,
      });

      return result;
    } catch (error) {
      logger.error('Failed to update calendar event', {
        provider,
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: credentials.organizationId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteEvent(
    provider: string,
    eventId: string,
    credentials: CalendarCredentials,
    calendarId?: string,
    sendNotifications: boolean = true
  ): Promise<CalendarEventResponse> {
    try {
      const calendarProvider = this.getProvider(provider);

      const result = await calendarProvider.deleteEvent(
        credentials,
        eventId,
        calendarId,
        sendNotifications
      );

      logger.info('Calendar event deleted', {
        provider,
        eventId,
        organizationId: credentials.organizationId,
        success: result.success,
      });

      return result;
    } catch (error) {
      logger.error('Failed to delete calendar event', {
        provider,
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: credentials.organizationId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async listEvents(
    request: CalendarListRequest,
    credentials: CalendarCredentials
  ): Promise<CalendarListResponse> {
    try {
      const provider = this.getProvider(request.provider);

      const result = await provider.listEvents(
        credentials,
        request.calendarId,
        request.startTime,
        request.endTime,
        request.maxResults
      );

      logger.info('Calendar events listed', {
        provider: request.provider,
        count: result.events?.length || 0,
        organizationId: credentials.organizationId,
        success: result.success,
      });

      return result;
    } catch (error) {
      logger.error('Failed to list calendar events', {
        provider: request.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: credentials.organizationId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getAvailability(
    provider: string,
    request: AvailabilityRequest,
    credentials: CalendarCredentials
  ): Promise<AvailabilityResponse[]> {
    try {
      const calendarProvider = this.getProvider(provider);

      // Validate timezone
      if (!moment.tz.zone(request.timezone)) {
        request.timezone = this.config.defaultTimezone;
      }

      const result = await calendarProvider.getAvailability(credentials, request);

      logger.info('Calendar availability retrieved', {
        provider,
        emails: request.emails,
        organizationId: credentials.organizationId,
      });

      return result;
    } catch (error) {
      logger.error('Failed to get calendar availability', {
        provider,
        emails: request.emails,
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: credentials.organizationId,
      });

      throw error;
    }
  }

  async findMeetingTime(
    provider: string,
    request: FindMeetingTimeRequest,
    credentials: CalendarCredentials
  ): Promise<FindMeetingTimeResponse> {
    try {
      // Get availability for all attendees
      const availabilityRequest: AvailabilityRequest = {
        emails: request.attendees,
        startTime: request.startDate,
        endTime: request.endDate,
        timezone: request.timezone,
      };

      const availability = await this.getAvailability(provider, availabilityRequest, credentials);

      // Find available time slots
      const suggestions = this.findAvailableSlots(request, availability);

      logger.info('Meeting time suggestions found', {
        provider,
        attendees: request.attendees,
        suggestionsCount: suggestions.length,
        organizationId: credentials.organizationId,
      });

      return {
        success: true,
        suggestions,
      };
    } catch (error) {
      logger.error('Failed to find meeting time', {
        provider,
        attendees: request.attendees,
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: credentials.organizationId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private findAvailableSlots(
    request: FindMeetingTimeRequest,
    availability: AvailabilityResponse[]
  ): MeetingTimeSuggestion[] {
    const suggestions: MeetingTimeSuggestion[] = [];
    const workingHours = request.workingHours || this.config.workingHours;
    const bufferTime = request.bufferTime || this.config.meetingDefaults.bufferTime;
    const durationMs = request.duration * 60 * 1000;
    const bufferMs = bufferTime * 60 * 1000;

    // Create a map of busy times for each attendee
    const busyTimes = new Map<string, Array<{ start: Date; end: Date }>>();
    availability.forEach((response) => {
      busyTimes.set(
        response.email,
        response.slots
          .filter((slot) => slot.status === 'busy')
          .map((slot) => ({
            start: slot.startTime,
            end: slot.endTime,
          }))
      );
    });

    // Generate time slots within working hours
    const currentDate = moment.tz(request.startDate, request.timezone);
    const endDate = moment.tz(request.endDate, request.timezone);

    while (currentDate.isBefore(endDate)) {
      // Skip weekends if not in working days
      if (!workingHours.days.includes(currentDate.day())) {
        currentDate.add(1, 'day').startOf('day');
        continue;
      }

      // Set working hours for the current day
      const dayStart = currentDate
        .clone()
        .hour(parseInt(workingHours.start.split(':')[0]))
        .minute(parseInt(workingHours.start.split(':')[1]))
        .second(0);

      const dayEnd = currentDate
        .clone()
        .hour(parseInt(workingHours.end.split(':')[0]))
        .minute(parseInt(workingHours.end.split(':')[1]))
        .second(0);

      // Find available slots in 15-minute increments
      const slotStart = dayStart.clone();
      while (slotStart.clone().add(request.duration, 'minutes').isBefore(dayEnd)) {
        const slotEnd = slotStart.clone().add(request.duration, 'minutes');

        // Check if this slot conflicts with any attendee's busy time
        const conflicts = this.checkConflicts(
          slotStart.toDate(),
          slotEnd.toDate(),
          busyTimes,
          bufferMs
        );

        if (conflicts.length === 0) {
          // All attendees are available
          suggestions.push({
            startTime: slotStart.toDate(),
            endTime: slotEnd.toDate(),
            confidence: 1.0,
            attendeeAvailability: request.attendees.map((email) => ({
              email,
              status: 'available' as const,
            })),
          });
        } else if (conflicts.length < request.attendees.length) {
          // Some attendees are available
          const confidence =
            (request.attendees.length - conflicts.length) / request.attendees.length;
          if (confidence >= 0.5) {
            // At least 50% available
            suggestions.push({
              startTime: slotStart.toDate(),
              endTime: slotEnd.toDate(),
              confidence,
              attendeeAvailability: request.attendees.map((email) => ({
                email,
                status: conflicts.includes(email) ? ('busy' as const) : ('available' as const),
              })),
            });
          }
        }

        slotStart.add(15, 'minutes'); // 15-minute increments
      }

      currentDate.add(1, 'day').startOf('day');
    }

    // Sort by confidence (highest first) and limit results
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.meetingDefaults.maxSuggestions);
  }

  private checkConflicts(
    slotStart: Date,
    slotEnd: Date,
    busyTimes: Map<string, Array<{ start: Date; end: Date }>>,
    bufferMs: number
  ): string[] {
    const conflicts: string[] = [];

    busyTimes.forEach((times, email) => {
      const hasConflict = times.some((busy) => {
        const busyStart = new Date(busy.start.getTime() - bufferMs);
        const busyEnd = new Date(busy.end.getTime() + bufferMs);

        return slotStart < busyEnd && slotEnd > busyStart;
      });

      if (hasConflict) {
        conflicts.push(email);
      }
    });

    return conflicts;
  }

  getAuthUrl(provider: string, state?: string): string {
    const calendarProvider = this.getProvider(provider);
    return calendarProvider.getAuthUrl(state);
  }

  async exchangeCodeForTokens(
    provider: string,
    code: string
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const calendarProvider = this.getProvider(provider);
    return calendarProvider.exchangeCodeForTokens(code);
  }

  async refreshAccessToken(
    provider: string,
    refreshToken: string
  ): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }> {
    const calendarProvider = this.getProvider(provider);
    return calendarProvider.refreshAccessToken(refreshToken);
  }
}
