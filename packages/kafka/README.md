# @officeflow/kafka

Kafka infrastructure and utilities for the OfficeFlow platform. This package provides event streaming capabilities with producer/consumer utilities, topic management, dead letter queue handling, and distributed tracing support.

## Features

- **Topic Management**: Automated topic creation with proper partitioning and retention policies
- **Producer Utilities**: Reusable Kafka producer with serialization, error handling, and correlation ID tracking
- **Consumer Base Class**: Automatic offset management, retry logic, and dead letter queue handling
- **Dead Letter Queue**: Failed message handling with automatic retry and quarantine mechanisms
- **Correlation Tracking**: Distributed tracing support for message flows across services
- **Consumer Groups**: Pre-configured consumer groups for each microservice

## Installation

```bash
npm install @officeflow/kafka
```

## Quick Start

### Setting up Topics

```typescript
import { TopicManager, defaultKafkaConfig } from '@officeflow/kafka';

const topicManager = new TopicManager({
  clientId: 'officeflow-setup',
  brokers: ['localhost:9092'],
});

await topicManager.connect();
await topicManager.createAllTopics();
await topicManager.disconnect();
```

### Producer Usage

```typescript
import { OfficeFlowProducer } from '@officeflow/kafka';

const producer = new OfficeFlowProducer({
  clientId: 'my-service',
  brokers: ['localhost:9092'],
});

await producer.connect();

// Send a lifecycle event
await producer.sendToOrganizationTopic(
  'employee.onboard',
  'org-123',
  {
    type: 'employee.onboard',
    payload: {
      employeeId: 'emp-456',
      name: 'John Doe',
      department: 'Engineering',
    },
    metadata: {
      source: 'hrms-adapter',
      employeeId: 'emp-456',
    },
  }
);

await producer.disconnect();
```

### Consumer Usage

```typescript
import { OfficeFlowConsumer, MessageHandler } from '@officeflow/kafka';

const consumer = new OfficeFlowConsumer(
  {
    clientId: 'workflow-engine',
    brokers: ['localhost:9092'],
  },
  {
    groupId: 'workflow-engine',
  }
);

// Register message handlers
const onboardHandler: MessageHandler = async (message, context) => {
  console.log('Processing onboard event:', message.payload);
  // Process the employee onboarding workflow
};

consumer.registerHandler('employee.onboard', onboardHandler);

await consumer.connect();
await consumer.subscribe({
  topics: ['employee.onboard.*'],
  fromBeginning: false,
});

await consumer.run();
```

### Dead Letter Queue Handling

```typescript
import { DLQHandler } from '@officeflow/kafka';

const dlqHandler = new DLQHandler({
  clientId: 'dlq-processor',
  brokers: ['localhost:9092'],
});

await dlqHandler.start();
// DLQ handler will automatically process failed messages
```

### Correlation Tracking

```typescript
import { CorrelationTracker } from '@officeflow/kafka';

const tracker = CorrelationTracker.getInstance();

// Create a new correlation context
const context = tracker.createContext({
  organizationId: 'org-123',
  employeeId: 'emp-456',
  workflowRunId: 'run-789',
});

// Record trace events
tracker.recordEvent(
  context.correlationId,
  'workflow-engine',
  'start-workflow',
  'started'
);

// Create child context for nested operations
const childContext = tracker.createChildContext(
  context.correlationId,
  { nodeRunId: 'node-run-123' }
);
```

## Topic Structure

The platform uses a structured topic naming convention:

### Lifecycle Events
- `employee.onboard.{org_id}`
- `employee.exit.{org_id}`
- `employee.transfer.{org_id}`
- `employee.update.{org_id}`

### Workflow Control
- `workflow.run.request`
- `workflow.run.pause`
- `workflow.run.resume`
- `workflow.run.cancel`

### Node Execution
- `node.execute.request`
- `node.execute.result`
- `node.execute.retry`

### Integration Events
- `identity.provision.request`
- `identity.provision.result`
- `email.send.request`
- `email.send.result`
- `calendar.schedule.request`
- `calendar.schedule.result`

### Observability
- `audit.events`
- `metrics.events`

### Dead Letter Queues
- `dlq.{original_topic_name}`

## Consumer Groups

Pre-configured consumer groups for each microservice:

- `workflow-engine`: Processes lifecycle events and workflow control messages
- `identity-service`: Handles identity provisioning requests
- `email-service`: Processes email sending requests
- `calendar-service`: Handles calendar scheduling requests
- `slack-service`: Processes Slack integration requests
- `document-service`: Handles document operations
- `ai-service`: Processes AI content generation requests
- `audit-service`: Records audit events and compliance data

## Configuration

### Environment Variables

```bash
KAFKA_BROKERS=localhost:9092,localhost:9093,localhost:9094
DEMO_ORG_ID=demo-org-123
```

### Kafka Configuration

```typescript
const config: KafkaClusterConfig = {
  clientId: 'my-service',
  brokers: ['localhost:9092'],
  connectionTimeout: 3000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
  ssl: false, // Set to true for SSL connections
  sasl: {     // Optional SASL authentication
    mechanism: 'plain',
    username: 'user',
    password: 'pass',
  },
};
```

## Scripts

### Setup Topics

```bash
npm run setup-topics
```

This script will:
1. Connect to the Kafka cluster
2. Create all platform topics with proper configuration
3. Set up consumer groups
4. Create demo organization topics if `DEMO_ORG_ID` is set

## Error Handling

The package includes comprehensive error handling:

- **Retry Logic**: Exponential backoff with configurable retry attempts
- **Dead Letter Queues**: Failed messages are automatically routed to DLQ topics
- **Circuit Breakers**: Automatic failure detection for external services
- **Correlation Tracking**: Full distributed tracing support

## Requirements Satisfied

This implementation satisfies the following requirements from the OfficeFlow specification:

- **Requirement 2.1**: Event-driven workflow execution with Kafka message processing
- **Requirement 2.2**: Workflow orchestration with proper event handling
- **Requirement 2.4**: Retry logic and error handling for failed operations
- **Requirement 6.3**: Scalable event streaming with proper partitioning
- **Requirement 7.4**: Dead letter queue handling for failed messages
- **Requirement 7.5**: Message durability and reliability guarantees

## License

Private - OfficeFlow Platform