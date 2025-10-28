import { v4 as uuidv4 } from 'uuid';
import {
  WebhookPayload,
  NormalizedLifecycleEvent,
  EmployeeData,
  EventMetadata,
  TransformationRule,
} from '../types/webhook-types';
import { logger } from '../utils/logger';

export class EventTransformer {
  /**
   * Transform webhook payload to normalized lifecycle event
   */
  static async transformToLifecycleEvent(
    payload: WebhookPayload,
    transformationRules?: TransformationRule[]
  ): Promise<NormalizedLifecycleEvent[]> {
    try {
      switch (payload.source) {
        case 'workday':
          return this.transformWorkdayEvent(payload, transformationRules);
        case 'successfactors':
          return this.transformSuccessFactorsEvent(payload, transformationRules);
        case 'bamboohr':
          return this.transformBambooHREvent(payload, transformationRules);
        case 'generic':
          return this.transformGenericEvent(payload, transformationRules);
        default:
          throw new Error(`Unsupported source: ${payload.source}`);
      }
    } catch (error) {
      logger.error('Error transforming webhook payload', { error, payload });
      throw error;
    }
  }

  private static transformWorkdayEvent(
    payload: WebhookPayload,
    rules?: TransformationRule[]
  ): NormalizedLifecycleEvent[] {
    const events: NormalizedLifecycleEvent[] = [];

    // Workday can send multiple events in one payload
    const workdayEvents = Array.isArray(payload.data.events) ? payload.data.events : [payload.data];

    for (const event of workdayEvents) {
      const eventType = this.mapWorkdayEventType(event.eventType || payload.eventType);
      if (!eventType) continue;

      const employee = this.extractWorkdayEmployeeData(event, rules);
      if (!employee.id) continue;

      events.push({
        type: eventType,
        organizationId: payload.organizationId,
        employeeId: employee.id,
        payload: {
          employee,
          metadata: {
            source: 'workday',
            sourceEventId: event.id || event.eventId,
            sourceEventType: event.eventType || payload.eventType,
            processedAt: new Date(),
            version: '1.0',
          },
        },
        timestamp: new Date(event.timestamp || payload.timestamp),
        source: 'workday',
        correlationId: uuidv4(),
      });
    }

    return events;
  }

  private static transformSuccessFactorsEvent(
    payload: WebhookPayload,
    rules?: TransformationRule[]
  ): NormalizedLifecycleEvent[] {
    const eventType = this.mapSuccessFactorsEventType(payload.eventType);
    if (!eventType) return [];

    const employee = this.extractSuccessFactorsEmployeeData(payload.data, rules);
    if (!employee.id) return [];

    return [
      {
        type: eventType,
        organizationId: payload.organizationId,
        employeeId: employee.id,
        payload: {
          employee,
          metadata: {
            source: 'successfactors',
            sourceEventId: payload.data.eventId,
            sourceEventType: payload.eventType,
            processedAt: new Date(),
            version: '1.0',
          },
        },
        timestamp: new Date(payload.timestamp),
        source: 'successfactors',
        correlationId: uuidv4(),
      },
    ];
  }

  private static transformBambooHREvent(
    payload: WebhookPayload,
    rules?: TransformationRule[]
  ): NormalizedLifecycleEvent[] {
    const eventType = this.mapBambooHREventType(payload.eventType);
    if (!eventType) return [];

    const employee = this.extractBambooHREmployeeData(payload.data, rules);
    if (!employee.id) return [];

    return [
      {
        type: eventType,
        organizationId: payload.organizationId,
        employeeId: employee.id,
        payload: {
          employee,
          metadata: {
            source: 'bamboohr',
            sourceEventId: payload.data.id,
            sourceEventType: payload.eventType,
            processedAt: new Date(),
            version: '1.0',
          },
        },
        timestamp: new Date(payload.timestamp),
        source: 'bamboohr',
        correlationId: uuidv4(),
      },
    ];
  }

  private static transformGenericEvent(
    payload: WebhookPayload,
    rules?: TransformationRule[]
  ): NormalizedLifecycleEvent[] {
    const eventType = this.mapGenericEventType(payload.eventType);
    if (!eventType) return [];

    const employee = this.extractGenericEmployeeData(payload.data, rules);
    if (!employee.id) return [];

    return [
      {
        type: eventType,
        organizationId: payload.organizationId,
        employeeId: employee.id,
        payload: {
          employee,
          metadata: {
            source: 'generic',
            sourceEventId: payload.data.id || uuidv4(),
            sourceEventType: payload.eventType,
            processedAt: new Date(),
            version: '1.0',
          },
        },
        timestamp: new Date(payload.timestamp),
        source: 'generic',
        correlationId: uuidv4(),
      },
    ];
  }

  private static mapWorkdayEventType(eventType: string): NormalizedLifecycleEvent['type'] | null {
    const mapping: Record<string, NormalizedLifecycleEvent['type']> = {
      'worker.hire': 'employee.onboard',
      'worker.onboard': 'employee.onboard',
      'worker.terminate': 'employee.exit',
      'worker.transfer': 'employee.transfer',
      'worker.update': 'employee.update',
      'worker.change': 'employee.update',
    };
    return mapping[eventType.toLowerCase()] || null;
  }

  private static mapSuccessFactorsEventType(
    eventType: string
  ): NormalizedLifecycleEvent['type'] | null {
    const mapping: Record<string, NormalizedLifecycleEvent['type']> = {
      'employee.hired': 'employee.onboard',
      'employee.terminated': 'employee.exit',
      'employee.transferred': 'employee.transfer',
      'employee.updated': 'employee.update',
    };
    return mapping[eventType.toLowerCase()] || null;
  }

  private static mapBambooHREventType(eventType: string): NormalizedLifecycleEvent['type'] | null {
    const mapping: Record<string, NormalizedLifecycleEvent['type']> = {
      'employee.new': 'employee.onboard',
      'employee.terminated': 'employee.exit',
      'employee.updated': 'employee.update',
    };
    return mapping[eventType.toLowerCase()] || null;
  }

  private static mapGenericEventType(eventType: string): NormalizedLifecycleEvent['type'] | null {
    const mapping: Record<string, NormalizedLifecycleEvent['type']> = {
      onboard: 'employee.onboard',
      hire: 'employee.onboard',
      exit: 'employee.exit',
      terminate: 'employee.exit',
      transfer: 'employee.transfer',
      update: 'employee.update',
    };
    return mapping[eventType.toLowerCase()] || null;
  }

  private static extractWorkdayEmployeeData(data: any, rules?: TransformationRule[]): EmployeeData {
    const worker = data.worker || data;
    return this.applyTransformationRules(
      {
        id: worker.workerId || worker.id,
        email: worker.email || worker.workEmail,
        firstName: worker.firstName || worker.givenName,
        lastName: worker.lastName || worker.familyName,
        department: worker.department || worker.organizationUnit,
        jobTitle: worker.jobTitle || worker.position,
        managerId: worker.managerId || worker.supervisorId,
        startDate: worker.startDate ? new Date(worker.startDate) : undefined,
        endDate: worker.endDate ? new Date(worker.endDate) : undefined,
        location: worker.location || worker.workLocation,
        employeeType: worker.employeeType || worker.workerType,
        status: this.mapStatus(worker.status || 'active'),
      },
      rules
    );
  }

  private static extractSuccessFactorsEmployeeData(
    data: any,
    rules?: TransformationRule[]
  ): EmployeeData {
    return this.applyTransformationRules(
      {
        id: data.userId || data.employeeId,
        email: data.email || data.workEmail,
        firstName: data.firstName,
        lastName: data.lastName,
        department: data.department,
        jobTitle: data.jobTitle || data.title,
        managerId: data.managerId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        location: data.location,
        employeeType: data.employeeType,
        status: this.mapStatus(data.status || 'active'),
      },
      rules
    );
  }

  private static extractBambooHREmployeeData(
    data: any,
    rules?: TransformationRule[]
  ): EmployeeData {
    return this.applyTransformationRules(
      {
        id: data.id || data.employeeId,
        email: data.workEmail || data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        department: data.department,
        jobTitle: data.jobTitle,
        managerId: data.supervisorId,
        startDate: data.hireDate ? new Date(data.hireDate) : undefined,
        endDate: data.terminationDate ? new Date(data.terminationDate) : undefined,
        location: data.location,
        employeeType: data.employmentStatus,
        status: this.mapStatus(data.status || 'active'),
      },
      rules
    );
  }

  private static extractGenericEmployeeData(data: any, rules?: TransformationRule[]): EmployeeData {
    return this.applyTransformationRules(
      {
        id: data.id || data.employeeId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        department: data.department,
        jobTitle: data.jobTitle,
        managerId: data.managerId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        location: data.location,
        employeeType: data.employeeType,
        status: this.mapStatus(data.status || 'active'),
      },
      rules
    );
  }

  private static applyTransformationRules(
    employee: EmployeeData,
    rules?: TransformationRule[]
  ): EmployeeData {
    if (!rules || rules.length === 0) return employee;

    const transformed = { ...employee };

    for (const rule of rules) {
      const sourceValue = (employee as any)[rule.sourceField];
      if (sourceValue !== undefined) {
        let transformedValue = sourceValue;

        switch (rule.transformation) {
          case 'uppercase':
            transformedValue = String(sourceValue).toUpperCase();
            break;
          case 'lowercase':
            transformedValue = String(sourceValue).toLowerCase();
            break;
          case 'date':
            transformedValue = new Date(sourceValue);
            break;
          case 'boolean':
            transformedValue = Boolean(sourceValue);
            break;
        }

        (transformed as any)[rule.targetField] = transformedValue;
      } else if (rule.defaultValue !== undefined) {
        (transformed as any)[rule.targetField] = rule.defaultValue;
      }
    }

    return transformed;
  }

  private static mapStatus(status: string): 'active' | 'inactive' | 'terminated' {
    const normalizedStatus = status.toLowerCase();
    if (['active', 'employed', 'current'].includes(normalizedStatus)) return 'active';
    if (['inactive', 'suspended', 'leave'].includes(normalizedStatus)) return 'inactive';
    if (['terminated', 'ended', 'exit', 'quit'].includes(normalizedStatus)) return 'terminated';
    return 'active'; // default
  }
}
