# OfficeFlow Workflow Engine

The Workflow Engine is the core orchestration service that manages workflow execution in the OfficeFlow platform.

## Features

- **Event-driven orchestration**: Processes lifecycle events and triggers workflows
- **State management**: Redis-based distributed state management with locking
- **Node dispatching**: Kafka-based node execution with retry logic
- **Workflow control**: Pause, resume, and cancel workflow operations
- **Context management**: Parameter passing and variable resolution
- **Error handling**: Comprehensive retry and compensation flows

## Architecture

### Core Components

1. **WorkflowOrchestrator**: Main orchestration engine
2. **NodeDispatcher**: Handles node execution via Kafka
3. **ExecutionContextManager**: Manages workflow variables and parameters
4. **RedisStateManager**: Distributed state management
5. **WorkflowStateMachine**: State transition management

### State Management

The engine uses Redis for distributed state management:
- Workflow states with TTL
- Node execution states
- Distributed locking for concurrent execution prevention
- Retry scheduling with sorted sets

### Message Flow

1. Lifecycle events trigger workflows
2. Workflow engine loads workflow definition
3. Eligible nodes are dispatched via Kafka
4. Node executors process tasks and return results
5. Engine continues workflow based on results

## Configuration

Environment variables:

```bash
# Service
PORT=3001
INSTANCE_ID=workflow-engine-1

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/officeflow

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=workflow-engine
KAFKA_GROUP_ID=workflow-engine-group

# Orchestrator
MAX_CONCURRENT_WORKFLOWS=100
NODE_EXECUTION_TIMEOUT=300000
WORKFLOW_EXECUTION_TIMEOUT=3600000
```

## API Endpoints

- `POST /api/v1/workflows/:id/execute` - Execute workflow manually
- `POST /api/v1/workflow-runs/:id/pause` - Pause workflow
- `POST /api/v1/workflow-runs/:id/resume` - Resume workflow
- `POST /api/v1/workflow-runs/:id/cancel` - Cancel workflow
- `GET /api/v1/workflow-runs/:id` - Get workflow run details
- `GET /api/v1/workflows/:id/runs` - Get workflow run history
- `GET /api/v1/health` - Health check

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev

# Run tests
npm test

# Type check
npm run type-check
```

## Testing

The service includes unit tests for core components:
- State machine transitions
- Context management
- Node dispatching logic

Run tests with:
```bash
npm test
```