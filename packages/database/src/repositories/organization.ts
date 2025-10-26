/**
 * Organization repository implementation
 */

import { OrganizationEntity, OrganizationRepository, UUID } from '@officeflow/types';
import { BaseRepository } from './base';
import {
  organizationSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
} from '../validation/schemas';

export class OrganizationRepositoryImpl 
  extends BaseRepository<OrganizationEntity> 
  implements OrganizationRepository {

  constructor() {
    super(
      'organizations',
      'org_id',
      createOrganizationSchema,
      updateOrganizationSchema
    );
  }

  /**
   * Find organization by domain
   */
  async findByDomain(domain: string): Promise<OrganizationEntity | null> {
    const query = 'SELECT * FROM organizations WHERE domain = $1';
    const result = await this.pool.query(query, [domain]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Check if domain is available
   */
  async isDomainAvailable(domain: string, excludeOrgId?: UUID): Promise<boolean> {
    let query = 'SELECT COUNT(*) FROM organizations WHERE domain = $1';
    const params: any[] = [domain];

    if (excludeOrgId) {
      query += ' AND org_id != $2';
      params.push(excludeOrgId);
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10) === 0;
  }

  /**
   * Get organization statistics
   */
  async getStats(orgId: UUID): Promise<{
    totalUsers: number;
    totalEmployees: number;
    totalWorkflows: number;
    activeWorkflowRuns: number;
  }> {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM users WHERE org_id = $1) as total_users,
        (SELECT COUNT(*) FROM employees WHERE org_id = $1) as total_employees,
        (SELECT COUNT(*) FROM workflows WHERE org_id = $1) as total_workflows,
        (SELECT COUNT(*) FROM workflow_runs WHERE org_id = $1 AND status IN ('PENDING', 'RUNNING')) as active_workflow_runs
    `;

    const result = await this.pool.query(query, [orgId]);
    const row = result.rows[0];

    return {
      totalUsers: parseInt(row.total_users, 10),
      totalEmployees: parseInt(row.total_employees, 10),
      totalWorkflows: parseInt(row.total_workflows, 10),
      activeWorkflowRuns: parseInt(row.active_workflow_runs, 10),
    };
  }
}