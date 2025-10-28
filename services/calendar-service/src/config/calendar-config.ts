import { CalendarServiceConfig, CalendarProvider } from '../types/calendar-types';

export const getCalendarConfig = (): CalendarServiceConfig => {
  const providers: CalendarProvider[] = [];

  // Google Calendar Provider
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push({
      name: 'google',
      type: 'google',
      config: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri:
          process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3004/auth/google/callback',
      },
      isDefault: true,
    });
  }

  // Microsoft Calendar Provider
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    providers.push({
      name: 'microsoft',
      type: 'microsoft',
      config: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
        redirectUri:
          process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3004/auth/microsoft/callback',
      },
      isDefault: !providers.length,
    });
  }

  return {
    port: parseInt(process.env.PORT || '3004'),
    defaultTimezone: process.env.DEFAULT_TIMEZONE || 'UTC',
    providers,
    workingHours: {
      start: process.env.WORKING_HOURS_START || '09:00',
      end: process.env.WORKING_HOURS_END || '17:00',
      days: process.env.WORKING_DAYS
        ? process.env.WORKING_DAYS.split(',').map((d) => parseInt(d))
        : [1, 2, 3, 4, 5], // Monday to Friday
    },
    meetingDefaults: {
      duration: parseInt(process.env.DEFAULT_MEETING_DURATION || '30'),
      bufferTime: parseInt(process.env.DEFAULT_BUFFER_TIME || '15'),
      maxSuggestions: parseInt(process.env.MAX_MEETING_SUGGESTIONS || '5'),
    },
  };
};
