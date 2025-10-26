# OfficeFlow Kafka Package

This package provides Kafka infrastructure and utilities for the OfficeFlow platform, including producers, consumers, and dead letter queue handling.

## Features

- **OfficeFlowProducer**: High-level producer with message serialization and error handling
- **OfficeFlowConsumer**: Consumer with automatic retry logic and DLQ support
- **DLQHandler**: Dead letter queue processing with reprocessing and quarantine capabilities
- **TopicManager**: Topic creation and management utilities
- **CorrelationTracker**: Distributed tracing support

## Installation

```bash
npm install @officeflow/kafka
```

## Usage

### Producer

```typescript
import { OfficeFlowProducer } from '@officeflow/kafka';

const producer = new OfficeFlowProducer({
  clientId: 'my-service',
  brokers: ['localhost:9092'],
});

await producer.connect();

// Send a single message
await producer.sendMessage('employee.onboard', {
  type: 'employee.onboard',
  payload: {
    employeeId: 'emp-123',
    name: 'John Doe',
    department: 'Engineering'
  },
  metadata: {
    source: 'hr-system',
    organizationId: 'org-456'
  }
});

// Send to organization-specific topic
await producer.sendToOrganizationTopic(
  'employee.onboard',
  'org-456',
  message
);
```

### Consumer

```typescript
import { OfficeFlowConsumer } from '@officeflow/kafka';

const consumer = new OfficeFlowConsumer(
  {
    clientId: 'my-service',
    brokers: ['localhost:9092'],
  },
  {
    groupId: 'my-consumer-group',
  }
);

// Register message handlers
consumer.registerHandler('employee.onboard', async (message, context) => {
  console.log('Processing onboarding:', message.payload);
  // Process the message
});

await consumer.connect();
await consumer.subscribe({
  topics: ['employee.onboard.org-456'],
  fromBeginning: false,
});

await consumer.run();
```

### DLQ Handler

```typescript
import { DLQHandler } from '@officeflow/kafka';

const dlqHandler = new DLQHandler({
  clientId: 'dlq-processor',
  brokers: ['localhost:9092'],
}, {
  maxReprocessAttempts: 3,
  reprocessDelayMs: 60000,
  quarantineAfterAttempts: 5,
});

await dlqHandler.start();
```

## Testing

This package includes both unit tests and integration tests.

### Unit Tests

Unit tests use mocked Kafka clients and can be run without external dependencies:

```bash
npm test
```

### Integration Tests

Integration tests require a running Kafka cluster. Follow these steps to run them:

#### Prerequisites

1. **Docker and Docker Compose** (recommended approach)
2. **Local Kafka installation** (alternative)

#### Option 1: Using Docker Compose (Recommended)

1. Create a `docker-compose.yml` file in the project root:

```yaml
version: '3.8'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:7.4.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
```

2. Start the Kafka cluster:

```bash
docker-compose up -d
```

3. Wait for Kafka to be ready (usually 30-60 seconds), then run the integration tests:

```bash
npm run test:integration
```

4. Stop the cluster when done:

```bash
docker-compose down
```

#### Option 2: Local Kafka Installation

1. Download and install Apache Kafka from [https://kafka.apache.org/downloads](https://kafka.apache.org/downloads)

2. Start Zookeeper:

```bash
bin/zookeeper-server-start.sh config/zookeeper.properties
```

3. Start Kafka:

```bash
bin/kafka-server-start.sh config/server.properties
```

4. Run the integration tests:

```bash
npm run test:integration
```

#### Environment Variables

You can customize the Kafka connection for tests using environment variables:

```bash
export KAFKA_BROKERS=localhost:9092,localhost:9093,localhost:9094
npm run test:integration
```

### Test Coverage

Run tests with coverage reporting:

```bash
npm run test:coverage
```

## Configuration

### Kafka Cluster Configuration

```typescript
interface KafkaClusterConfig {
  clientId: string;
  brokers: string[];
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    initialRetryTime?: number;
    retries?: number;
  };
  ssl?: boolean | tls.ConnectionOptions;
  sasl?: SASLOptions;
}
```

### Consumer Group Configuration

```typescript
interface ConsumerGroupConfig {
  groupId: string;
  sessionTimeout?: number;
  rebalanceTimeout?: number;
  heartbeatInterval?: number;
  maxBytesPerPartition?: number;
  minBytes?: number;
  maxBytes?: number;
  maxWaitTimeInMs?: number;
}
```

### Producer Options

```typescript
interface ProducerOptions {
  enableIdempotence?: boolean;
  maxInFlightRequests?: number;
  transactionTimeout?: number;
  retry?: {
    initialRetryTime?: number;
    retries?: number;
  };
}
```

## Message Format

All messages follow the OfficeFlow message format:

```typescript
interface OfficeFlowMessage<T = any> {
  id: string;
  type: string;
  metadata: {
    correlationId: string;
    timestamp: Date;
    source: string;
    version: string;
    organizationId?: string;
    employeeId?: string;
  };
  payload: T;
}
```

## Topic Naming Convention

- **Lifecycle Events**: `employee.{event}.{org_id}` (e.g., `employee.onboard.org-123`)
- **Node Execution**: `node.execute.{org_id}`
- **Dead Letter Queues**: `dlq.{original_topic}`
- **Manual Review**: `manual.review.queue`
- **Quarantine**: `quarantine.queue`

## Error Handling

The package implements comprehensive error handling:

- **Automatic Retries**: Configurable retry logic with exponential backoff
- **Dead Letter Queues**: Failed messages are routed to DLQ topics
- **Circuit Breakers**: Automatic failure detection for external services
- **Correlation Tracking**: Distributed tracing support for debugging

## Performance Considerations

- **Partitioning**: Messages are partitioned by `organizationId` for tenant isolation
- **Batching**: Producer supports batch message sending for better throughput
- **Connection Pooling**: Efficient connection management and reuse
- **Backpressure**: Built-in backpressure handling to prevent memory issues

## Monitoring

The package provides metrics and logging for monitoring:

- **Structured Logging**: JSON logs with correlation IDs
- **Metrics**: Producer/consumer metrics for monitoring
- **Health Checks**: Connection health monitoring
- **DLQ Statistics**: Dead letter queue processing metrics

## Contributing

1. Run unit tests: `npm test`
2. Run integration tests: `npm run test:integration` (requires Kafka)
3. Check types: `npm run type-check`
4. Lint code: `npm run lint`
5. Build package: `npm run build`

## License

MIT