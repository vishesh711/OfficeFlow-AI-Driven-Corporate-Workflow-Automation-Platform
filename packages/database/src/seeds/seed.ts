/**
 * Database seeding for development
 */

import { v4 as uuidv4 } from 'uuid';
import { repositories } from '../repositories';
import { db } from '../connection';

interface SeedData {
  organizations: any[];
  users: any[];
  employees: any[];
  workflows: any[];
  integrationAccounts: any[];
}

class DatabaseSeeder {
  private orgRepo = repositories.getOrganizationRepository();
  private userRepo = repositories.getUserRepository();
  private employeeRepo = repositories.getEmployeeRepository();
  private workflowRepo = repositories.getWorkflowRepository();
  private integrationRepo = repositories.getIntegrationAccountRepository();
  private auditRepo = repositories.getAuditLogRepository();

  async seed(): Promise<void> {
    console.log('🌱 Starting database seeding...');

    try {
      await db.connect();

      // Clear existing data in development
      if (process.env.NODE_ENV === 'development') {
        await this.clearData();
      }

      const seedData = this.generateSeedData();
      
      await this.seedOrganizations(seedData.organizations);
      await this.seedUsers(seedData.users);
      await this.seedEmployees(seedData.employees);
      await this.seedWorkflows(seedData.workflows);
      await this.seedIntegrationAccounts(seedData.integrationAccounts);

      console.log('✅ Database seeding completed successfully!');
    } catch (error) {
      console.error('❌ Database seeding failed:', error);
      throw error;
    }
  }

  private async clearData(): Promise<void> {
    console.log('🧹 Clearing existing data...');
    
    const tables = [
      'audit_logs',
      'node_runs',
      'workflow_runs',
      'workflow_edges',
      'workflow_nodes',
      'workflows',
      'integration_accounts',
      'employees',
      'users',
      'organizations',
    ];

    for (const table of tables) {
      await db.query(`TRUNCATE TABLE ${table} CASCADE`);
    }
  }

  private generateSeedData(): SeedData {
    const orgId = uuidv4();
    const adminUserId = uuidv4();
    const managerUserId = uuidv4();
    const hrUserId = uuidv4();

    return {
      organizations: [
        {
          org_id: orgId,
          name: 'Acme Corporation',
          domain: 'acme.com',
          plan: 'enterprise',
          settings: {
            timezone: 'America/New_York',
            workingHours: {
              monday: { isWorkingDay: true, startTime: '09:00', endTime: '17:00' },
              tuesday: { isWorkingDay: true, startTime: '09:00', endTime: '17:00' },
              wednesday: { isWorkingDay: true, startTime: '09:00', endTime: '17:00' },
              thursday: { isWorkingDay: true, startTime: '09:00', endTime: '17:00' },
              friday: { isWorkingDay: true, startTime: '09:00', endTime: '17:00' },
              saturday: { isWorkingDay: false },
              sunday: { isWorkingDay: false },
            },
          },
        },
      ],
      users: [
        {
          user_id: adminUserId,
          org_id: orgId,
          email: 'admin@acme.com',
          password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uIoO', // password123
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin',
          is_active: true,
        },
        {
          user_id: managerUserId,
          org_id: orgId,
          email: 'manager@acme.com',
          password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uIoO', // password123
          first_name: 'Manager',
          last_name: 'User',
          role: 'manager',
          is_active: true,
        },
        {
          user_id: hrUserId,
          org_id: orgId,
          email: 'hr@acme.com',
          password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uIoO', // password123
          first_name: 'HR',
          last_name: 'User',
          role: 'user',
          is_active: true,
        },
      ],
      employees: [
        {
          employee_id: uuidv4(),
          org_id: orgId,
          employee_number: 'EMP001',
          email: 'john.doe@acme.com',
          first_name: 'John',
          last_name: 'Doe',
          department: 'Engineering',
          job_title: 'Senior Software Engineer',
          hire_date: new Date('2023-01-15'),
          status: 'active',
          profile_data: {
            skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
            location: 'New York, NY',
            phoneNumber: '+1-555-0123',
          },
        },
        {
          employee_id: uuidv4(),
          org_id: orgId,
          employee_number: 'EMP002',
          email: 'jane.smith@acme.com',
          first_name: 'Jane',
          last_name: 'Smith',
          department: 'Marketing',
          job_title: 'Marketing Manager',
          hire_date: new Date('2023-02-01'),
          status: 'active',
          profile_data: {
            skills: ['Digital Marketing', 'Content Strategy', 'Analytics'],
            location: 'San Francisco, CA',
            phoneNumber: '+1-555-0124',
          },
        },
        {
          employee_id: uuidv4(),
          org_id: orgId,
          employee_number: 'EMP003',
          email: 'bob.johnson@acme.com',
          first_name: 'Bob',
          last_name: 'Johnson',
          department: 'Sales',
          job_title: 'Sales Representative',
          hire_date: new Date('2023-03-10'),
          status: 'active',
          profile_data: {
            skills: ['Sales', 'Customer Relations', 'CRM'],
            location: 'Chicago, IL',
            phoneNumber: '+1-555-0125',
          },
        },
      ],
      workflows: [
        {
          workflow_id: uuidv4(),
          org_id: orgId,
          name: 'Employee Onboarding',
          description: 'Automated workflow for new employee onboarding process',
          event_trigger: 'employee.onboard',
          version: 1,
          is_active: true,
          definition: {
            nodes: [
              {
                id: 'start',
                type: 'start',
                name: 'Start Onboarding',
                params: {},
                position: { x: 100, y: 100 },
              },
              {
                id: 'create_accounts',
                type: 'identity.provision',
                name: 'Create User Accounts',
                params: {
                  providers: ['google_workspace', 'slack'],
                  assignGroups: true,
                },
                position: { x: 300, y: 100 },
              },
              {
                id: 'send_welcome',
                type: 'email.send',
                name: 'Send Welcome Email',
                params: {
                  template: 'welcome_email',
                  includeHandbook: true,
                },
                position: { x: 500, y: 100 },
              },
              {
                id: 'schedule_meeting',
                type: 'calendar.schedule',
                name: 'Schedule Onboarding Meeting',
                params: {
                  duration: 60,
                  attendees: ['manager', 'hr'],
                },
                position: { x: 700, y: 100 },
              },
            ],
            edges: [
              { from: 'start', to: 'create_accounts' },
              { from: 'create_accounts', to: 'send_welcome' },
              { from: 'send_welcome', to: 'schedule_meeting' },
            ],
            metadata: {
              version: '1.0',
              description: 'Standard employee onboarding workflow',
            },
          },
          created_by: adminUserId,
        },
        {
          workflow_id: uuidv4(),
          org_id: orgId,
          name: 'Employee Offboarding',
          description: 'Automated workflow for employee departure process',
          event_trigger: 'employee.exit',
          version: 1,
          is_active: true,
          definition: {
            nodes: [
              {
                id: 'start',
                type: 'start',
                name: 'Start Offboarding',
                params: {},
                position: { x: 100, y: 100 },
              },
              {
                id: 'disable_accounts',
                type: 'identity.deprovision',
                name: 'Disable User Accounts',
                params: {
                  providers: ['google_workspace', 'slack'],
                  transferData: true,
                },
                position: { x: 300, y: 100 },
              },
              {
                id: 'collect_assets',
                type: 'email.send',
                name: 'Asset Collection Reminder',
                params: {
                  template: 'asset_collection',
                  recipients: ['manager', 'it'],
                },
                position: { x: 500, y: 100 },
              },
            ],
            edges: [
              { from: 'start', to: 'disable_accounts' },
              { from: 'disable_accounts', to: 'collect_assets' },
            ],
            metadata: {
              version: '1.0',
              description: 'Standard employee offboarding workflow',
            },
          },
          created_by: adminUserId,
        },
      ],
      integrationAccounts: [
        {
          account_id: uuidv4(),
          org_id: orgId,
          provider: 'google_workspace',
          account_name: 'Acme Google Workspace',
          credentials: {
            client_id: 'dummy_client_id',
            client_secret: 'dummy_client_secret',
            refresh_token: 'dummy_refresh_token',
          },
          config: {
            domain: 'acme.com',
            adminEmail: 'admin@acme.com',
          },
          is_active: true,
          created_by: adminUserId,
        },
        {
          account_id: uuidv4(),
          org_id: orgId,
          provider: 'slack',
          account_name: 'Acme Slack Workspace',
          credentials: {
            bot_token: 'xoxb-dummy-token',
            app_token: 'xapp-dummy-token',
          },
          config: {
            workspace: 'acme-corp',
            defaultChannel: '#general',
          },
          is_active: true,
          created_by: adminUserId,
        },
      ],
    };
  }

  private async seedOrganizations(organizations: any[]): Promise<void> {
    console.log('📊 Seeding organizations...');
    
    for (const org of organizations) {
      await this.orgRepo.create(org);
      console.log(`  ✓ Created organization: ${org.name}`);
    }
  }

  private async seedUsers(users: any[]): Promise<void> {
    console.log('👥 Seeding users...');
    
    for (const user of users) {
      await this.userRepo.create(user);
      console.log(`  ✓ Created user: ${user.email}`);
    }
  }

  private async seedEmployees(employees: any[]): Promise<void> {
    console.log('👤 Seeding employees...');
    
    for (const employee of employees) {
      await this.employeeRepo.create(employee);
      console.log(`  ✓ Created employee: ${employee.first_name} ${employee.last_name}`);
    }
  }

  private async seedWorkflows(workflows: any[]): Promise<void> {
    console.log('⚡ Seeding workflows...');
    
    for (const workflow of workflows) {
      await this.workflowRepo.create(workflow);
      console.log(`  ✓ Created workflow: ${workflow.name}`);
    }
  }

  private async seedIntegrationAccounts(accounts: any[]): Promise<void> {
    console.log('🔗 Seeding integration accounts...');
    
    for (const account of accounts) {
      await this.integrationRepo.create(account);
      console.log(`  ✓ Created integration: ${account.account_name}`);
    }
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  const seeder = new DatabaseSeeder();
  seeder.seed()
    .then(() => {
      console.log('🎉 Seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

export { DatabaseSeeder };