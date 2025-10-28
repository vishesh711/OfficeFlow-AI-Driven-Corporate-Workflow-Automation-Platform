import axios, { AxiosInstance } from 'axios';
import { BaseHRMSAdapter } from './base-hrms-adapter';
import { NormalizedLifecycleEvent, PollingConfig } from '../types/webhook-types';
import { EventTransformer } from '../services/event-transformer';
import { logger } from '../utils/logger';

interface WorkdayEvent {
  id: string;
  eventType: string;
  timestamp: string;
  worker: {
    workerId: string;
    email: string;
    firstName: string;
    lastName: string;
    department?: string;
    jobTitle?: string;
    managerId?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    employeeType?: string;
    status: string;
  };
}

interface WorkdayResponse {
  events: WorkdayEvent[];
  hasMore: boolean;
  nextCursor?: string;
}

export class WorkdayAdapter extends BaseHRMSAdapter {
  private client: AxiosInstance;
  private tenantUrl: string;
  private lastEventId?: string;

  constructor(config: PollingConfig) {
    super(config);

    this.tenantUrl = config.credentials.tenantUrl;

    this.client = axios.create({
      baseURL: this.tenantUrl,
      timeout: 30000,
      auth: {
        username: config.credentials.username,
        password: config.credentials.password,
      },
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Workday API request', { url: config.url, method: config.method });
        return config;
      },
      (error) => {
        logger.error('Workday API request error', { error });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Workday API response', { status: response.status, url: response.config.url });
        return response;
      },
      (error) => {
        logger.error('Workday API response error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  get source(): string {
    return 'workday';
  }

  /**
   * Poll Workday for new employee lifecycle events
   */
  async poll(): Promise<NormalizedLifecycleEvent[]> {
    if (!this.shouldPoll()) {
      return [];
    }

    try {
      logger.info('Starting Workday polling', { organizationId: this.config.organizationId });

      const events = await this.fetchEvents();
      const normalizedEvents: NormalizedLifecycleEvent[] = [];

      for (const event of events) {
        try {
          const webhookPayload = {
            source: 'workday' as const,
            eventType: event.eventType,
            timestamp: new Date(event.timestamp),
            organizationId: this.config.organizationId,
            employeeId: event.worker.workerId,
            data: event,
            headers: {},
          };

          const transformed = await EventTransformer.transformToLifecycleEvent(webhookPayload);
          normalizedEvents.push(...transformed);
        } catch (error) {
          logger.error('Error transforming Workday event', { event, error });
        }
      }

      this.updateLastPolledAt();

      logger.info('Workday polling completed', {
        organizationId: this.config.organizationId,
        eventsFound: events.length,
        normalizedEvents: normalizedEvents.length,
      });

      return normalizedEvents;
    } catch (error) {
      logger.error('Workday polling failed', {
        organizationId: this.config.organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Fetch events from Workday API
   */
  private async fetchEvents(): Promise<WorkdayEvent[]> {
    const allEvents: WorkdayEvent[] = [];
    let hasMore = true;
    let cursor = this.lastEventId;

    while (hasMore) {
      const params: any = {
        limit: 100,
        eventTypes: [
          'worker.hire',
          'worker.onboard',
          'worker.terminate',
          'worker.transfer',
          'worker.update',
        ].join(','),
      };

      if (cursor) {
        params.cursor = cursor;
      } else if (this.config.lastPolledAt) {
        params.since = this.config.lastPolledAt.toISOString();
      }

      try {
        const response = await this.client.get<WorkdayResponse>('/api/v1/events', { params });
        const data = response.data;

        allEvents.push(...data.events);
        hasMore = data.hasMore;
        cursor = data.nextCursor;

        // Update last event ID for next poll
        if (data.events.length > 0) {
          this.lastEventId = data.events[data.events.length - 1].id;
        }

        // Prevent infinite loops
        if (allEvents.length > 1000) {
          logger.warn('Too many events in single poll, truncating', {
            organizationId: this.config.organizationId,
            eventCount: allEvents.length,
          });
          break;
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 401) {
            throw new Error('Workday authentication failed');
          } else if (error.response?.status === 403) {
            throw new Error('Workday access forbidden - check permissions');
          } else if (error.response?.status === 429) {
            throw new Error('Workday rate limit exceeded');
          }
        }
        throw error;
      }
    }

    return allEvents;
  }

  /**
   * Health check for Workday connection
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, any> }> {
    try {
      const response = await this.client.get('/api/v1/health', { timeout: 5000 });

      return {
        healthy: response.status === 200,
        details: {
          status: response.status,
          tenantUrl: this.tenantUrl,
          lastPolledAt: this.config.lastPolledAt,
          lastEventId: this.lastEventId,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('Workday health check failed', { error });

      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          tenantUrl: this.tenantUrl,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Test connection to Workday
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v1/health', { timeout: 10000 });
      return response.status === 200;
    } catch (error) {
      logger.error('Workday connection test failed', { error });
      return false;
    }
  }

  /**
   * Get Workday tenant information
   */
  async getTenantInfo(): Promise<any> {
    try {
      const response = await this.client.get('/api/v1/tenant');
      return response.data;
    } catch (error) {
      logger.error('Failed to get Workday tenant info', { error });
      throw error;
    }
  }
}
