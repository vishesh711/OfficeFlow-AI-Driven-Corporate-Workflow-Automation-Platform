# Database Package Tests

This directory contains comprehensive unit tests for the database package, covering data models, repositories, and validation schemas.

## Test Structure

### Unit Tests (No Database Required)
- **Validation Tests** (`validation/schemas.test.ts`): Tests for Zod validation schemas
- **Repository Unit Tests** (`repositories/base-unit.test.ts`): Tests for repository logic without database

### Integration Tests (Database Required)
- **Base Repository** (`repositories/base.test.ts`): Full database integration tests
- **Employee Repository** (`repositories/employee.test.ts`): Employee-specific operations
- **Workflow Repository** (`repositories/workflow.test.ts`): Workflow management operations
- **Workflow Run Repository** (`repositories/workflow-run.test.ts`): Workflow execution tracking

## Running Tests

### Unit Tests Only (Fast)
```bash
npm run test:unit
```

### Integration Tests (Requires Database)
```bash
npm run test:integration
```

### All Tests
```bash
npm test
```

## Test Coverage

The tests cover:

### Data Validation
- ✅ Schema validation for all entity types
- ✅ Required field enforcement
- ✅ Data type validation
- ✅ Default value handling
- ✅ Constraint enforcement

### Repository Operations
- ✅ CRUD operations (Create, Read, Update, Delete)
- ✅ Query building and filtering
- ✅ Pagination and sorting
- ✅ Transaction handling
- ✅ Error handling and rollback scenarios
- ✅ Data mapping (snake_case ↔ camelCase)

### Business Logic
- ✅ Employee lifecycle operations
- ✅ Workflow management
- ✅ Workflow execution tracking
- ✅ Audit logging
- ✅ Search and filtering

### Edge Cases
- ✅ Empty result sets
- ✅ Null and undefined values
- ✅ Invalid input handling
- ✅ Database connection failures
- ✅ Constraint violations

## Test Database Setup

For integration tests, you need a PostgreSQL test database:

```sql
CREATE DATABASE officeflow_test;
```

Set the connection string in environment variable:
```bash
export TEST_DATABASE_URL="postgresql://postgres:password@localhost:5432/officeflow_test"
```

## Test Utilities

The `setup.ts` file provides:
- Test database connection management
- Test data factories
- Cleanup utilities
- Common test helpers

## Requirements Coverage

These tests fulfill the requirements from task 2.3:

1. **Create unit tests for repository operations** ✅
   - Base repository CRUD operations
   - Specific repository methods (Employee, Workflow, WorkflowRun)
   - Query building and filtering logic

2. **Test data validation and constraint enforcement** ✅
   - Zod schema validation tests
   - Required field validation
   - Data type and format validation
   - Database constraint testing

3. **Verify transaction handling and rollback scenarios** ✅
   - Transaction commit/rollback tests
   - Error handling in transactions
   - Multi-step transaction scenarios
   - Constraint violation rollbacks

The tests ensure data integrity, proper error handling, and reliable database operations across the entire data access layer.