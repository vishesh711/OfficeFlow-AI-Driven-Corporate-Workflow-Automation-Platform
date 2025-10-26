# @officeflow/database

Database package for the OfficeFlow platform providing PostgreSQL schema, migrations, and data access layer.

## Features

- **PostgreSQL Schema**: Complete database schema with proper indexing and constraints
- **Migration System**: Automated database migration management
- **Repository Pattern**: Type-safe data access with CRUD operations
- **Validation**: Zod-based data validation for all entities
- **Connection Management**: Connection pooling and transaction support
- **Seeding**: Development data seeding for testing

## Installation

```bash
npm install @officeflow/database
```

## Usage

### Database Connection

```typescript
import { db } from '@officeflow/database';

// Connect to database
await db.connect();

// Execute query
const result = await db.query('SELECT * FROM organizations');

// Use transaction
await db.transaction(async (client) => {
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
});
```

### Repositories

```typescript
import { repositories } from '@officeflow/database';

// Get repository instances
const orgRepo = repositories.getOrganizationRepository();
const userRepo = repositories.getUserRepository();

// Create organization
const org = await orgRepo.create({
  name: 'Acme Corp',
  domain: 'acme.com',
  plan: 'enterprise',
  settings: {}
});

// Find users by organization
const users = await userRepo.findByOrganization(org.org_id);
```

### Migrations

```typescript
import { MigrationRunner } from '@officeflow/database';

const runner = new MigrationRunner();
await runner.run();
```

Or use the CLI:

```bash
npm run migrate
```

### Seeding

```typescript
import { DatabaseSeeder } from '@officeflow/database';

const seeder = new DatabaseSeeder();
await seeder.seed();
```

Or use the CLI:

```bash
npm run seed
```

## Environment Configuration

Set the following environment variables:

```env
# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/officeflow_dev

# Or individual parameters
DB_HOST=localhost
DB_PORT=5432
DB_NAME=officeflow_dev
DB_USER=officeflow
DB_PASSWORD=your_password
DB_SSL=false
DB_MAX_CONNECTIONS=20
DB_CONNECTION_TIMEOUT_MS=2000
DB_IDLE_TIMEOUT_MS=30000
```

## Database Schema

The schema includes the following main entities:

- **organizations**: Multi-tenant organization data
- **users**: Application users with roles and permissions
- **employees**: HR employee data from external systems
- **workflows**: Workflow definitions and DAG structures
- **workflow_runs**: Workflow execution instances
- **node_runs**: Individual node execution records
- **audit_logs**: Compliance and audit trail
- **integration_accounts**: External service credentials

## Repository Methods

All repositories extend `BaseRepository` and provide:

- `findById(id)`: Find entity by primary key
- `findAll(filters?, options?)`: Find entities with filtering and pagination
- `create(data)`: Create new entity
- `update(id, updates)`: Update existing entity
- `delete(id)`: Delete entity
- `count(filters?)`: Count entities

Plus entity-specific methods like:

- `OrganizationRepository.findByDomain(domain)`
- `UserRepository.findByEmail(email)`
- `WorkflowRepository.findActiveByTrigger(orgId, trigger)`
- `AuditLogRepository.logEvent(...)`

## Development

```bash
# Build the package
npm run build

# Run type checking
npm run type-check

# Run linting
npm run lint
```