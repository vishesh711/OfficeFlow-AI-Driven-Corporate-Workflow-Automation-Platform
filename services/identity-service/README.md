# Identity Service

The Identity Service is a node executor for the OfficeFlow platform that handles user account provisioning, deprovisioning, and management across multiple identity providers.

## Features

### OAuth2 Integration Framework
- Generic OAuth2 client implementation
- Encrypted credential storage with automatic token refresh
- Support for multiple identity providers
- Provider-specific API adapters

### Supported Identity Providers
- **Google Workspace**: User and group management via Admin SDK
- **Office 365**: User and group management via Microsoft Graph API
- **Okta**: (Planned)
- **Active Directory**: (Planned)

### Account Provisioning Operations
- User account creation with role-based group assignment
- Account updates and modifications
- Account deactivation and cleanup procedures
- License assignment and management
- Group membership management

### Audit Logging and Compliance
- Comprehensive audit trail for all identity operations
- Compliance reporting (access reviews, provisioning audits)
- Integration with central audit service
- Immutable audit records with detailed metadata
- Security alert detection and reporting

## Configuration

### Environment Variables

```bash
# Service Configuration
PORT=3003
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=officeflow
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=true
DB_MAX_CONNECTIONS=20

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=identity-service
KAFKA_GROUP_ID=identity-service-group
KAFKA_SSL=false

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# Google Workspace
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3003/auth/google/callback

# Office 365
OFFICE365_CLIENT_ID=your_office365_client_id
OFFICE365_CLIENT_SECRET=your_office365_client_secret
OFFICE365_TENANT_ID=your_tenant_id
OFFICE365_REDIRECT_URI=http://localhost:3003/auth/office365/callback

# Audit Configuration
AUDIT_RETENTION_DAYS=2555
ENABLE_CENTRAL_AUDIT=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### Provider Setup

#### Google Workspace
1. Create a project in Google Cloud Console
2. Enable the Admin SDK API
3. Create OAuth2 credentials
4. Configure domain-wide delegation for service accounts
5. Set up the required scopes:
   - `https://www.googleapis.com/auth/admin.directory.user`
   - `https://www.googleapis.com/auth/admin.directory.group`
   - `https://www.googleapis.com/auth/admin.directory.orgunit`

#### Office 365
1. Register an application in Azure AD
2. Configure API permissions for Microsoft Graph:
   - `User.ReadWrite.All`
   - `Group.ReadWrite.All`
   - `Directory.ReadWrite.All`
3. Grant admin consent for the permissions
4. Create a client secret

## API Endpoints

### Node Execution
```http
POST /execute
Content-Type: application/json

{
  "nodeId": "node_123",
  "runId": "run_456",
  "organizationId": "org_789",
  "employeeId": "emp_101",
  "params": {
    "provider": "google_workspace",
    "action": "provision",
    "userEmail": "john.doe@company.com",
    "firstName": "John",
    "lastName": "Doe",
    "department": "Engineering",
    "groups": ["engineering@company.com"]
  },
  "context": {
    "organizationId": "org_789",
    "employeeId": "emp_101",
    "correlationId": "corr_123",
    "variables": {},
    "secrets": {}
  },
  "idempotencyKey": "idem_123",
  "attempt": 1
}
```

### Audit Trail
```http
GET /audit/{organizationId}?startDate=2024-01-01&endDate=2024-01-31&limit=100&offset=0
```

### Compliance Reports
```http
POST /compliance-report
Content-Type: application/json

{
  "organizationId": "org_789",
  "reportType": "provisioning_audit",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "generatedBy": "admin@company.com"
}
```

## Node Parameters

### Provision Action
```json
{
  "provider": "google_workspace",
  "action": "provision",
  "userEmail": "user@company.com",
  "firstName": "John",
  "lastName": "Doe",
  "department": "Engineering",
  "title": "Software Engineer",
  "groups": ["engineering@company.com", "all-staff@company.com"],
  "licenses": ["Google Workspace Business Standard"]
}
```

### Deprovision Action
```json
{
  "provider": "google_workspace",
  "action": "deprovision",
  "userEmail": "user@company.com"
}
```

### Update Action
```json
{
  "provider": "google_workspace",
  "action": "update",
  "userEmail": "user@company.com",
  "department": "Product",
  "title": "Product Manager"
}
```

### Assign Groups Action
```json
{
  "provider": "google_workspace",
  "action": "assign_groups",
  "userEmail": "user@company.com",
  "groups": ["product@company.com", "managers@company.com"]
}
```

## Database Schema

The service requires the following database tables:

- `oauth2_credentials`: Encrypted OAuth2 tokens
- `identity_audit_events`: Audit trail for all operations
- `identity_compliance_reports`: Compliance report metadata

Run the migrations in the `migrations/` directory to set up the required schema.

## Development

### Running Locally
```bash
npm install
npm run dev
```

### Running Tests
```bash
npm test
npm run test:watch
```

### Building
```bash
npm run build
npm start
```

## Security Considerations

1. **Encryption**: All OAuth2 tokens are encrypted at rest using AES encryption
2. **Audit Trail**: All operations are logged with immutable audit records
3. **Token Refresh**: Automatic token refresh prevents expired credentials
4. **Rate Limiting**: Built-in rate limiting for external API calls
5. **Input Validation**: Comprehensive validation of all input parameters
6. **Error Handling**: Secure error handling that doesn't leak sensitive information

## Monitoring and Observability

The service provides:
- Structured JSON logging with correlation IDs
- Health check endpoint (`/health`)
- Prometheus metrics (planned)
- Distributed tracing support (planned)
- Real-time audit event streaming to central audit service

## Compliance Features

- **SOX Compliance**: Immutable audit trails with detailed change tracking
- **GDPR Compliance**: Data retention policies and deletion capabilities
- **SOC 2**: Comprehensive logging and access controls
- **HIPAA**: Encryption and audit requirements (when applicable)

## Troubleshooting

### Common Issues

1. **Token Expiration**: Check the token refresh service logs
2. **Provider API Errors**: Verify API credentials and permissions
3. **Database Connection**: Ensure database is accessible and credentials are correct
4. **Kafka Connection**: Verify Kafka brokers are reachable

### Logs

Check the service logs for detailed error information:
```bash
tail -f logs/identity-service.log
```

### Health Check

Verify service health:
```bash
curl http://localhost:3003/health
```