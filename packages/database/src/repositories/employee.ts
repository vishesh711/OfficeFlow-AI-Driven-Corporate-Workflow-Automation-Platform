/**
 * Employee repository implementation
 */

import { EmployeeEntity, EmployeeRepository, UUID } from '@officeflow/types';
import { BaseRepository } from './base';
import {
  employeeSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
} from '../validation/schemas';

export class EmployeeRepositoryImpl 
  extends BaseRepository<EmployeeEntity> 
  implements EmployeeRepository {

  constructor() {
    super(
      'employees',
      'employee_id',
      createEmployeeSchema,
      updateEmployeeSchema
    );
  }

  /**
   * Find employee by email
   */
  async findByEmail(email: string): Promise<EmployeeEntity | null> {
    const query = 'SELECT * FROM employees WHERE email = $1';
    const result = await this.pool.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find employees by organization
   */
  async findByOrganization(orgId: UUID): Promise<EmployeeEntity[]> {
    return this.findAll({ org_id: orgId });
  }

  /**
   * Find employees by manager
   */
  async findByManager(managerId: UUID): Promise<EmployeeEntity[]> {
    return this.findAll({ manager_id: managerId });
  }

  /**
   * Find employees by status
   */
  async findByStatus(status: string): Promise<EmployeeEntity[]> {
    return this.findAll({ status });
  }

  /**
   * Find employees by department
   */
  async findByDepartment(orgId: UUID, department: string): Promise<EmployeeEntity[]> {
    return this.findAll({ 
      org_id: orgId, 
      department 
    });
  }

  /**
   * Find employee by employee number
   */
  async findByEmployeeNumber(orgId: UUID, employeeNumber: string): Promise<EmployeeEntity | null> {
    const query = 'SELECT * FROM employees WHERE org_id = $1 AND employee_number = $2';
    const result = await this.pool.query(query, [orgId, employeeNumber]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Get employees hired in date range
   */
  async findHiredInDateRange(orgId: UUID, startDate: Date, endDate: Date): Promise<EmployeeEntity[]> {
    const query = `
      SELECT * FROM employees 
      WHERE org_id = $1 
        AND hire_date >= $2 
        AND hire_date <= $3
      ORDER BY hire_date DESC
    `;
    
    const result = await this.pool.query(query, [orgId, startDate, endDate]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Get employees terminated in date range
   */
  async findTerminatedInDateRange(orgId: UUID, startDate: Date, endDate: Date): Promise<EmployeeEntity[]> {
    const query = `
      SELECT * FROM employees 
      WHERE org_id = $1 
        AND termination_date >= $2 
        AND termination_date <= $3
      ORDER BY termination_date DESC
    `;
    
    const result = await this.pool.query(query, [orgId, startDate, endDate]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Get department statistics
   */
  async getDepartmentStats(orgId: UUID): Promise<Array<{
    department: string;
    totalEmployees: number;
    activeEmployees: number;
  }>> {
    const query = `
      SELECT 
        department,
        COUNT(*) as total_employees,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_employees
      FROM employees 
      WHERE org_id = $1 AND department IS NOT NULL
      GROUP BY department
      ORDER BY total_employees DESC
    `;
    
    const result = await this.pool.query(query, [orgId]);
    return result.rows.map(row => ({
      department: row.department,
      totalEmployees: parseInt(row.total_employees, 10),
      activeEmployees: parseInt(row.active_employees, 10),
    }));
  }

  /**
   * Update employee status
   */
  async updateStatus(employeeId: UUID, status: string): Promise<EmployeeEntity | null> {
    const updates: any = { status };
    
    // Set termination date if status is terminated
    if (status === 'terminated') {
      updates.termination_date = new Date();
    }
    
    return this.update(employeeId, updates);
  }

  /**
   * Search employees by name or email
   */
  async search(orgId: UUID, searchTerm: string, limit: number = 50): Promise<EmployeeEntity[]> {
    const query = `
      SELECT * FROM employees 
      WHERE org_id = $1 
        AND (
          LOWER(first_name) LIKE LOWER($2) OR
          LOWER(last_name) LIKE LOWER($2) OR
          LOWER(email) LIKE LOWER($2) OR
          LOWER(CONCAT(first_name, ' ', last_name)) LIKE LOWER($2)
        )
      ORDER BY first_name, last_name
      LIMIT $3
    `;
    
    const searchPattern = `%${searchTerm}%`;
    const result = await this.pool.query(query, [orgId, searchPattern, limit]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }
}