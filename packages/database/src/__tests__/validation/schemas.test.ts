/**
 * Unit tests for validation schemas
 */

// Mock the setup to avoid database connection
jest.mock('../setup', () => ({
  getTestPool: jest.fn(),
}));

import {
  uuidSchema,
  timestampSchema,
  jsonSchema,
  organizationSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  employeeSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  workflowSchema,
  createWorkflowSchema,
  updateWorkflowSchema,
  workflowRunSchema,
  createWorkflowRunSchema,
  updateWorkflowRunSchema,
  workflowRunStatusSchema,
  nodeRunStatusSchema,
  retryPolicySchema,
  auditLogSchema,
  createAuditLogSchema,
} from '../../validation/schemas';
import { v4 as uuidv4 } from 'uuid';

describe('Validation Schemas', () => {
  describe('Base schemas', () => {
    describe('uuidSchema', () => {
      it('should validate valid UUIDs', () => {
        const validUuids = [
          uuidv4(),
          '123e4567-e89b-12d3-a456-426614174000',
          '00000000-0000-0000-0000-000000000000',
        ];

        validUuids.forEach((uuid) => {
          expect(() => uuidSchema.parse(uuid)).not.toThrow();
        });
      });

      it('should reject invalid UUIDs', () => {
        const invalidUuids = [
          'not-a-uuid',
          '123',
          '123e4567-e89b-12d3-a456',
          '123e4567-e89b-12d3-a456-42661417400g',
          '',
          null,
          undefined,
        ];

        invalidUuids.forEach((uuid) => {
          expect(() => uuidSchema.parse(uuid)).toThrow();
        });
      });
    });

    describe('timestampSchema', () => {
      it('should validate Date objects', () => {
        const validDates = [new Date(), new Date('2024-01-01'), new Date(0)];

        validDates.forEach((date) => {
          expect(() => timestampSchema.parse(date)).not.toThrow();
        });
      });

      it('should reject invalid dates', () => {
        const invalidDates = ['not-a-date', '2024-01-01', 123456789, null, undefined];

        invalidDates.forEach((date) => {
          expect(() => timestampSchema.parse(date)).toThrow();
        });
      });
    });

    describe('jsonSchema', () => {
      it('should validate JSON objects', () => {
        const validJson = [
          {},
          { key: 'value' },
          { nested: { object: true } },
          { array: [1, 2, 3] },
          { mixed: { string: 'test', number: 42, boolean: true } },
        ];

        validJson.forEach((json) => {
          expect(() => jsonSchema.parse(json)).not.toThrow();
        });
      });

      it('should use default empty object', () => {
        const result = jsonSchema.optional().default({}).parse(undefined);
        expect(result).toEqual({});
      });
    });
  });

  describe('Organization schemas', () => {
    const validOrgData = {
      org_id: uuidv4(),
      name: 'Test Organization',
      domain: 'test.com',
      plan: 'enterprise',
      settings: { feature1: true },
      created_at: new Date(),
      updated_at: new Date(),
    };

    describe('organizationSchema', () => {
      it('should validate complete organization data', () => {
        expect(() => organizationSchema.parse(validOrgData)).not.toThrow();
      });

      it('should reject invalid organization data', () => {
        const invalidCases = [
          { ...validOrgData, org_id: 'invalid-uuid' },
          { ...validOrgData, name: '' },
          { ...validOrgData, domain: '' },
          { ...validOrgData, plan: '' },
          { ...validOrgData, name: 'a'.repeat(256) }, // Too long
        ];

        invalidCases.forEach((data) => {
          expect(() => organizationSchema.parse(data)).toThrow();
        });
      });
    });

    describe('createOrganizationSchema', () => {
      it('should validate organization creation data', () => {
        const createData = {
          name: 'New Organization',
          domain: 'new.com',
          plan: 'starter',
          settings: { onboarding: true },
        };

        expect(() => createOrganizationSchema.parse(createData)).not.toThrow();
      });

      it('should use default settings', () => {
        const createData = {
          name: 'New Organization',
          domain: 'new.com',
          plan: 'starter',
        };

        const result = createOrganizationSchema.parse(createData);
        expect(result.settings).toEqual({});
      });
    });

    describe('updateOrganizationSchema', () => {
      it('should validate partial organization updates', () => {
        const updateData = {
          name: 'Updated Name',
          settings: { newFeature: true },
        };

        expect(() => updateOrganizationSchema.parse(updateData)).not.toThrow();
      });

      it('should allow empty updates', () => {
        expect(() => updateOrganizationSchema.parse({})).not.toThrow();
      });
    });
  });

  describe('Employee schemas', () => {
    const validEmployeeData = {
      employee_id: uuidv4(),
      org_id: uuidv4(),
      employee_number: 'EMP001',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      department: 'Engineering',
      job_title: 'Software Engineer',
      manager_id: uuidv4(),
      hire_date: new Date(),
      termination_date: new Date(),
      status: 'active',
      profile_data: { skills: ['JavaScript'] },
      created_at: new Date(),
      updated_at: new Date(),
    };

    describe('employeeSchema', () => {
      it('should validate complete employee data', () => {
        expect(() => employeeSchema.parse(validEmployeeData)).not.toThrow();
      });

      it('should validate minimal employee data', () => {
        const minimalData = {
          employee_id: uuidv4(),
          org_id: uuidv4(),
          email: 'minimal@example.com',
          first_name: 'Jane',
          last_name: 'Smith',
          created_at: new Date(),
          updated_at: new Date(),
        };

        expect(() => employeeSchema.parse(minimalData)).not.toThrow();
      });

      it('should reject invalid employee data', () => {
        const invalidCases = [
          { ...validEmployeeData, email: 'invalid-email' },
          { ...validEmployeeData, first_name: '' },
          { ...validEmployeeData, last_name: '' },
          { ...validEmployeeData, first_name: 'a'.repeat(101) }, // Too long
        ];

        invalidCases.forEach((data) => {
          expect(() => employeeSchema.parse(data)).toThrow();
        });
      });
    });

    describe('createEmployeeSchema', () => {
      it('should validate employee creation data', () => {
        const createData = {
          org_id: uuidv4(),
          email: 'new@example.com',
          first_name: 'New',
          last_name: 'Employee',
          department: 'HR',
          profile_data: { onboarding: true },
        };

        expect(() => createEmployeeSchema.parse(createData)).not.toThrow();
      });

      it('should use default values', () => {
        const createData = {
          org_id: uuidv4(),
          email: 'default@example.com',
          first_name: 'Default',
          last_name: 'Employee',
        };

        const result = createEmployeeSchema.parse(createData);
        expect(result.status).toBe('active');
        expect(result.profile_data).toEqual({});
      });
    });
  });

  describe('Workflow schemas', () => {
    const validWorkflowData = {
      workflow_id: uuidv4(),
      org_id: uuidv4(),
      name: 'Test Workflow',
      description: 'A test workflow',
      event_trigger: 'employee.onboard',
      version: 1,
      is_active: true,
      definition: { nodes: [], edges: [] },
      created_by: uuidv4(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    describe('workflowSchema', () => {
      it('should validate complete workflow data', () => {
        expect(() => workflowSchema.parse(validWorkflowData)).not.toThrow();
      });

      it('should reject invalid workflow data', () => {
        const invalidCases = [
          { ...validWorkflowData, name: '' },
          { ...validWorkflowData, event_trigger: '' },
          { ...validWorkflowData, version: 0 },
          { ...validWorkflowData, version: -1 },
        ];

        invalidCases.forEach((data) => {
          expect(() => workflowSchema.parse(data)).toThrow();
        });
      });
    });

    describe('createWorkflowSchema', () => {
      it('should validate workflow creation data', () => {
        const createData = {
          org_id: uuidv4(),
          name: 'New Workflow',
          event_trigger: 'employee.exit',
          definition: { nodes: [{ id: 'start', type: 'trigger' }] },
        };

        expect(() => createWorkflowSchema.parse(createData)).not.toThrow();
      });

      it('should use default values', () => {
        const createData = {
          org_id: uuidv4(),
          name: 'Default Workflow',
          event_trigger: 'employee.update',
          definition: {},
        };

        const result = createWorkflowSchema.parse(createData);
        expect(result.version).toBe(1);
        expect(result.is_active).toBe(true);
      });
    });
  });

  describe('Workflow run schemas', () => {
    const validRunData = {
      run_id: uuidv4(),
      org_id: uuidv4(),
      workflow_id: uuidv4(),
      employee_id: uuidv4(),
      trigger_event: 'employee.onboard',
      status: 'PENDING' as const,
      context: { department: 'Engineering' },
      error_details: { error: 'Test error' },
      started_at: new Date(),
      ended_at: new Date(),
      created_at: new Date(),
    };

    describe('workflowRunSchema', () => {
      it('should validate complete workflow run data', () => {
        expect(() => workflowRunSchema.parse(validRunData)).not.toThrow();
      });

      it('should validate minimal workflow run data', () => {
        const minimalData = {
          run_id: uuidv4(),
          org_id: uuidv4(),
          workflow_id: uuidv4(),
          trigger_event: 'employee.transfer',
          started_at: new Date(),
          created_at: new Date(),
        };

        expect(() => workflowRunSchema.parse(minimalData)).not.toThrow();
      });
    });

    describe('workflowRunStatusSchema', () => {
      it('should validate valid statuses', () => {
        const validStatuses = [
          'PENDING',
          'RUNNING',
          'PAUSED',
          'COMPLETED',
          'FAILED',
          'CANCELLED',
          'TIMEOUT',
        ];

        validStatuses.forEach((status) => {
          expect(() => workflowRunStatusSchema.parse(status)).not.toThrow();
        });
      });

      it('should reject invalid statuses', () => {
        const invalidStatuses = ['INVALID', 'pending', 'Running', ''];

        invalidStatuses.forEach((status) => {
          expect(() => workflowRunStatusSchema.parse(status)).toThrow();
        });
      });
    });

    describe('nodeRunStatusSchema', () => {
      it('should validate valid node run statuses', () => {
        const validStatuses = [
          'QUEUED',
          'RUNNING',
          'COMPLETED',
          'FAILED',
          'SKIPPED',
          'TIMEOUT',
          'CANCELLED',
        ];

        validStatuses.forEach((status) => {
          expect(() => nodeRunStatusSchema.parse(status)).not.toThrow();
        });
      });

      it('should reject invalid node run statuses', () => {
        const invalidStatuses = ['INVALID', 'queued', 'Running', ''];

        invalidStatuses.forEach((status) => {
          expect(() => nodeRunStatusSchema.parse(status)).toThrow();
        });
      });
    });
  });

  describe('Retry policy schema', () => {
    describe('retryPolicySchema', () => {
      it('should validate complete retry policy', () => {
        const validPolicy = {
          maxRetries: 5,
          backoffMs: 2000,
          backoffMultiplier: 1.5,
          maxBackoffMs: 600000,
          retryableErrors: ['NETWORK_ERROR', 'TIMEOUT'],
        };

        expect(() => retryPolicySchema.parse(validPolicy)).not.toThrow();
      });

      it('should use default values', () => {
        const result = retryPolicySchema.parse({});

        expect(result.maxRetries).toBe(3);
        expect(result.backoffMs).toBe(1000);
        expect(result.backoffMultiplier).toBe(2);
        expect(result.maxBackoffMs).toBe(300000);
      });

      it('should reject invalid retry policy', () => {
        const invalidCases = [
          { maxRetries: -1 },
          { backoffMs: -100 },
          { backoffMultiplier: 0.5 },
          { maxBackoffMs: -1000 },
        ];

        invalidCases.forEach((policy) => {
          expect(() => retryPolicySchema.parse(policy)).toThrow();
        });
      });
    });
  });

  describe('Audit log schemas', () => {
    const validAuditData = {
      audit_id: uuidv4(),
      org_id: uuidv4(),
      entity_type: 'employee',
      entity_id: uuidv4(),
      action: 'create',
      actor_id: uuidv4(),
      actor_type: 'user',
      changes: { field: 'old_value -> new_value' },
      metadata: { source: 'api' },
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      created_at: new Date(),
    };

    describe('auditLogSchema', () => {
      it('should validate complete audit log data', () => {
        expect(() => auditLogSchema.parse(validAuditData)).not.toThrow();
      });

      it('should validate minimal audit log data', () => {
        const minimalData = {
          audit_id: uuidv4(),
          org_id: uuidv4(),
          entity_type: 'workflow',
          entity_id: uuidv4(),
          action: 'update',
          created_at: new Date(),
        };

        expect(() => auditLogSchema.parse(minimalData)).not.toThrow();
      });
    });

    describe('createAuditLogSchema', () => {
      it('should validate audit log creation data', () => {
        const createData = {
          org_id: uuidv4(),
          entity_type: 'workflow_run',
          entity_id: uuidv4(),
          action: 'execute',
          actor_id: uuidv4(),
          changes: { status: 'PENDING -> RUNNING' },
        };

        expect(() => createAuditLogSchema.parse(createData)).not.toThrow();
      });

      it('should use default values', () => {
        const createData = {
          org_id: uuidv4(),
          entity_type: 'user',
          entity_id: uuidv4(),
          action: 'login',
        };

        const result = createAuditLogSchema.parse(createData);
        expect(result.actor_type).toBe('user');
        expect(result.metadata).toEqual({});
      });
    });
  });

  describe('Schema composition and edge cases', () => {
    it('should handle nested JSON validation', () => {
      const complexJson = {
        level1: {
          level2: {
            level3: {
              array: [1, 2, { nested: true }],
              nullValue: null,
              booleanValue: false,
            },
          },
        },
      };

      expect(() => jsonSchema.parse(complexJson)).not.toThrow();
    });

    it('should validate UUID references between schemas', () => {
      const orgId = uuidv4();
      const workflowId = uuidv4();

      const workflowData = {
        org_id: orgId,
        name: 'Cross-reference Test',
        event_trigger: 'test.event',
        definition: {},
      };

      const runData = {
        org_id: orgId,
        workflow_id: workflowId,
        trigger_event: 'test.event',
        started_at: new Date(),
      };

      expect(() => createWorkflowSchema.parse(workflowData)).not.toThrow();
      expect(() => createWorkflowRunSchema.parse(runData)).not.toThrow();
    });

    it('should handle optional fields correctly', () => {
      const employeeWithOptionals = {
        org_id: uuidv4(),
        email: 'optional@test.com',
        first_name: 'Optional',
        last_name: 'Fields',
        // All other fields are optional
      };

      const result = createEmployeeSchema.parse(employeeWithOptionals);
      expect(result.status).toBe('active');
      expect(result.profile_data).toEqual({});
    });
  });
});
