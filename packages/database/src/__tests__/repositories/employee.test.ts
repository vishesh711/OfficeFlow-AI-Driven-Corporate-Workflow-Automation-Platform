/**
 * Unit tests for EmployeeRepository
 */

import { EmployeeRepositoryImpl } from '../../repositories/employee';
import { getTestPool, createTestOrganization, createTestEmployee, cleanupTestData } from '../setup';
import { Pool } from 'pg';

describe('EmployeeRepository', () => {
  let pool: Pool;
  let repository: EmployeeRepositoryImpl;
  let testOrgId: string;
  let createdEmployeeIds: string[] = [];
  let createdOrgIds: string[] = [];

  beforeAll(async () => {
    pool = getTestPool();
    repository = new EmployeeRepositoryImpl();
    
    // Create test organization
    const orgData = createTestOrganization();
    testOrgId = orgData.org_id;
    createdOrgIds.push(testOrgId);
    
    await pool.query(
      'INSERT INTO organizations (org_id, name, domain, plan, settings) VALUES ($1, $2, $3, $4, $5)',
      [orgData.org_id, orgData.name, orgData.domain, orgData.plan, JSON.stringify(orgData.settings)]
    );
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData(pool, 'employees', 'employee_id', createdEmployeeIds);
    await cleanupTestData(pool, 'organizations', 'org_id', createdOrgIds);
  });

  afterEach(async () => {
    // Clean up employees created in tests
    if (createdEmployeeIds.length > 0) {
      await cleanupTestData(pool, 'employees', 'employee_id', createdEmployeeIds);
      createdEmployeeIds = [];
    }
  });

  describe('create', () => {
    it('should create employee with valid data', async () => {
      const employeeData = createTestEmployee(testOrgId);
      
      const created = await repository.create(employeeData);
      createdEmployeeIds.push(created.employee_id);

      expect(created).toMatchObject({
        ...employeeData,
        employee_id: expect.any(String),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        org_id: testOrgId,
        email: 'invalid-email', // Invalid email format
        first_name: '', // Empty first name
        last_name: 'Test',
      };

      await expect(repository.create(invalidData as any)).rejects.toThrow();
    });

    it('should handle JSON profile data', async () => {
      const employeeData = createTestEmployee(testOrgId);
      employeeData.profile_data = {
        skills: ['JavaScript', 'TypeScript', 'Node.js'],
        certifications: ['AWS Solutions Architect'],
        preferences: { theme: 'dark', notifications: true },
      };

      const created = await repository.create(employeeData);
      createdEmployeeIds.push(created.employee_id);

      expect(created.profile_data).toEqual(employeeData.profile_data);
    });
  });

  describe('findByEmail', () => {
    it('should find employee by email', async () => {
      const employeeData = createTestEmployee(testOrgId);
      const created = await repository.create(employeeData);
      createdEmployeeIds.push(created.employee_id);

      const found = await repository.findByEmail(employeeData.email);
      expect(found).toMatchObject(created);
    });

    it('should return null for non-existent email', async () => {
      const found = await repository.findByEmail('nonexistent@test.com');
      expect(found).toBeNull();
    });
  });

  describe('findByOrganization', () => {
    it('should find all employees in organization', async () => {
      const employees = [
        createTestEmployee(testOrgId),
        createTestEmployee(testOrgId),
        createTestEmployee(testOrgId),
      ];

      for (const emp of employees) {
        const created = await repository.create(emp);
        createdEmployeeIds.push(created.employee_id);
      }

      const found = await repository.findByOrganization(testOrgId);
      expect(found.length).toBeGreaterThanOrEqual(3);
      expect(found.every(e => e.org_id === testOrgId)).toBe(true);
    });
  });

  describe('findByDepartment', () => {
    it('should find employees by department', async () => {
      const employees = [
        { ...createTestEmployee(testOrgId), department: 'Engineering' },
        { ...createTestEmployee(testOrgId), department: 'Engineering' },
        { ...createTestEmployee(testOrgId), department: 'Marketing' },
      ];

      for (const emp of employees) {
        const created = await repository.create(emp);
        createdEmployeeIds.push(created.employee_id);
      }

      const engineeringEmployees = await repository.findByDepartment(testOrgId, 'Engineering');
      expect(engineeringEmployees.length).toBe(2);
      expect(engineeringEmployees.every(e => e.department === 'Engineering')).toBe(true);
    });
  });

  describe('findByStatus', () => {
    it('should find employees by status', async () => {
      const employees = [
        { ...createTestEmployee(testOrgId), status: 'active' },
        { ...createTestEmployee(testOrgId), status: 'active' },
        { ...createTestEmployee(testOrgId), status: 'terminated' },
      ];

      for (const emp of employees) {
        const created = await repository.create(emp);
        createdEmployeeIds.push(created.employee_id);
      }

      const activeEmployees = await repository.findByStatus('active');
      expect(activeEmployees.length).toBeGreaterThanOrEqual(2);
      expect(activeEmployees.every(e => e.status === 'active')).toBe(true);
    });
  });

  describe('findByEmployeeNumber', () => {
    it('should find employee by employee number', async () => {
      const employeeData = createTestEmployee(testOrgId);
      employeeData.employee_number = 'EMP12345';
      
      const created = await repository.create(employeeData);
      createdEmployeeIds.push(created.employee_id);

      const found = await repository.findByEmployeeNumber(testOrgId, 'EMP12345');
      expect(found).toMatchObject(created);
    });

    it('should return null for non-existent employee number', async () => {
      const found = await repository.findByEmployeeNumber(testOrgId, 'NONEXISTENT');
      expect(found).toBeNull();
    });
  });

  describe('findHiredInDateRange', () => {
    it('should find employees hired in date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const hireDate = new Date('2024-06-15');

      const employeeData = createTestEmployee(testOrgId);
      employeeData.hire_date = hireDate;
      
      const created = await repository.create(employeeData);
      createdEmployeeIds.push(created.employee_id);

      const found = await repository.findHiredInDateRange(testOrgId, startDate, endDate);
      expect(found.some(e => e.employee_id === created.employee_id)).toBe(true);
    });
  });

  describe('updateStatus', () => {
    it('should update employee status', async () => {
      const employeeData = createTestEmployee(testOrgId);
      const created = await repository.create(employeeData);
      createdEmployeeIds.push(created.employee_id);

      const updated = await repository.updateStatus(created.employee_id, 'terminated');
      expect(updated?.status).toBe('terminated');
      expect(updated?.termination_date).toBeInstanceOf(Date);
    });
  });

  describe('search', () => {
    it('should search employees by name', async () => {
      const employeeData = createTestEmployee(testOrgId);
      employeeData.first_name = 'SearchableFirst';
      employeeData.last_name = 'SearchableLast';
      
      const created = await repository.create(employeeData);
      createdEmployeeIds.push(created.employee_id);

      const results = await repository.search(testOrgId, 'Searchable');
      expect(results.some(e => e.employee_id === created.employee_id)).toBe(true);
    });

    it('should search employees by email', async () => {
      const employeeData = createTestEmployee(testOrgId);
      employeeData.email = 'searchable@test.com';
      
      const created = await repository.create(employeeData);
      createdEmployeeIds.push(created.employee_id);

      const results = await repository.search(testOrgId, 'searchable');
      expect(results.some(e => e.employee_id === created.employee_id)).toBe(true);
    });

    it('should limit search results', async () => {
      const results = await repository.search(testOrgId, 'test', 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getDepartmentStats', () => {
    it('should return department statistics', async () => {
      const employees = [
        { ...createTestEmployee(testOrgId), department: 'Engineering', status: 'active' },
        { ...createTestEmployee(testOrgId), department: 'Engineering', status: 'active' },
        { ...createTestEmployee(testOrgId), department: 'Engineering', status: 'terminated' },
        { ...createTestEmployee(testOrgId), department: 'Marketing', status: 'active' },
      ];

      for (const emp of employees) {
        const created = await repository.create(emp);
        createdEmployeeIds.push(created.employee_id);
      }

      const stats = await repository.getDepartmentStats(testOrgId);
      const engineeringStats = stats.find(s => s.department === 'Engineering');
      
      expect(engineeringStats).toBeDefined();
      expect(engineeringStats?.totalEmployees).toBe(3);
      expect(engineeringStats?.activeEmployees).toBe(2);
    });
  });

  describe('data validation', () => {
    it('should enforce email uniqueness constraint', async () => {
      const employeeData1 = createTestEmployee(testOrgId);
      const employeeData2 = createTestEmployee(testOrgId);
      employeeData2.email = employeeData1.email; // Same email

      const created1 = await repository.create(employeeData1);
      createdEmployeeIds.push(created1.employee_id);

      await expect(repository.create(employeeData2)).rejects.toThrow();
    });

    it('should validate date fields', async () => {
      const employeeData = createTestEmployee(testOrgId);
      employeeData.hire_date = new Date('invalid-date') as any;

      await expect(repository.create(employeeData)).rejects.toThrow();
    });
  });

  describe('transaction handling', () => {
    it('should handle transaction rollback on constraint violation', async () => {
      const employeeData1 = createTestEmployee(testOrgId);
      const employeeData2 = createTestEmployee(testOrgId);
      employeeData2.email = employeeData1.email; // Duplicate email

      await expect(
        repository.transaction(async (client) => {
          // Create first employee
          await client.query(
            'INSERT INTO employees (org_id, email, first_name, last_name) VALUES ($1, $2, $3, $4)',
            [employeeData1.org_id, employeeData1.email, employeeData1.first_name, employeeData1.last_name]
          );
          
          // Try to create second employee with same email (should fail)
          await client.query(
            'INSERT INTO employees (org_id, email, first_name, last_name) VALUES ($1, $2, $3, $4)',
            [employeeData2.org_id, employeeData2.email, employeeData2.first_name, employeeData2.last_name]
          );
        })
      ).rejects.toThrow();

      // Verify no employees were created
      const found = await repository.findByEmail(employeeData1.email);
      expect(found).toBeNull();
    });
  });
});