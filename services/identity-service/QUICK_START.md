# 🚀 Quick Start Guide

## TL;DR - Get Running in 10 Minutes

### 1. Install Dependencies (2 minutes)

```bash
cd services/identity-service
npm install express winston joi axios pg googleapis @azure/msal-node
```

### 2. Setup Database (3 minutes)

```bash
# Install PostgreSQL (if not installed)
brew install postgresql  # macOS
# or
sudo apt-get install postgresql  # Ubuntu

# Start PostgreSQL
brew services start postgresql  # macOS
# or
sudo service postgresql start  # Ubuntu

# Create database and tables
createdb officeflow
psql -d officeflow -f migrations/002_oauth2_credentials.sql
psql -d officeflow -f migrations/003_identity_audit_events.sql
```

### 3. Configure Environment (2 minutes)

```bash
# Copy example environment file
cp .env.example .env

# Edit with your database password
# For now, you can use these minimal settings:
echo "DB_PASSWORD=your_postgres_password" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
```

### 4. Start the Service (1 minute)

```bash
npm run dev
```

### 5. Test It Works (2 minutes)

```bash
# Health check
curl http://localhost:3003/health

# Should return:
# {"status":"healthy","service":"identity-service","timestamp":"..."}

# Get node schema
curl http://localhost:3003/schema
```

## 🎯 **What You Get Immediately**

✅ **Working HTTP API** on port 3003
✅ **Database connectivity** with PostgreSQL
✅ **Audit logging** to database
✅ **Health monitoring** endpoint
✅ **Node schema** endpoint for workflow integration
✅ **Type-safe** TypeScript codebase

## 🔐 **To Actually Provision Users**

You'll need OAuth2 credentials from:

### Google Workspace (5 minutes setup)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project → Enable Admin SDK API
3. Create OAuth2 credentials
4. Add to `.env` file

### Office 365 (5 minutes setup)

1. Go to [Azure AD Portal](https://portal.azure.com)
2. Register application → Add Graph permissions
3. Create client secret
4. Add to `.env` file

## 🧪 **Test with Mock Data**

Even without OAuth2 credentials, you can test the API structure:

```bash
# Test node execution (will fail at OAuth2 step, but validates structure)
curl -X POST http://localhost:3003/execute \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "test-node",
    "runId": "test-run",
    "organizationId": "test-org",
    "employeeId": "test-employee",
    "params": {
      "provider": "google_workspace",
      "action": "provision",
      "userEmail": "test@example.com",
      "firstName": "Test",
      "lastName": "User"
    },
    "context": {
      "organizationId": "test-org",
      "employeeId": "test-employee",
      "correlationId": "test-correlation",
      "variables": {},
      "secrets": {}
    },
    "idempotencyKey": "test-key",
    "attempt": 1
  }'
```

## 📊 **What's Happening Under the Hood**

1. **Express Server** starts on port 3003
2. **Database Connection** connects to PostgreSQL
3. **Audit System** initializes with database tables
4. **Provider Factory** loads (empty) OAuth2 configurations
5. **Token Refresh Service** starts (but has no tokens to refresh yet)
6. **HTTP Endpoints** become available:
   - `GET /health` - Service health
   - `GET /schema` - Node schema for workflow engine
   - `POST /execute` - Execute identity operations
   - `GET /audit/:orgId` - Get audit trail
   - `POST /compliance-report` - Generate compliance reports

## 🎯 **Next Steps**

1. **Add OAuth2 credentials** to actually provision users
2. **Set up Kafka** for central audit integration (optional)
3. **Configure organization policies** for role-based provisioning
4. **Integrate with workflow engine** for automated employee onboarding

The service is **architecturally complete** and ready for production use!
