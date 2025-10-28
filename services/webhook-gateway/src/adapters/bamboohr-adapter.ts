import axios, { AxiosInstance } from 'axios';
import { BaseHRMSAdapter } from './base-hrms-adapter';
import { NormalizedLifecycleEvent, PollingConfig } from '../types/webhook-types';
import { EventTransformer } from '../services/event-transformer';
import { logger } from '../utils/logger';

interface BambooHREmployee {
  id: string;
  workEmail: string;
  firstName: string;
  lastName: string;
  department?: string;
  jobTitle?: string;
  supervisorId?: string;
  hireDate?: string;
  terminationDate?: string;
  location?: string;
  employmentStatus?: string;
  status: string;
  lastChanged?: string;
}

interface BambooHREvent {
  id: string;
  eventType: string;
  timestamp: string;
  employee: BambooHREmployee;
}

export class BambooHRAdapter extends BaseHRMSAdapter {
  private client: AxiosInstance;
  private subdomain: string;
  private apiKey: string;
  private lastSyncTimestamp?: string;

  constructor(config: PollingConfig) {
    super(config);

    this.subdomain = config.credentials.subdomain;
    this.apiKey = config.credentials.apiKey;

    this.client = axios.create({
      baseURL: `https://api.bamboohr.com/api/gateway.php/${this.subdomain}/v1`,
      timeout: 30000,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:x`).toString('base64')}`,
      },
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('BambooHR API request', { url: config.url, method: config.method });
        return config;
      },
      (error) => {
        logger.error('BambooHR API request error', { error });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('BambooHR API response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('BambooHR API response error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  get source(): string {
    return 'bamboohr';
  }

  /**
   * Poll BambooHR for new employee lifecycle events
   * Note: BambooHR doesn't have a native event API, so we poll for changes
   */
  async poll(): Promise<NormalizedLifecycleEvent[]> {
    if (!this.shouldPoll()) {
      return [];
    }

    try {
      logger.info('Starting BambooHR polling', { organizationId: this.config.organizationId });

      const events = await this.fetchChangedEmployees();
      const normalizedEvents: NormalizedLifecycleEvent[] = [];

      for (const event of events) {
        try {
          const webhookPayload = {
            source: 'bamboohr' as const,
            eventType: event.eventType,
            timestamp: new Date(event.timestamp),
            organizationId: this.config.organizationId,
            employeeId: event.employee.id,
            data: event.employee,
            headers: {},
          };

          const transformed = await EventTransformer.transformToLifecycleEvent(webhookPayload);
          normalizedEvents.push(...transformed);
        } catch (error) {
          logger.error('Error transforming BambooHR event', { event, error });
        }
      }

      this.updateLastPolledAt();

      logger.info('BambooHR polling completed', {
        organizationId: this.config.organizationId,
        eventsFound: events.length,
        normalizedEvents: normalizedEvents.length,
      });

      return normalizedEvents;
    } catch (error) {
      logger.error('BambooHR polling failed', {
        organizationId: this.config.organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Fetch changed employees from BambooHR
   * Since BambooHR doesn't have events, we compare current state with last known state
   */
  private async fetchChangedEmployees(): Promise<BambooHREvent[]> {
    const events: BambooHREvent[] = [];

    try {
      // Get all employees with their basic information
      const fields = [
        'id',
        'workEmail',
        'firstName',
        'lastName',
        'department',
        'jobTitle',
        'supervisorId',
        'hireDate',
        'terminationDate',
        'location',
        'employmentStatus',
        'status',
        'lastChanged',
      ];

      const response = await this.client.get('/employees/directory', {
        params: {
          fields: fields.join(','),
        },
      });

      const employees: BambooHREmployee[] = response.data.employees || [];

      // Filter employees that have changed since last poll
      const changedEmployees = this.filterChangedEmployees(employees);

      // Generate events based on employee changes
      for (const employee of changedEmployees) {
        const eventType = this.determineEventType(employee);
        if (eventType) {
          events.push({
            id: `bamboohr-${employee.id}-${Date.now()}`,
            eventType,
            timestamp: employee.lastChanged || new Date().toISOString(),
            employee,
          });
        }
      }

      // Update last sync timestamp
      this.lastSyncTimestamp = new Date().toISOString();

      return events;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('BambooHR authentication failed');
        } else if (error.response?.status === 403) {
          throw new Error('BambooHR access forbidden - check API key permissions');
        } else if (error.response?.status === 429) {
          throw new Error('BambooHR rate limit exceeded');
        }
      }
      throw error;
    }
  }

  /**
   * Filter employees that have changed since last poll
   */
  private filterChangedEmployees(employees: BambooHREmployee[]): BambooHREmployee[] {
    if (!this.config.lastPolledAt) {
      // First poll - consider all active employees as new
      return employees.filter((emp) => emp.status === 'Active');
    }

    const lastPollTime = this.config.lastPolledAt.getTime();

    return employees.filter((employee) => {
      if (!employee.lastChanged) {
        return false;
      }

      const lastChangedTime = new Date(employee.lastChanged).getTime();
      return lastChangedTime > lastPollTime;
    });
  }

  /**
   * Determine event type based on employee data
   */
  private determineEventType(employee: BambooHREmployee): string | null {
    // Check if employee was recently hired
    if (employee.hireDate) {
      const hireDate = new Date(employee.hireDate);
      const daysSinceHire = (Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceHire <= 7 && employee.status === 'Active') {
        return 'employee.new';
      }
    }

    // Check if employee was terminated
    if (employee.terminationDate && employee.status === 'Inactive') {
      return 'employee.terminated';
    }

    // Default to update for other changes
    if (employee.status === 'Active') {
      return 'employee.updated';
    }

    return null;
  }

  /**
   * Health check for BambooHR connection
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, any> }> {
    try {
      const response = await this.client.get('/meta/users', { timeout: 5000 });

      return {
        healthy: response.status === 200,
        details: {
          status: response.status,
          subdomain: this.subdomain,
          lastPolledAt: this.config.lastPolledAt,
          lastSyncTimestamp: this.lastSyncTimestamp,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('BambooHR health check failed', { error });

      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          subdomain: this.subdomain,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Test connection to BambooHR
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/meta/users', { timeout: 10000 });
      return response.status === 200;
    } catch (error) {
      logger.error('BambooHR connection test failed', { error });
      return false;
    }
  }

  /**
   * Get BambooHR company information
   */
  async getCompanyInfo(): Promise<any> {
    try {
      const response = await this.client.get('/meta/users');
      return {
        subdomain: this.subdomain,
        users: response.data,
      };
    } catch (error) {
      logger.error('Failed to get BambooHR company info', { error });
      throw error;
    }
  }

  /**
   * Get employee by ID
   */
  async getEmployee(employeeId: string): Promise<BambooHREmployee | null> {
    try {
      const response = await this.client.get(`/employees/${employeeId}`, {
        params: {
          fields:
            'id,workEmail,firstName,lastName,department,jobTitle,supervisorId,hireDate,terminationDate,location,employmentStatus,status,lastChanged',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get BambooHR employee', { employeeId, error });
      throw error;
    }
  }

  /**
   * Get all employees
   */
  async getAllEmployees(): Promise<BambooHREmployee[]> {
    try {
      const response = await this.client.get('/employees/directory', {
        params: {
          fields:
            'id,workEmail,firstName,lastName,department,jobTitle,supervisorId,hireDate,terminationDate,location,employmentStatus,status,lastChanged',
        },
      });
      return response.data.employees || [];
    } catch (error) {
      logger.error('Failed to get all BambooHR employees', { error });
      throw error;
    }
  }
}
