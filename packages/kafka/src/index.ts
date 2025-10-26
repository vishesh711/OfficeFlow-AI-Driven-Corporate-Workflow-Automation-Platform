// Configuration exports
export * from './config';
export * from './topics';
export * from './consumer-groups';

// Management utilities
export { TopicManager } from './topic-manager';

// Producer and Consumer utilities
export { OfficeFlowProducer } from './producer';
export { OfficeFlowConsumer } from './consumer';
export { DLQHandler } from './dlq-handler';
export { CorrelationTracker } from './correlation-tracker';

// Types
export type { 
  OfficeFlowMessage, 
  MessageMetadata
} from './producer';
export type { MessageHandler, MessageContext } from './consumer';
export type { CorrelationContext, TraceEvent } from './correlation-tracker';

// Setup scripts
export { setupTopics } from './scripts/setup-topics';