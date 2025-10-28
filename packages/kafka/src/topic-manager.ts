import { Kafka, Admin, ITopicConfig } from 'kafkajs';
import { KafkaClusterConfig, TopicConfig } from './config';
import { ALL_TOPIC_CONFIGS } from './topics';

export class TopicManager {
  private kafka: Kafka;
  private admin: Admin;

  constructor(config: KafkaClusterConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      connectionTimeout: config.connectionTimeout,
      requestTimeout: config.requestTimeout,
      retry: config.retry,
      ssl: config.ssl,
      sasl: config.sasl,
    });

    this.admin = this.kafka.admin();
  }

  async connect(): Promise<void> {
    await this.admin.connect();
  }

  async disconnect(): Promise<void> {
    await this.admin.disconnect();
  }

  /**
   * Create all platform topics with proper configuration
   */
  async createAllTopics(): Promise<void> {
    const topicConfigs: ITopicConfig[] = Object.entries(ALL_TOPIC_CONFIGS).map(
      ([topicName, config]) => ({
        topic: topicName,
        numPartitions: config.numPartitions,
        replicationFactor: config.replicationFactor,
        configEntries: config.configEntries,
      })
    );

    await this.createTopics(topicConfigs);
  }

  /**
   * Create organization-specific lifecycle event topics
   */
  async createOrganizationTopics(organizationId: string): Promise<void> {
    const orgTopics: ITopicConfig[] = [
      'employee.onboard',
      'employee.exit',
      'employee.transfer',
      'employee.update',
    ].map((eventType) => {
      const baseConfig = ALL_TOPIC_CONFIGS[eventType];
      return {
        topic: `${eventType}.${organizationId}`,
        numPartitions: baseConfig.numPartitions,
        replicationFactor: baseConfig.replicationFactor,
        configEntries: baseConfig.configEntries,
      };
    });

    await this.createTopics(orgTopics);
  }

  /**
   * Create topics if they don't exist
   */
  async createTopics(topicConfigs: ITopicConfig[]): Promise<void> {
    try {
      const existingTopics = await this.admin.listTopics();
      const topicsToCreate = topicConfigs.filter(
        (config) => !existingTopics.includes(config.topic)
      );

      if (topicsToCreate.length === 0) {
        console.log('All topics already exist');
        return;
      }

      await this.admin.createTopics({
        topics: topicsToCreate,
        waitForLeaders: true,
        timeout: 30000,
      });

      console.log(
        `Created ${topicsToCreate.length} topics:`,
        topicsToCreate.map((t) => t.topic).join(', ')
      );
    } catch (error) {
      console.error('Failed to create topics:', error);
      throw error;
    }
  }

  /**
   * Delete topics (use with caution)
   */
  async deleteTopics(topicNames: string[]): Promise<void> {
    try {
      await this.admin.deleteTopics({
        topics: topicNames,
        timeout: 30000,
      });
      console.log(`Deleted topics: ${topicNames.join(', ')}`);
    } catch (error) {
      console.error('Failed to delete topics:', error);
      throw error;
    }
  }

  /**
   * List all topics
   */
  async listTopics(): Promise<string[]> {
    return await this.admin.listTopics();
  }

  /**
   * Get topic metadata
   */
  async getTopicMetadata(topicNames?: string[]) {
    return await this.admin.fetchTopicMetadata({ topics: topicNames || [] });
  }

  /**
   * Update topic configuration
   */
  async updateTopicConfig(
    topicName: string,
    configEntries: Array<{ name: string; value: string }>
  ): Promise<void> {
    try {
      await this.admin.alterConfigs({
        validateOnly: false,
        resources: [
          {
            type: 2, // TOPIC
            name: topicName,
            configEntries,
          },
        ],
      });
      console.log(`Updated configuration for topic: ${topicName}`);
    } catch (error) {
      console.error(`Failed to update topic configuration for ${topicName}:`, error);
      throw error;
    }
  }

  /**
   * Create consumer groups for microservices
   */
  async createConsumerGroups(): Promise<void> {
    // Consumer groups are created automatically when consumers join
    // This method documents the expected consumer groups
    const consumerGroups = [
      'workflow-engine',
      'identity-service',
      'email-service',
      'calendar-service',
      'slack-service',
      'document-service',
      'ai-service',
      'audit-service',
      'webhook-gateway',
      'scheduler-service',
    ];

    console.log('Expected consumer groups:', consumerGroups.join(', '));
    console.log('Consumer groups will be created automatically when services start');
  }

  /**
   * Get consumer group information
   */
  async getConsumerGroups(): Promise<any> {
    return await this.admin.listGroups();
  }

  /**
   * Delete consumer group (use with caution)
   */
  async deleteConsumerGroup(groupId: string): Promise<void> {
    try {
      await this.admin.deleteGroups([groupId]);
      console.log(`Deleted consumer group: ${groupId}`);
    } catch (error) {
      console.error(`Failed to delete consumer group ${groupId}:`, error);
      throw error;
    }
  }
}
