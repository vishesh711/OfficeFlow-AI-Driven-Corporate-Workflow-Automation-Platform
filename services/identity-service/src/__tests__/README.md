# Identity Service Tests

This directory contains comprehensive tests for the Identity Service node executor.

## Test Coverage

### Core Functionality Tests (`identity-service-core.test.ts`)
- **Parameter Validation**: Tests input validation for all required and optional parameters
- **Execution Flow**: Tests successful execution of all supported actions (provision, deprovision, update, assign_groups)
- **Error Handling**: Tests handling of validation errors, missing credentials, and execution exceptions
- **Schema Definition**: Tests the node schema structure and parameter definitions

### Error Handling Tests (`error-handling.test.ts`)
- **Provider Error Scenarios**: Tests handling of rate limiting, authentication errors, and service unavailability
- **Token Refresh Scenarios**: Tests token expiration warnings and expired token handling
- **Group Assignment Errors**: Tests partial and complete group assignment failures
- **Audit Logging Errors**: Tests resilience when audit logging fails

## Test Features

### Mocked External Dependencies
- **Identity Providers**: Provider adapters are mocked to simulate API responses
- **OAuth2 Clients**: Token refresh and validation logic is mocked
- **Database Operations**: Credential storage and retrieval is mocked
- **Audit Services**: Both local and central audit logging is mocked

### Test Scenarios Covered

#### Account Provisioning
- ✅ Successful user creation with group assignments
- ✅ User creation with partial group assignment failures
- ✅ Rate limiting and retry logic
- ✅ Authentication and permission errors
- ✅ Token expiration warnings

#### Account Deprovisioning
- ✅ Successful user deactivation/suspension
- ✅ Error handling for non-existent users
- ✅ Audit trail creation

#### Group Management
- ✅ Successful group assignments
- ✅ Partial group assignment failures
- ✅ Empty group list handling
- ✅ Permission denied scenarios

#### Error Scenarios
- ✅ Network timeouts and connection errors
- ✅ Service unavailability
- ✅ Invalid credentials
- ✅ Malformed requests
- ✅ Audit logging failures

#### Token Management
- ✅ Token expiration detection
- ✅ Refresh token handling
- ✅ Expired token scenarios

## Running Tests

```bash
# Run all tests
npm test

# Run specific test files
npm test -- --testPathPattern="identity-service-core.test.ts"
npm test -- --testPathPattern="error-handling.test.ts"

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm run test:watch
```

## Test Requirements Covered

Based on task 5.4 requirements:

- ✅ **Mock external identity provider APIs for testing**: Provider adapters are fully mocked with realistic responses
- ✅ **Test account provisioning and deprovisioning flows**: Complete workflows tested with success and failure scenarios
- ✅ **Verify OAuth2 token handling and refresh logic**: Token expiration, refresh, and validation scenarios covered
- ✅ **Test error scenarios and retry behavior**: Comprehensive error handling including rate limiting, network errors, and service failures

## Test Statistics

- **Total Test Suites**: 2
- **Total Tests**: 28
- **Coverage Areas**: Parameter validation, execution flows, error handling, token management, audit logging
- **Test Approach**: Unit tests with comprehensive mocking, focused on core business logic