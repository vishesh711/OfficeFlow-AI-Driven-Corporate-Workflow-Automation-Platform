/**
 * Unit tests for WorkflowRepository
 */

import { WorkflowRepositoryImpl } from '../../repositories/workflow';
import {
  getTestPool,
  createTestOrganization,
  createTestUser,
  createTestWorkflow,
  cleanupTestData,
} from '../setup';
import { Pool } from 'pg';

describe('WorkflowRepository', () => {
  let pool: Pool;
  let repository: WorkflowRepositoryImpl;
  let testOrgId: string;
  let testUserId: string;
  let createdWorkflowIds: string[] = [];
  let createdUserIds: string[] = [];
  let createdOrgIds: string[] = [];

  beforeAll(async () => {
    pool = getTestPool();
    repository = new WorkflowRepositoryImpl();

    // Create test organization
    const orgData = createTestOrganization();
    testOrgId = orgData.org_id;
    createdOrgIds.push(testOrgId);

    await pool.query(
      'INSERT INTO organizations (org_id, name, domain, plan, settings) VALUES ($1, $2, $3, $4, $5)',
      [orgData.org_id, orgData.name, orgData.domain, orgData.plan, JSON.stringify(orgData.settings)]
    );

    // Create test user
    const userData = createTestUser(testOrgId);
    testUserId = userData.user_id;
    createdUserIds.push(testUserId);

    await pool.query(
      'INSERT INTO users (user_id, org_id, email, first_name, last_name, role, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        userData.user_id,
        userData.org_id,
        userData.email,
        userData.first_name,
        userData.last_name,
        userData.role,
        userData.is_active,
      ]
    );
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData(pool, 'workflows', 'workflow_id', createdWorkflowIds);
    await cleanupTestData(pool, 'users', 'user_id', createdUserIds);
    await cleanupTestData(pool, 'organizations', 'org_id', createdOrgIds);
  });

  afterEach(async () => {
    // Clean up workflows created in tests
    if (createdWorkflowIds.length > 0) {
      await cleanupTestData(pool, 'workflows', 'workflow_id', createdWorkflowIds);
      createdWorkflowIds = [];
    }
  });

  describe('create', () => {
    it('should create workflow with valid data', async () => {
      const workflowData = createTestWorkflow(testOrgId, testUserId);

      const created = await repository.create(workflowData);
      createdWorkflowIds.push(created.workflow_id);

      expect(created).toMatchObject({
        ...workflowData,
        workflow_id: expect.any(String),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('should validate workflow definition JSON', async () => {
      const workflowData = createTestWorkflow(testOrgId, testUserId);
      workflowData.definition = 'invalid-json' as any;

      await expect(repository.create(workflowData)).rejects.toThrow();
    });

    it('should set default values', async () => {
      const workflowData = {
        org_id: testOrgId,
        name: 'Test Workflow',
        event_trigger: 'employee.onboard',
        definition: { nodes: [], edges: [] },
        created_by: testUserId,
      };

      const created = await repository.create(workflowData);
      createdWorkflowIds.push(created.workflow_id);

      expect(created.version).toBe(1);
      expect(created.is_active).toBe(true);
    });
  });

  describe('findByOrganization', () => {
    it('should find all workflows in organization', async () => {
      const workflows = [
        createTestWorkflow(testOrgId, testUserId),
        createTestWorkflow(testOrgId, testUserId),
        createTestWorkflow(testOrgId, testUserId),
      ];

      for (const workflow of workflows) {
        const created = await repository.create(workflow);
        createdWorkflowIds.push(created.workflow_id);
      }

      const found = await repository.findByOrganization(testOrgId);
      expect(found.length).toBeGreaterThanOrEqual(3);
      expect(found.every((w) => w.org_id === testOrgId)).toBe(true);
    });
  });

  describe('findByEventTrigger', () => {
    it('should find workflows by event trigger', async () => {
      const workflows = [
        { ...createTestWorkflow(testOrgId, testUserId), event_trigger: 'employee.onboard' },
        { ...createTestWorkflow(testOrgId, testUserId), event_trigger: 'employee.onboard' },
        { ...createTestWorkflow(testOrgId, testUserId), event_trigger: 'employee.exit' },
      ];

      for (const workflow of workflows) {
        const created = await repository.create(workflow);
        createdWorkflowIds.push(created.workflow_id);
      }

      const onboardWorkflows = await repository.findByEventTrigger('employee.onboard');
      expect(onboardWorkflows.length).toBeGreaterThanOrEqual(2);
      expect(onboardWorkflows.every((w) => w.event_trigger === 'employee.onboard')).toBe(true);
    });
  });

  describe('findActiveByTrigger', () => {
    it('should find only active workflows by trigger', async () => {
      const workflows = [
        {
          ...createTestWorkflow(testOrgId, testUserId),
          event_trigger: 'employee.onboard',
          is_active: true,
        },
        {
          ...createTestWorkflow(testOrgId, testUserId),
          event_trigger: 'employee.onboard',
          is_active: false,
        },
        {
          ...createTestWorkflow(testOrgId, testUserId),
          event_trigger: 'employee.onboard',
          is_active: true,
        },
      ];

      for (const workflow of workflows) {
        const created = await repository.create(workflow);
        createdWorkflowIds.push(created.workflow_id);
      }

      const activeWorkflows = await repository.findActiveByTrigger(testOrgId, 'employee.onboard');
      expect(activeWorkflows.length).toBe(2);
      expect(activeWorkflows.every((w) => w.is_active === true)).toBe(true);
    });
  });

  describe('findByCreator', () => {
    it('should find workflows by creator', async () => {
      const workflows = [
        createTestWorkflow(testOrgId, testUserId),
        createTestWorkflow(testOrgId, testUserId),
      ];

      for (const workflow of workflows) {
        const created = await repository.create(workflow);
        createdWorkflowIds.push(created.workflow_id);
      }

      const createdWorkflows = await repository.findByCreator(testUserId);
      expect(createdWorkflows.length).toBeGreaterThanOrEqual(2);
      expect(createdWorkflows.every((w) => w.created_by === testUserId)).toBe(true);
    });
  });

  describe('setActive', () => {
    it('should activate/deactivate workflow', async () => {
      const workflowData = createTestWorkflow(testOrgId, testUserId);
      const created = await repository.create(workflowData);
      createdWorkflowIds.push(created.workflow_id);

      // Deactivate
      const deactivated = await repository.setActive(created.workflow_id, false);
      expect(deactivated?.is_active).toBe(false);

      // Reactivate
      const reactivated = await repository.setActive(created.workflow_id, true);
      expect(reactivated?.is_active).toBe(true);
    });
  });

  describe('search', () => {
    it('should search workflows by name', async () => {
      const workflowData = createTestWorkflow(testOrgId, testUserId);
      workflowData.name = 'Searchable Workflow Name';

      const created = await repository.create(workflowData);
      createdWorkflowIds.push(created.workflow_id);

      const results = await repository.search(testOrgId, 'Searchable');
      expect(results.some((w) => w.workflow_id === created.workflow_id)).toBe(true);
    });

    it('should search workflows by description', async () => {
      const workflowData = createTestWorkflow(testOrgId, testUserId);
      workflowData.description = 'Searchable workflow description';

      const created = await repository.create(workflowData);
      createdWorkflowIds.push(created.workflow_id);

      const results = await repository.search(testOrgId, 'Searchable');
      expect(results.some((w) => w.workflow_id === created.workflow_id)).toBe(true);
    });

    it('should limit search results', async () => {
      const results = await repository.search(testOrgId, 'test', 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('complex workflow definition', () => {
    it('should handle complex workflow definitions', async () => {
      const complexDefinition = {
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            name: 'Employee Onboard Trigger',
            params: { eventType: 'employee.onboard' },
          },
          {
            id: 'create_email',
            type: 'identity',
            name: 'Create Email Account',
            params: {
              provider: 'google_workspace',
              template: 'standard_employee',
            },
          },
          {
            id: 'send_welcome',
            type: 'email',
            name: 'Send Welcome Email',
            params: {
              template: 'welcome_template',
              personalized: true,
            },
          },
          {
            id: 'schedule_meeting',
            type: 'calendar',
            name: 'Schedule Onboarding Meeting',
            params: {
              duration: 60,
              attendees: ['manager', 'hr'],
            },
          },
        ],
        edges: [
          { from: 'start', to: 'create_email' },
          { from: 'create_email', to: 'send_welcome' },
          { from: 'send_welcome', to: 'schedule_meeting' },
        ],
        metadata: {
          version: '1.0',
          author: 'system',
          tags: ['onboarding', 'automated'],
        },
      };

      const workflowData = createTestWorkflow(testOrgId, testUserId);
      workflowData.definition = complexDefinition;

      const created = await repository.create(workflowData);
      createdWorkflowIds.push(created.workflow_id);

      expect(created.definition).toEqual(complexDefinition);

      const found = await repository.findById(created.workflow_id);
      expect(found?.definition).toEqual(complexDefinition);
    });
  });

  describe('data validation', () => {
    it('should validate required fields', async () => {
      const invalidData = {
        org_id: testOrgId,
        name: '', // Empty name should fail
        event_trigger: 'employee.onboard',
        definition: {},
      };

      await expect(repository.create(invalidData as any)).rejects.toThrow();
    });

    it('should validate event trigger format', async () => {
      const workflowData = createTestWorkflow(testOrgId, testUserId);
      workflowData.event_trigger = ''; // Empty trigger should fail

      await expect(repository.create(workflowData)).rejects.toThrow();
    });

    it('should validate version number', async () => {
      const workflowData = createTestWorkflow(testOrgId, testUserId);
      workflowData.version = 0; // Version must be >= 1

      await expect(repository.create(workflowData)).rejects.toThrow();
    });
  });

  describe('transaction handling', () => {
    it('should handle transaction rollback on error', async () => {
      const workflowData1 = createTestWorkflow(testOrgId, testUserId);
      const workflowData2 = createTestWorkflow(testOrgId, testUserId);

      await expect(
        repository.transaction(async (client) => {
          // Create first workflow
          await client.query(
            'INSERT INTO workflows (org_id, name, event_trigger, definition) VALUES ($1, $2, $3, $4)',
            [
              workflowData1.org_id,
              workflowData1.name,
              workflowData1.event_trigger,
              JSON.stringify(workflowData1.definition),
            ]
          );

          // Force an error
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');

      // Verify no workflow was created
      const workflows = await repository.findByOrganization(testOrgId);
      const createdWorkflow = workflows.find((w) => w.name === workflowData1.name);
      expect(createdWorkflow).toBeUndefined();
    });
  });
});
