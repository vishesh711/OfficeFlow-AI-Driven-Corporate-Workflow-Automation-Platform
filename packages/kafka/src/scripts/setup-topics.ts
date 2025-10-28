#!/usr/bin/env node

import { TopicManager } from '../topic-manager';
import { defaultKafkaConfig } from '../config';

async function setupTopics() {
  const topicManager = new TopicManager({
    clientId: 'officeflow-topic-setup',
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    connectionTimeout: 3000,
    requestTimeout: 30000,
  });

  try {
    console.log('Connecting to Kafka cluster...');
    await topicManager.connect();

    console.log('Creating platform topics...');
    await topicManager.createAllTopics();

    console.log('Setting up consumer groups...');
    await topicManager.createConsumerGroups();

    // Create topics for demo organization if specified
    const demoOrgId = process.env.DEMO_ORG_ID;
    if (demoOrgId) {
      console.log(`Creating topics for demo organization: ${demoOrgId}`);
      await topicManager.createOrganizationTopics(demoOrgId);
    }

    console.log('Kafka setup completed successfully!');

    // List all topics for verification
    const topics = await topicManager.listTopics();
    console.log(`\nCreated ${topics.length} topics:`);
    topics.sort().forEach((topic) => console.log(`  - ${topic}`));
  } catch (error) {
    console.error('Failed to setup Kafka topics:', error);
    process.exit(1);
  } finally {
    await topicManager.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  setupTopics().catch(console.error);
}

export { setupTopics };
