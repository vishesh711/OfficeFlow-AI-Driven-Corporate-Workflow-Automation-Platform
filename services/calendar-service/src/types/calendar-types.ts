export interface CalendarProvider {
  name: string;
  type: 'google' | 'microsoft';
  config: GoogleCalendarConfig | MicrosoftCalendarConfig;
  isDefault: boolean;
}

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface MicrosoftCalendarConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  location?: string;
  attendees: CalendarAttendee[];
  organizer?: CalendarAttendee;
  recurrence?: RecurrenceRule;
  reminders?: EventReminder[];
  metadata?: Record<string, any>;
}

export interface CalendarAttendee {
  email: string;
  name?: string;
  status?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  required?: boolean;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  count?: number;
  until?: Date;
  byWeekDay?: number[];
  byMonthDay?: number[];
}

export interface EventReminder {
  method: 'email' | 'popup';
  minutes: number;
}

export interface AvailabilitySlot {
  startTime: Date;
  endTime: Date;
  status: 'free' | 'busy' | 'tentative' | 'outOfOffice';
}

export interface AvailabilityRequest {
  emails: string[];
  startTime: Date;
  endTime: Date;
  timezone: string;
}

export interface AvailabilityResponse {
  email: string;
  slots: AvailabilitySlot[];
}

export interface CalendarEventRequest {
  provider: string;
  calendarId?: string;
  event: CalendarEvent;
  sendNotifications?: boolean;
}

export interface CalendarEventResponse {
  success: boolean;
  eventId?: string;
  event?: CalendarEvent;
  error?: string;
  metadata?: Record<string, any>;
}

export interface CalendarListRequest {
  provider: string;
  startTime?: Date;
  endTime?: Date;
  calendarId?: string;
  maxResults?: number;
}

export interface CalendarListResponse {
  success: boolean;
  events?: CalendarEvent[];
  nextPageToken?: string;
  error?: string;
}

export interface FindMeetingTimeRequest {
  attendees: string[];
  duration: number; // in minutes
  startDate: Date;
  endDate: Date;
  workingHours?: {
    start: string; // HH:mm format
    end: string; // HH:mm format
    days: number[]; // 0-6, Sunday-Saturday
  };
  timezone: string;
  bufferTime?: number; // minutes between meetings
}

export interface FindMeetingTimeResponse {
  success: boolean;
  suggestions?: MeetingTimeSuggestion[];
  error?: string;
}

export interface MeetingTimeSuggestion {
  startTime: Date;
  endTime: Date;
  confidence: number; // 0-1, higher is better
  attendeeAvailability: {
    email: string;
    status: 'available' | 'busy' | 'tentative';
  }[];
}

export interface CalendarCredentials {
  provider: 'google' | 'microsoft';
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  email: string;
  organizationId: string;
  userId: string;
}

export interface CalendarServiceConfig {
  port: number;
  defaultTimezone: string;
  providers: CalendarProvider[];
  workingHours: {
    start: string;
    end: string;
    days: number[];
  };
  meetingDefaults: {
    duration: number;
    bufferTime: number;
    maxSuggestions: number;
  };
}
