/**
 * Unit tests for WorkflowRunRepository
 */

import { WorkflowRunRepositoryImpl } from '../../repositories/workflow-run';
import { 
  getTestPool, 
  createTestOrganization, 
  createTestUser, 
  createTestEmployee,
  createTestWorkflow, 
  createTestWorkflowRun,
  cleanupTestData 
} from '../setup';
import { Pool } from 'pg';

describe('WorkflowRunRepository', () => {
  let pool: Pool;
  let repository: WorkflowRunRepositoryImpl;
  let testOrgId: string;
  let testUserId: string;
  let testEmployeeId: string;
  let testWorkflowId: string;
  let createdRunIds: string[] = [];
  let createdWorkflowIds: string[] = [];
  let createdEmployeeIds: string[] = [];
  let createdUserIds: string[] = [];
  let createdOrgIds: string[] = [];

  beforeAll(async () => {
    pool = getTestPool();
    repository = new WorkflowRunRepositoryImpl();
    
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
      [userData.user_id, userData.org_id, userData.email, userData.first_name, userData.last_name, userData.role, userData.is_active]
    );

    // Create test employee
    const employeeData = createTestEmployee(testOrgId);
    testEmployeeId = employeeData.employee_id;
    createdEmployeeIds.push(testEmployeeId);
    
    await pool.query(
      'INSERT INTO employees (employee_id, org_id, email, first_name, last_name, department, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [employeeData.employee_id, employeeData.org_id, employeeData.email, employeeData.first_name, employeeData.last_name, employeeData.department, employeeData.status]
    );

    // Create test workflow
    const workflowData = createTestWorkflow(testOrgId, testUserId);
    testWorkflowId = workflowData.workflow_id;
    createdWorkflowIds.push(testWorkflowId);
    
    await pool.query(
      'INSERT INTO workflows (workflow_id, org_id, name, event_trigger, definition, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
      [workflowData.workflow_id, workflowData.org_id, workflowData.name, workflowData.event_trigger, JSON.stringify(workflowData.definition), workflowData.created_by]
    );
  });

  afterAll(async () => {
    // Clean up test data in reverse order of creation
    await cleanupTestData(pool, 'workflow_runs', 'run_id', createdRunIds);
    await cleanupTestData(pool, 'workflows', 'workflow_id', createdWorkflowIds);
    await cleanupTestData(pool, 'employees', 'employee_id', createdEmployeeIds);
    await cleanupTestData(pool, 'users', 'user_id', createdUserIds);
    await cleanupTestData(pool, 'organizations', 'org_id', createdOrgIds);
  });

  afterEach(async () => {
    // Clean up workflow runs created in tests
    if (createdRunIds.length > 0) {
      await cleanupTestData(pool, 'workflow_runs', 'run_id', createdRunIds);
      createdRunIds = [];
    }
  });

  describe('create', () => {
    it('should create workflow run with valid data', async () => {
      const runData = createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId);
      
      const created = await repository.create(runData);
      createdRunIds.push(created.run_id);

      expect(created).toMatchObject({
        ...runData,
        run_id: expect.any(String),
        created_at: expect.any(Date),
      });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        org_id: testOrgId,
        workflow_id: 'invalid-uuid',
        trigger_event: '',
      };

      await expect(repository.create(invalidData as any)).rejects.toThrow();
    });

    it('should handle JSON context data', async () => {
      const runData = createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId);
      runData.context = {
        employeeData: {
          department: 'Engineering',
          startDate: '2024-01-15',
          manager: 'john.doe@company.com',
        },
        requestId: 'req-12345',
        priority: 'high',
      };

      const created = await repository.create(runData);
      createdRunIds.push(created.run_id);

      expect(created.context).toEqual(runData.context);
    });

    it('should set default status to PENDING', async () => {
      const runData = {
        org_id: testOrgId,
        workflow_id: testWorkflowId,
        employee_id: testEmployeeId,
        trigger_event: 'employee.onboard',
        started_at: new Date(),
      };

      const created = await repository.create(runData);
      createdRunIds.push(created.run_id);

      expect(created.status).toBe('PENDING');
    });
  });

  describe('findByOrganization', () => {
    it('should find all workflow runs in organization', async () => {
      const runs = [
        createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId),
        createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId),
        createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId),
      ];

      for (const run of runs) {
        const created = await repository.create(run);
        createdRunIds.push(created.run_id);
      }

      const found = await repository.findByOrganization(testOrgId);
      expect(found.length).toBeGreaterThanOrEqual(3);
      expect(found.every(r => r.org_id === testOrgId)).toBe(true);
    });
  });

  describe('findByWorkflow', () => {
    it('should find all runs for a workflow', async () => {
      const runs = [
        createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId),
        createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId),
      ];

      for (const run of runs) {
        const created = await repository.create(run);
        createdRunIds.push(created.run_id);
      }

      const found = await repository.findByWorkflow(testWorkflowId);
      expect(found.length).toBeGreaterThanOrEqual(2);
      expect(found.every(r => r.workflow_id === testWorkflowId)).toBe(true);
    });
  });

  describe('findByEmployee', () => {
    it('should find all runs for an employee', async () => {
      const runs = [
        createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId),
        createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId),
      ];

      for (const run of runs) {
        const created = await repository.create(run);
        createdRunIds.push(created.run_id);
      }

      const found = await repository.findByEmployee(testEmployeeId);
      expect(found.length).toBeGreaterThanOrEqual(2);
      expect(found.every(r => r.employee_id === testEmployeeId)).toBe(true);
    });
  });

  describe('findByStatus', () => {
    it('should find runs by status', async () => {
      const runs = [
        { ...createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId), status: 'PENDING' as const },
        { ...createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId), status: 'RUNNING' as const },
        { ...createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId), status: 'COMPLETED' as const },
      ];

      for (const run of runs) {
        const created = await repository.create(run);
        createdRunIds.push(created.run_id);
      }

      const pendingRuns = await repository.findByStatus('PENDING');
      expect(pendingRuns.length).toBeGreaterThanOrEqual(1);
      expect(pendingRuns.every(r => r.status === 'PENDING')).toBe(true);
    });
  });

  describe('findActiveRuns', () => {
    it('should find only PENDING and RUNNING runs', async () => {
      const runs = [
        { ...createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId), status: 'PENDING' as const },
        { ...createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId), status: 'RUNNING' as const },
        { ...createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId), status: 'COMPLETED' as const },
        { ...createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId), status: 'FAILED' as const },
      ];

      for (const run of runs) {
        const created = await repository.create(run);
        createdRunIds.push(created.run_id);
      }

      const activeRuns = await repository.findActiveRuns();
      expect(activeRuns.length).toBeGreaterThanOrEqual(2);
      expect(activeRuns.every(r => ['PENDING', 'RUNNING'].includes(r.status))).toBe(true);
    });
  });

  describe('updateStatus', () => {
    it('should update status and set end time for terminal states', async () => {
      const runData = createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId);
      const created = await repository.create(runData);
      createdRunIds.push(created.run_id);

      const updated = await repository.updateStatus(created.run_id, 'COMPLETED');
      expect(updated?.status).toBe('COMPLETED');
      expect(updated?.ended_at).toBeInstanceOf(Date);
    });

    it('should update status with error details', async () => {
      const runData = createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId);
      const created = await repository.create(runData);
      createdRunIds.push(created.run_id);

      const errorDetails = {
        error: 'Node execution failed',
        nodeId: 'email-node',
        attempt: 3,
      };

      const updated = await repository.updateStatus(created.run_id, 'FAILED', errorDetails);
      expect(updated?.status).toBe('FAILED');
      expect(updated?.error_details).toEqual(errorDetails);
      expect(updated?.ended_at).toBeInstanceOf(Date);
    });

    it('should not set end time for non-terminal states', async () => {
      const runData = createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId);
      const created = await repository.create(runData);
      createdRunIds.push(created.run_id);

      const updated = await repository.updateStatus(created.run_id, 'RUNNING');
      expect(updated?.status).toBe('RUNNING');
      expect(updated?.ended_at).toBeNull();
    });
  });

  describe('pause, resume, cancel', () => {
    it('should pause workflow run', async () => {
      const runData = createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId);
      const created = await repository.create(runData);
      createdRunIds.push(created.run_id);

      const paused = await repository.pause(created.run_id);
      expect(paused?.status).toBe('PAUSED');
    });

    it('should resume workflow run', async () => {
      const runData = { ...createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId), status: 'PAUSED' as const };
      const created = await repository.create(runData);
      createdRunIds.push(created.run_id);

      const resumed = await repository.resume(created.run_id);
      expect(resumed?.status).toBe('RUNNING');
    });

    it('should cancel workflow run with reason', async () => {
      const runData = createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId);
      const created = await repository.create(runData);
      createdRunIds.push(created.run_id);

      const cancelled = await repository.cancel(created.run_id, 'User requested cancellation');
      expect(cancelled?.status).toBe('CANCELLED');
      expect(cancelled?.error_details).toMatchObject({
        reason: 'User requested cancellation',
        cancelledAt: expect.any(Date),
      });
    });
  });

  describe('getExecutionStats', () => {
    it('should return execution statistics for date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const runs = [
        { ...createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId), status: 'COMPLETED' as const, ended_at: new Date('2024-06-15') },
        { ...createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId), status: 'COMPLETED' as const, ended_at: new Date('2024-06-16') },
        { ...createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId), status: 'FAILED' as const, ended_at: new Date('2024-06-17') },
      ];

      for (const run of runs) {
        const created = await repository.create(run);
        createdRunIds.push(created.run_id);
      }

      const stats = await repository.getExecutionStats(testOrgId, startDate, endDate);
      
      expect(stats.totalRuns).toBeGreaterThanOrEqual(3);
      expect(stats.completedRuns).toBeGreaterThanOrEqual(2);
      expect(stats.failedRuns).toBeGreaterThanOrEqual(1);
      expect(stats.runsByDay).toBeInstanceOf(Array);
    });
  });

  describe('data validation', () => {
    it('should validate workflow run status enum', async () => {
      const runData = createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId);
      runData.status = 'INVALID_STATUS' as any;

      await expect(repository.create(runData)).rejects.toThrow();
    });

    it('should validate foreign key constraints', async () => {
      const runData = createTestWorkflowRun(testOrgId, 'non-existent-workflow-id', testEmployeeId);

      await expect(repository.create(runData)).rejects.toThrow();
    });

    it('should validate trigger event format', async () => {
      const runData = createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId);
      runData.trigger_event = ''; // Empty trigger should fail

      await expect(repository.create(runData)).rejects.toThrow();
    });
  });

  describe('transaction handling', () => {
    it('should handle transaction rollback on constraint violation', async () => {
      const runData1 = createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId);
      const runData2 = createTestWorkflowRun(testOrgId, 'invalid-workflow-id', testEmployeeId);

      await expect(
        repository.transaction(async (client) => {
          // Create first run
          await client.query(
            'INSERT INTO workflow_runs (org_id, workflow_id, employee_id, trigger_event, status, started_at) VALUES ($1, $2, $3, $4, $5, $6)',
            [runData1.org_id, runData1.workflow_id, runData1.employee_id, runData1.trigger_event, runData1.status, runData1.started_at]
          );
          
          // Try to create second run with invalid workflow_id (should fail)
          await client.query(
            'INSERT INTO workflow_runs (org_id, workflow_id, employee_id, trigger_event, status, started_at) VALUES ($1, $2, $3, $4, $5, $6)',
            [runData2.org_id, runData2.workflow_id, runData2.employee_id, runData2.trigger_event, runData2.status, runData2.started_at]
          );
        })
      ).rejects.toThrow();

      // Verify no runs were created
      const runs = await repository.findByWorkflow(testWorkflowId);
      const createdRun = runs.find(r => r.employee_id === testEmployeeId);
      expect(createdRun).toBeUndefined();
    });

    it('should commit successful multi-step transactions', async () => {
      const runData = createTestWorkflowRun(testOrgId, testWorkflowId, testEmployeeId);

      const result = await repository.transaction(async (client) => {
        // Create workflow run
        const runResult = await client.query(
          'INSERT INTO workflow_runs (org_id, workflow_id, employee_id, trigger_event, status, started_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [runData.org_id, runData.workflow_id, runData.employee_id, runData.trigger_event, runData.status, runData.started_at]
        );
        
        // Update status to RUNNING
        await client.query(
          'UPDATE workflow_runs SET status = $1 WHERE run_id = $2',
          ['RUNNING', runResult.rows[0].run_id]
        );
        
        return runResult.rows[0];
      });

      createdRunIds.push(result.run_id);

      // Verify both operations were committed
      const found = await repository.findById(result.run_id);
      expect(found?.status).toBe('RUNNING');
    });
  });
});