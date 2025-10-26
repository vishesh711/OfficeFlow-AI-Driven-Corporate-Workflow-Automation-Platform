/**
 * Test setup and utilities
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Test database configuration
const TEST_DB_CONFIG = {
  connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/officeflow_test',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

let testPool: Pool;

export const getTestPool = (): Pool => {
  if (!testPool) {
    testPool = new Pool(TEST_DB_CONFIG);
  }
  return testPool;
};

export const createTestOrganization = () => ({
  org_id: uuidv4(),
  name: 'Test Organization',
  domain: 'test.com',
  plan: 'enterprise',
  settings: {},
});

export const createTestUser = (orgId: string) => ({
  user_id: uuidv4(),
  org_id: orgId,
  email: `test-${Date.now()}@test.com`,
  first_name: 'Test',
  last_name: 'User',
  role: 'admin',
  is_active: true,
});

export const createTestEmployee = (orgId: string) => ({
  employee_id: uuidv4(),
  org_id: orgId,
  employee_number: `EMP${Date.now()}`,
  email: `employee-${Date.now()}@test.com`,
  first_name: 'Test',
  last_name: 'Employee',
  department: 'Engineering',
  job_title: 'Software Engineer',
  hire_date: new Date(),
  status: 'active',
  profile_data: { skills: ['JavaScript', 'TypeScript'] },
});

export const createTestWorkflow = (orgId: string, createdBy?: string) => ({
  workflow_id: uuidv4(),
  org_id: orgId,
  name: 'Test Workflow',
  description: 'A test workflow',
  event_trigger: 'employee.onboard',
  version: 1,
  is_active: true,
  definition: {
    nodes: [
      { id: 'start', type: 'trigger', name: 'Start' },
      { id: 'email', type: 'email', name: 'Send Welcome Email' },
    ],
    edges: [
      { from: 'start', to: 'email' },
    ],
  },
  created_by: createdBy,
});

export const createTestWorkflowRun = (orgId: string, workflowId: string, employeeId?: string) => ({
  run_id: uuidv4(),
  org_id: orgId,
  workflow_id: workflowId,
  employee_id: employeeId,
  trigger_event: 'employee.onboard',
  status: 'PENDING' as const,
  context: { employeeId, department: 'Engineering' },
  started_at: new Date(),
});

// Clean up test data
export const cleanupTestData = async (pool: Pool, tableName: string, idColumn: string, ids: string[]) => {
  if (ids.length === 0) return;
  
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  await pool.query(`DELETE FROM ${tableName} WHERE ${idColumn} IN (${placeholders})`, ids);
};

// Global test setup
beforeAll(async () => {
  // Ensure test database connection
  const pool = getTestPool();
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
});

afterAll(async () => {
  if (testPool) {
    await testPool.end();
  }
});