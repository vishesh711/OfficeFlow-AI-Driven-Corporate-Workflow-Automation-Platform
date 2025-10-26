# Webhook Gateway Service

The Webhook Gateway service is a critical component of the OfficeFlow platform that handles incoming webhooks from HRMS systems and normalizes them into standardized lifecycle events. It also provides polling mechanisms for systems that don't support webhooks.

## Features

### Webhook Processing
- **Multi-source Support**: Handles webhooks from Workday, SuccessFactors, BambooHR, and generic sources
- **Signature Verification**: Validates webhook signatures using HMAC SHA256/SHA1
- **Event Transformation**: Normalizes different HRMS event formats into standard lifecycle events
- **Rate Limiting**: Protects against DDoS attacks with configurable rate limits
- **Retry Logic**: Implements exponential backoff for failed webhook processing

### HRMS Adapters
- **Workday Integration**: Polls Workday API for employee lifecycle events
- **SuccessFactors Integration**: Connects to SAP SuccessFactors OData API
- **BambooHR Integration**: Polls BambooHR API for employee changes
- **Polling Mechanism**: Configurable polling intervals for each HRMS system
- **Health Monitoring**: Continuous health checks for all adapters

### Event Streaming
- **Kafka Integration**: Publishes normalized events to Kafka topics
- **Event Correlation**: Tracks events with correlation IDs for distributed tracing
- **Topic Partitioning**: Partitions events by organization for scalability
- **Dead Letter Queues**: Handles failed message processing

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   HRMS Systems  │    │  Webhook Gateway │    │  Kafka Topics   │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │   Workday   │─┼────┼─│   Webhook    │ │    │ │ employee.   │ │
│ └─────────────┘ │    │ │   Endpoint   │ │    │ │ onboard     │ │
│                 │    │ └──────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │        │         │    │                 │
│ │SuccessFactors│─┼────┼────────┼─────────┼────┼─┐ ┌─────────────┐ │
│ └─────────────┘ │    │        │         │    │ │ │ employee.   │ │
│                 │    │ ┌──────▼──────┐  │    │ │ │ exit        │ │
│ ┌─────────────┐ │    │ │   Event     │  │    │ │ └─────────────┘ │
│ │  BambooHR   │─┼────┼─│ Transformer │  │    │ │                 │
│ └─────────────┘ │    │ └──────┬──────┘  │    │ │ ┌─────────────┐ │
└─────────────────┘    │        │         │    │ └─│ employee.   │ │
                       │ ┌──────▼──────┐  │    │   │ transfer    │ │
                       │ │   Kafka     │  │    │   └─────────────┘ │
                       │ │  Producer   │──┼────┤                   │
                       │ └─────────────┘  │    │ ┌─────────────┐   │
                       └──────────────────┘    │ │ employee.   │   │
                                               │ │ update      │   │
                                               │ └─────────────┘   │
                                               └─────────────────┘
```

## API Endpoints

### Webhook Endpoints
- `POST /api/webhook/:source/:organizationId` - Receive webhooks from HRMS systems
- `GET /api/health` - Health check endpoint
- `POST /api/test/webhook` - Test webhook endpoint (development only)

### Configuration Endpoints
- `POST /api/config/webhook` - Register webhook configuration
- `GET /api/config/webhook` - Get webhook configurations
- `DELETE /api/config/webhook/:organizationId/:source` - Remove webhook configuration

### Admin Endpoints
- `GET /api/admin/adapters/health` - Get adapter health status
- `POST /api/admin/adapters/poll` - Manually trigger polling for all adapters
- `POST /api/admin/adapters/:source/poll` - Manually trigger polling for specific adapter
- `GET /api/admin/adapters` - Get adapter configurations

## Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3010
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/officeflow

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=webhook-gateway

# Redis (for rate limiting)
REDIS_URL=redis://localhost:6379

# Security
WEBHOOK_SECRET_KEY=your-webhook-secret-key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# HRMS Configuration
WORKDAY_TENANT_URL=https://your-tenant.workday.com
WORKDAY_USERNAME=integration_user
WORKDAY_PASSWORD=integration_password
WORKDAY_POLL_INTERVAL_MS=300000

SUCCESSFACTORS_API_URL=https://api.successfactors.com
SUCCESSFACTORS_COMPANY_ID=your_company_id
SUCCESSFACTORS_USERNAME=api_user
SUCCESSFACTORS_PASSWORD=api_password
SUCCESSFACTORS_POLL_INTERVAL_MS=300000

BAMBOOHR_SUBDOMAIN=your_subdomain
BAMBOOHR_API_KEY=your_api_key
BAMBOOHR_POLL_INTERVAL_MS=300000

# Logging
LOG_LEVEL=info
```

## Usage

### Starting the Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Webhook Registration

Register a webhook configuration:

```bash
curl -X POST http://localhost:3010/api/config/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org-123",
    "source": "workday",
    "endpoint": "https://your-domain.com/webhook",
    "secretKey": "your-secret-key",
    "isActive": true,
    "retryPolicy": {
      "maxRetries": 3,
      "backoffMs": 1000,
      "maxBackoffMs": 30000,
      "retryableStatusCodes": [408, 429, 500, 502, 503, 504]
    }
  }'
```

### Sending Test Webhook

```bash
curl -X POST http://localhost:3010/api/webhook/workday/org-123 \
  -H "Content-Type: application/json" \
  -H "x-signature: sha256=your-signature" \
  -d '{
    "eventType": "worker.hire",
    "timestamp": "2024-01-15T10:00:00Z",
    "worker": {
      "workerId": "emp-123",
      "email": "john.doe@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "department": "Engineering",
      "jobTitle": "Software Engineer",
      "startDate": "2024-01-15",
      "status": "active"
    }
  }'
```

## Event Transformation

The service transforms HRMS-specific events into normalized lifecycle events:

### Input (Workday)
```json
{
  "eventType": "worker.hire",
  "worker": {
    "workerId": "emp-123",
    "email": "john.doe@company.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### Output (Normalized)
```json
{
  "type": "employee.onboard",
  "organizationId": "org-123",
  "employeeId": "emp-123",
  "payload": {
    "employee": {
      "id": "emp-123",
      "email": "john.doe@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "status": "active"
    },
    "metadata": {
      "source": "workday",
      "sourceEventType": "worker.hire",
      "processedAt": "2024-01-15T10:05:00Z",
      "version": "1.0"
    }
  },
  "timestamp": "2024-01-15T10:00:00Z",
  "source": "workday",
  "correlationId": "uuid-here"
}
```

## Monitoring

### Health Checks

The service provides comprehensive health checks:

```bash
curl http://localhost:3010/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "webhook": {
    "status": "healthy",
    "details": {
      "kafka": "connected",
      "registeredWebhooks": 3
    }
  },
  "adapters": {
    "workday": {
      "healthy": true,
      "polling": true,
      "details": {
        "status": 200,
        "lastPolledAt": "2024-01-15T09:55:00Z"
      }
    }
  }
}
```

### Metrics

The service exposes metrics for monitoring:
- Webhook processing rate
- Event transformation success/failure rate
- Adapter polling frequency
- Kafka publishing metrics

## Security

### Signature Verification

All webhooks are verified using HMAC signatures:
- Supports SHA256 and SHA1 algorithms
- Configurable secret keys per organization
- Timing-safe comparison to prevent timing attacks

### Rate Limiting

Built-in protection against abuse:
- Configurable rate limits per organization
- Exponential backoff for repeated violations
- DDoS protection with request slowdown

### Input Validation

Comprehensive validation of all inputs:
- JSON schema validation
- Required field checking
- Data type validation
- Sanitization of user inputs

## Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## Troubleshooting

### Common Issues

1. **Webhook signature verification fails**
   - Check that the secret key matches between sender and receiver
   - Verify the signature algorithm (SHA256 vs SHA1)
   - Ensure the payload is not modified in transit

2. **HRMS adapter polling fails**
   - Verify credentials are correct
   - Check network connectivity to HRMS system
   - Review API rate limits and quotas

3. **Kafka publishing fails**
   - Ensure Kafka brokers are accessible
   - Check topic permissions
   - Verify Kafka cluster health

### Logs

The service uses structured JSON logging. Key log fields:
- `service`: Always "webhook-gateway"
- `level`: Log level (error, warn, info, debug)
- `timestamp`: ISO timestamp
- `message`: Human-readable message
- `organizationId`: Organization identifier
- `source`: HRMS source system
- `correlationId`: Request correlation ID

Example log entry:
```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "service": "webhook-gateway",
  "message": "Webhook processed successfully",
  "organizationId": "org-123",
  "source": "workday",
  "eventsProcessed": 1,
  "correlationId": "uuid-here"
}
```