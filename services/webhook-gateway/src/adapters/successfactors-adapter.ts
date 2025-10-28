import axios, { AxiosInstance } from 'axios';
import { BaseHRMSAdapter } from './base-hrms-adapter';
import { NormalizedLifecycleEvent, PollingConfig } from '../types/webhook-types';
import { EventTransformer } from '../services/event-transformer';
import { logger } from '../utils/logger';

interface SuccessFactorsEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  userId: string;
  employee: {
    userId: string;
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

interface SuccessFactorsResponse {
  d: {
    results: SuccessFactorsEvent[];
    __next?: string;
  };
}

export class SuccessFactorsAdapter extends BaseHRMSAdapter {
  private client: AxiosInstance;
  private apiUrl: string;
  private companyId: string;
  private lastEventTimestamp?: string;

  constructor(config: PollingConfig) {
    super(config);

    this.apiUrl = config.credentials.apiUrl;
    this.companyId = config.credentials.companyId;

    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
      auth: {
        username: config.credentials.username,
        password: config.credentials.password,
      },
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        DataServiceVersion: '2.0',
      },
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('SuccessFactors API request', { url: config.url, method: config.method });
        return config;
      },
      (error) => {
        logger.error('SuccessFactors API request error', { error });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('SuccessFactors API response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('SuccessFactors API response error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  get source(): string {
    return 'successfactors';
  }

  /**
   * Poll SuccessFactors for new employee lifecycle events
   */
  async poll(): Promise<NormalizedLifecycleEvent[]> {
    if (!this.shouldPoll()) {
      return [];
    }

    try {
      logger.info('Starting SuccessFactors polling', {
        organizationId: this.config.organizationId,
      });

      const events = await this.fetchEvents();
      const normalizedEvents: NormalizedLifecycleEvent[] = [];

      for (const event of events) {
        try {
          const webhookPayload = {
            source: 'successfactors' as const,
            eventType: event.eventType,
            timestamp: new Date(event.timestamp),
            organizationId: this.config.organizationId,
            employeeId: event.userId,
            data: event,
            headers: {},
          };

          const transformed = await EventTransformer.transformToLifecycleEvent(webhookPayload);
          normalizedEvents.push(...transformed);
        } catch (error) {
          logger.error('Error transforming SuccessFactors event', { event, error });
        }
      }

      this.updateLastPolledAt();

      logger.info('SuccessFactors polling completed', {
        organizationId: this.config.organizationId,
        eventsFound: events.length,
        normalizedEvents: normalizedEvents.length,
      });

      return normalizedEvents;
    } catch (error) {
      logger.error('SuccessFactors polling failed', {
        organizationId: this.config.organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Fetch events from SuccessFactors API
   */
  private async fetchEvents(): Promise<SuccessFactorsEvent[]> {
    const allEvents: SuccessFactorsEvent[] = [];
    let nextUrl: string | undefined;

    do {
      try {
        let url = `/odata/v2/EventLog`;
        const params: string[] = [];

        // Add filters
        const filters: string[] = [];

        // Filter by event types
        const eventTypes = [
          'employee.hired',
          'employee.terminated',
          'employee.transferred',
          'employee.updated',
        ];
        filters.push(`eventType in ('${eventTypes.join("','")}')`);

        // Filter by timestamp if available
        if (this.lastEventTimestamp) {
          filters.push(`timestamp gt datetime'${this.lastEventTimestamp}'`);
        } else if (this.config.lastPolledAt) {
          const isoDate = this.config.lastPolledAt.toISOString();
          filters.push(`timestamp gt datetime'${isoDate}'`);
        }

        if (filters.length > 0) {
          params.push(`$filter=${encodeURIComponent(filters.join(' and '))}`);
        }

        // Add ordering and pagination
        params.push('$orderby=timestamp asc');
        params.push('$top=100');

        if (params.length > 0) {
          url += `?${params.join('&')}`;
        }

        const response = await this.client.get<SuccessFactorsResponse>(nextUrl || url);
        const data = response.data.d;

        allEvents.push(...data.results);
        nextUrl = data.__next;

        // Update last event timestamp
        if (data.results.length > 0) {
          this.lastEventTimestamp = data.results[data.results.length - 1].timestamp;
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
            throw new Error('SuccessFactors authentication failed');
          } else if (error.response?.status === 403) {
            throw new Error('SuccessFactors access forbidden - check permissions');
          } else if (error.response?.status === 429) {
            throw new Error('SuccessFactors rate limit exceeded');
          }
        }
        throw error;
      }
    } while (nextUrl);

    return allEvents;
  }

  /**
   * Health check for SuccessFactors connection
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, any> }> {
    try {
      const response = await this.client.get('/odata/v2/$metadata', { timeout: 5000 });

      return {
        healthy: response.status === 200,
        details: {
          status: response.status,
          apiUrl: this.apiUrl,
          companyId: this.companyId,
          lastPolledAt: this.config.lastPolledAt,
          lastEventTimestamp: this.lastEventTimestamp,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('SuccessFactors health check failed', { error });

      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          apiUrl: this.apiUrl,
          companyId: this.companyId,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Test connection to SuccessFactors
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/odata/v2/$metadata', { timeout: 10000 });
      return response.status === 200;
    } catch (error) {
      logger.error('SuccessFactors connection test failed', { error });
      return false;
    }
  }

  /**
   * Get SuccessFactors company information
   */
  async getCompanyInfo(): Promise<any> {
    try {
      const response = await this.client.get(`/odata/v2/Company('${this.companyId}')`);
      return response.data.d;
    } catch (error) {
      logger.error('Failed to get SuccessFactors company info', { error });
      throw error;
    }
  }

  /**
   * Get available event types from SuccessFactors
   */
  async getEventTypes(): Promise<string[]> {
    try {
      const response = await this.client.get('/odata/v2/EventType');
      const eventTypes = response.data.d.results.map((et: any) => et.eventType);
      return eventTypes;
    } catch (error) {
      logger.error('Failed to get SuccessFactors event types', { error });
      throw error;
    }
  }
}
