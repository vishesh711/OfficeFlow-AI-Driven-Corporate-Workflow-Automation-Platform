# OfficeFlow Platform - Server-Side Documentation

This document covers all server-side components, deployment, and infrastructure for the OfficeFlow platform.

## 🏗️ Architecture Overview

The server-side architecture follows a microservices pattern with event-driven communication:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Load Balancer  │    │  API Gateway    │    │  Message Queue  │
│  (Nginx/ALB)    │───▶│  (Kong/Envoy)   │───▶│  (Apache Kafka) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                 │                       │
                    ┌─────────────────┐                  │
                    │ Workflow Engine │                  │
                    └─────────────────┘                  │
                                 │                       │
         ┌───────────────────────┼───────────────────────┼───────────────────────┐
         │                       │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Auth Service    │    │ Identity Service│    │ Email Service   │    │ AI Service      │
│ (JWT/OAuth)     │    │ (User Mgmt)     │    │ (SMTP/SES)      │    │ (OpenAI/LLM)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Document Svc    │    │ Calendar Svc    │    │ Slack Service   │    │ Webhook Gateway │
│ (File Storage)  │    │ (Cal Integration)│    │ (Team Comms)    │    │ (External APIs) │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │                       │
         └───────────────────────┼───────────────────────┼───────────────────────┘
                                 │                       │
                    ┌─────────────────┐    ┌─────────────────┐
                    │ PostgreSQL      │    │ Redis Cache     │
                    │ (Primary DB)    │    │ (Sessions)      │
                    └─────────────────┘    └─────────────────┘
```

## 🚀 Services Overview

### Core Services

#### 1. Workflow Engine (`services/workflow-engine/`)
- **Purpose**: Orchestrates workflow execution and manages state
- **Port**: 3000
- **Dependencies**: PostgreSQL, Redis, Kafka
- **Key Features**:
  - Workflow definition and execution
  - State management and persistence
  - Event publishing and consumption
  - Retry and error handling

#### 2. Auth Service (`services/auth-service/`)
- **Purpose**: Authentication, authorization, and session management
- **Port**: 3001
- **Dependencies**: PostgreSQL, Redis
- **Key Features**:
  - JWT token management
  - Multi-factor authentication (MFA)
  - Role-based access control (RBAC)
  - Session management
  - Password policies and security

#### 3. Identity Service (`services/identity-service/`)
- **Purpose**: User lifecycle management and external identity integration
- **Port**: 3002
- **Dependencies**: PostgreSQL, Kafka
- **Key Features**:
  - User provisioning/deprovisioning
  - External identity provider integration (Google, Microsoft, Okta)
  - User profile management
  - Organization and team management

### Integration Services

#### 4. AI Service (`services/ai-service/`)
- **Purpose**: AI-powered content generation and decision making
- **Port**: 3003
- **Dependencies**: Kafka, OpenAI API
- **Key Features**:
  - Content generation (emails, documents)
  - Workflow optimization suggestions
  - Natural language processing
  - Decision support

#### 5. Email Service (`services/email-service/`)
- **Purpose**: Email template management and delivery
- **Port**: 3004
- **Dependencies**: PostgreSQL, Kafka, SMTP/SES
- **Key Features**:
  - Template engine with variables
  - Multi-provider support (SMTP, SES, SendGrid)
  - Delivery tracking and analytics
  - Bounce and complaint handling

#### 6. Document Service (`services/document-service/`)
- **Purpose**: File storage, management, and distribution
- **Port**: 3005
- **Dependencies**: PostgreSQL, Kafka, MinIO/S3
- **Key Features**:
  - File upload and storage
  - Document versioning
  - Access control and sharing
  - Metadata management

#### 7. Calendar Service (`services/calendar-service/`)
- **Purpose**: Calendar integration and meeting management
- **Port**: 3006
- **Dependencies**: Kafka, Google Calendar API, Microsoft Graph
- **Key Features**:
  - Meeting scheduling
  - Calendar synchronization
  - Availability checking
  - Event notifications

#### 8. Slack Service (`services/slack-service/`)
- **Purpose**: Team communication and notifications
- **Port**: 3007
- **Dependencies**: Kafka, Slack API
- **Key Features**:
  - Message sending and formatting
  - Channel management
  - Interactive components
  - Workflow notifications

#### 9. Webhook Gateway (`services/webhook-gateway/`)
- **Purpose**: External system integration via webhooks
- **Port**: 3008
- **Dependencies**: Kafka
- **Key Features**:
  - Webhook endpoint management
  - Event transformation
  - External system adapters (BambooHR, Workday)
  - Rate limiting and security

## 🐳 Deployment

### Local Development

#### Docker Compose Setup
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Stop services
docker-compose down

# Rebuild specific service
docker-compose build [service-name]
docker-compose up -d [service-name]
```

#### Environment Configuration
Create `.env` file in project root:

```env
# Database
POSTGRES_URL=postgresql://officeflow:officeflow_dev@postgres:5432/officeflow
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=officeflow
POSTGRES_USER=officeflow
POSTGRES_PASSWORD=officeflow_dev

# Redis
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379

# Kafka
KAFKA_BROKERS=kafka:29092

# External APIs
OPENAI_API_KEY=your_openai_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_SIGNING_SECRET=your_slack_signing_secret

# MinIO (Object Storage)
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=officeflow
MINIO_SECRET_KEY=officeflow_dev

# Security
JWT_SECRET=your_jwt_secret_min_32_characters
ENCRYPTION_KEY=your_encryption_key_32_characters
```

### Production Deployment

#### Kubernetes Deployment

##### Quick Deployment
```bash
# Deploy to staging
./scripts/k8s-deploy.sh --namespace officeflow-staging

# Deploy to production
./scripts/k8s-deploy.sh --namespace officeflow --context production
```

##### Advanced Deployment Strategies
```bash
# Blue-green deployment (zero downtime)
./scripts/deploy.sh --strategy blue-green --environment production

# Canary deployment (gradual rollout)
./scripts/deploy.sh --strategy canary --environment production

# Rolling update (default)
./scripts/deploy.sh --strategy rolling --environment staging
```

##### Manual Kubernetes Deployment
```bash
# 1. Create namespace and base configuration
kubectl apply -f k8s/namespace.yaml

# 2. Deploy infrastructure services
kubectl apply -f k8s/infrastructure/postgres.yaml
kubectl apply -f k8s/infrastructure/redis.yaml
kubectl apply -f k8s/infrastructure/kafka.yaml
kubectl apply -f k8s/infrastructure/minio.yaml

# 3. Deploy application services
kubectl apply -f k8s/services/

# 4. Deploy ingress
kubectl apply -f k8s/ingress/
```

#### Container Management

##### Building Images
```bash
# Build all images locally
./scripts/docker-build-push.sh --local-only

# Build and push to registry
./scripts/docker-build-push.sh \
  --registry ghcr.io \
  --prefix your-org/officeflow \
  --version v1.0.0

# Multi-architecture build
./scripts/docker-build-push.sh --multi-arch
```

##### Security Scanning
```bash
# Scan all containers for vulnerabilities
./scripts/docker-security-scan.sh

# Scan specific service
./scripts/docker-security-scan.sh --service workflow-engine

# Install security tools
./scripts/docker-security-scan.sh --install-tools
```

## 🔧 Configuration Management

### Environment-Specific Configuration

#### Development
- **Namespace**: `officeflow-dev`
- **Replicas**: 1 per service
- **Resources**: Minimal (100m CPU, 128Mi RAM)
- **Domain**: `dev.officeflow.local`
- **Database**: Single PostgreSQL instance
- **Caching**: Single Redis instance

#### Staging
- **Namespace**: `officeflow-staging`
- **Replicas**: 2 per service
- **Resources**: Medium (250m CPU, 256Mi RAM)
- **Domain**: `staging.officeflow.com`
- **Database**: PostgreSQL with read replicas
- **Caching**: Redis cluster

#### Production
- **Namespace**: `officeflow`
- **Replicas**: 3+ per service
- **Resources**: High (500m+ CPU, 512Mi+ RAM)
- **Domain**: `officeflow.com`
- **Database**: PostgreSQL cluster with HA
- **Caching**: Redis cluster with persistence

### Service Configuration

Each service uses hierarchical configuration:

1. **Environment Variables** (highest priority)
2. **Configuration Files** (`.env` files)
3. **Default Values** (lowest priority)

#### Common Configuration Patterns
```typescript
// services/[service-name]/src/config.ts
export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  database: {
    url: process.env.POSTGRES_URL || 'postgresql://localhost:5432/officeflow',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    ssl: process.env.NODE_ENV === 'production'
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'officeflow:'
  },
  
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'officeflow-service'
  }
};
```

## 🔍 Monitoring & Observability

### Health Checks

All services implement standardized health check endpoints:

- **`/health`** - Overall service health
- **`/health/live`** - Liveness probe (Kubernetes)
- **`/health/ready`** - Readiness probe (Kubernetes)
- **`/metrics`** - Prometheus metrics

#### Health Check Implementation
```typescript
// Example health check implementation
app.get('/health', async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkKafka()
  ]);
  
  const healthy = checks.every(check => check.status === 'fulfilled');
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: checks.map((check, index) => ({
      name: ['database', 'redis', 'kafka'][index],
      status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      message: check.status === 'fulfilled' ? 'OK' : check.reason.message
    }))
  });
});
```

### Logging

#### Structured Logging
All services use structured JSON logging:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "service": "workflow-engine",
  "message": "Workflow started",
  "correlationId": "req-abc123",
  "workflowId": "wf-123",
  "organizationId": "org-456",
  "version": "1.0.0",
  "environment": "production"
}
```

#### Log Levels
- **TRACE**: Detailed debugging information
- **DEBUG**: Debug information
- **INFO**: General information
- **WARN**: Warning messages
- **ERROR**: Error conditions
- **FATAL**: Fatal error conditions

### Metrics

#### Prometheus Metrics
Each service exposes metrics on `/metrics` endpoint:

```typescript
// Example metrics
const httpRequestsTotal = new Counter({
  name: 'officeflow_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new Histogram({
  name: 'officeflow_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route']
});

const workflowExecutions = new Counter({
  name: 'officeflow_workflow_executions_total',
  help: 'Total number of workflow executions',
  labelNames: ['organization_id', 'workflow_id', 'status']
});
```

### Distributed Tracing

#### OpenTelemetry Integration
```typescript
import { initializeObservability } from '@officeflow/observability';

const { logger, tracer, metrics } = initializeObservability({
  serviceName: 'workflow-engine',
  serviceVersion: '1.0.0'
});

// Automatic tracing for HTTP requests
app.use(tracingMiddleware);

// Manual span creation
const span = tracer.startSpan('process-workflow');
try {
  const result = await processWorkflow(workflowId);
  span.setStatus({ code: SpanStatusCode.OK });
  return result;
} catch (error) {
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  throw error;
} finally {
  span.end();
}
```

## 🔐 Security

### Authentication & Authorization

#### JWT Token Management
```typescript
// Token generation
const token = jwt.sign(
  {
    userId: user.id,
    organizationId: user.organizationId,
    roles: user.roles,
    permissions: user.permissions
  },
  config.jwt.secret,
  {
    expiresIn: config.jwt.expiresIn,
    issuer: 'officeflow-auth',
    audience: 'officeflow-api'
  }
);

// Token validation middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.sendStatus(401);
  }
  
  jwt.verify(token, config.jwt.secret, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};
```

#### Role-Based Access Control (RBAC)
```typescript
// Permission checking
const hasPermission = (user, resource, action) => {
  return user.permissions.some(permission => 
    permission.resource === resource && 
    permission.actions.includes(action)
  );
};

// Authorization middleware
const authorize = (resource, action) => {
  return (req, res, next) => {
    if (!hasPermission(req.user, resource, action)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Usage
app.get('/api/workflows', 
  authenticateToken, 
  authorize('workflows', 'read'), 
  getWorkflows
);
```

### Input Validation

#### Request Validation
```typescript
import Joi from 'joi';

const createWorkflowSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500),
  nodes: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    type: Joi.string().required(),
    config: Joi.object().required()
  })).min(1).required(),
  organizationId: Joi.string().uuid().required()
});

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details
      });
    }
    next();
  };
};
```

### Rate Limiting

#### API Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    }
  });
};

// Different limits for different endpoints
app.use('/api/auth/login', createRateLimiter(15 * 60 * 1000, 5, 'Too many login attempts'));
app.use('/api/', createRateLimiter(15 * 60 * 1000, 100, 'Too many API requests'));
```

## 🚨 Error Handling

### Centralized Error Handling
```typescript
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  const { statusCode = 500, message } = err;
  
  logger.error('Request error', err, {
    correlationId: req.correlationId,
    userId: req.user?.id,
    path: req.path,
    method: req.method
  });
  
  res.status(statusCode).json({
    error: {
      message: process.env.NODE_ENV === 'production' ? 
        'Internal server error' : message,
      correlationId: req.correlationId
    }
  });
};

app.use(errorHandler);
```

### Retry Logic
```typescript
const retry = async (fn, maxAttempts = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      
      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: error.message,
        attempt,
        maxAttempts
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
};
```

## 📊 Performance Optimization

### Database Optimization

#### Connection Pooling
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: config.database.url,
  max: config.database.maxConnections,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Query with automatic connection management
const query = async (text, params) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};
```

#### Query Optimization
```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_workflows_org_id ON workflows(organization_id);
CREATE INDEX CONCURRENTLY idx_workflow_runs_status ON workflow_runs(status) WHERE status IN ('running', 'pending');
CREATE INDEX CONCURRENTLY idx_audit_logs_timestamp ON audit_logs(created_at) WHERE created_at >= NOW() - INTERVAL '30 days';

-- Optimize queries with proper WHERE clauses and LIMIT
SELECT w.*, wr.status, wr.started_at
FROM workflows w
LEFT JOIN workflow_runs wr ON w.id = wr.workflow_id
WHERE w.organization_id = $1
  AND w.active = true
ORDER BY w.updated_at DESC
LIMIT 50;
```

### Caching Strategy

#### Redis Caching
```typescript
import Redis from 'ioredis';

const redis = new Redis(config.redis.url);

const cache = {
  async get(key) {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  },
  
  async set(key, value, ttl = 3600) {
    await redis.setex(key, ttl, JSON.stringify(value));
  },
  
  async del(key) {
    await redis.del(key);
  },
  
  async invalidatePattern(pattern) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
};

// Usage in service
const getWorkflow = async (id, organizationId) => {
  const cacheKey = `workflow:${organizationId}:${id}`;
  
  let workflow = await cache.get(cacheKey);
  if (!workflow) {
    workflow = await db.query(
      'SELECT * FROM workflows WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );
    
    if (workflow) {
      await cache.set(cacheKey, workflow, 1800); // 30 minutes
    }
  }
  
  return workflow;
};
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflows

#### Continuous Integration
- **Linting**: ESLint, Prettier
- **Type Checking**: TypeScript compilation
- **Unit Tests**: Jest with coverage reporting
- **Integration Tests**: Database and API testing
- **Security Scanning**: Snyk, CodeQL, Trivy
- **Container Building**: Multi-stage Docker builds

#### Continuous Deployment
- **Image Building**: Multi-architecture container builds
- **Security Scanning**: Container vulnerability assessment
- **Staging Deployment**: Automated deployment to staging
- **Production Deployment**: Blue-green or canary deployment
- **Rollback**: Automated rollback on failure

### Deployment Strategies

#### Rolling Update (Default)
```bash
./scripts/deploy.sh --strategy rolling --environment staging
```

#### Blue-Green Deployment
```bash
./scripts/deploy.sh --strategy blue-green --environment production
```

#### Canary Deployment
```bash
./scripts/deploy.sh --strategy canary --environment production
```

## 🛠️ Development Tools

### Local Development Scripts
```bash
# Start all services
./run.sh dev

# Start specific service
./run.sh dev workflow-engine

# Run tests
./run.sh test

# Build for production
./run.sh build

# Clean build artifacts
./run.sh clean
```

### Database Management
```bash
# Run migrations
npm run migrate

# Seed development data
npm run seed

# Reset database
npm run db:reset

# Generate migration
npm run migrate:generate -- --name add_user_table
```

### Testing
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

## 📚 API Documentation

### OpenAPI/Swagger
Each service exposes API documentation at `/api-docs` endpoint.

### Service Endpoints

#### Workflow Engine (`http://localhost:3000`)
- `GET /health` - Health check
- `GET /api/v1/workflows` - List workflows
- `POST /api/v1/workflows` - Create workflow
- `GET /api/v1/workflows/:id` - Get workflow
- `PUT /api/v1/workflows/:id` - Update workflow
- `DELETE /api/v1/workflows/:id` - Delete workflow
- `POST /api/v1/workflows/:id/execute` - Execute workflow

#### Auth Service (`http://localhost:3001`)
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/mfa/setup` - Setup MFA
- `POST /api/v1/auth/mfa/verify` - Verify MFA

For complete API documentation, see individual service README files.

## 🚨 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose logs [service-name]

# Check health endpoint
curl http://localhost:3000/health

# Verify environment variables
docker-compose exec [service-name] env | grep -E "(POSTGRES|REDIS|KAFKA)"
```

#### Database Connection Issues
```bash
# Test database connectivity
docker-compose exec postgres psql -U officeflow -d officeflow -c "SELECT 1;"

# Check database logs
docker-compose logs postgres

# Verify connection string
echo $POSTGRES_URL
```

#### Kafka Issues
```bash
# Check Kafka logs
docker-compose logs kafka

# List topics
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Check consumer groups
docker-compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --list
```

### Performance Issues

#### High Memory Usage
```bash
# Check memory usage
docker stats

# Analyze heap dumps (Node.js)
node --inspect=0.0.0.0:9229 dist/index.js

# Monitor garbage collection
node --trace-gc dist/index.js
```

#### Slow Database Queries
```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- Analyze slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

For more troubleshooting information, see the [DEPLOYMENT.md](../DEPLOYMENT.md#troubleshooting) guide.