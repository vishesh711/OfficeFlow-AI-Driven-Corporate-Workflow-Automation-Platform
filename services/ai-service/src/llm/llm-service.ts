import { OpenAIClient } from './openai-client';
import { TemplateManager } from '../templates/template-manager';
import { CostTracker } from '../monitoring/cost-tracker';
import { 
  LLMRequest, 
  LLMResponse, 
  ContentGenerationRequest, 
  ContentGenerationResult,
  CostMetrics 
} from '../types/ai-types';
import { AIServiceConfig } from '../config/ai-config';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from '../utils/uuid';

export class LLMService {
  private openaiClient: OpenAIClient;
  private templateManager: TemplateManager;
  private costTracker: CostTracker;
  private config: AIServiceConfig;
  private logger: Logger;
  private cache: Map<string, { result: ContentGenerationResult; timestamp: Date }> = new Map();

  constructor(config: AIServiceConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    this.openaiClient = new OpenAIClient(config.openai, logger);
    this.templateManager = new TemplateManager(logger);
    this.costTracker = new CostTracker(logger);
  }

  async generateContent(
    organizationId: string,
    request: ContentGenerationRequest,
    context?: { workflowId?: string; runId?: string; nodeType?: string }
  ): Promise<ContentGenerationResult> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      this.logger.info('Generating AI content', {
        requestId,
        organizationId,
        type: request.type,
        templateId: request.templateId,
        hasCustomPrompt: !!request.customPrompt,
      });

      // Check rate limits
      const rateLimitCheck = this.costTracker.checkRateLimit(
        organizationId,
        this.config.rateLimiting.requestsPerMinute,
        this.config.rateLimiting.tokensPerMinute
      );

      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded: ${rateLimitCheck.reason}. Reset at ${rateLimitCheck.resetTime}`);
      }

      // Check cache if enabled
      if (this.config.caching.enabled) {
        const cacheKey = this.generateCacheKey(request);
        const cached = this.cache.get(cacheKey);
        
        if (cached && this.isCacheValid(cached.timestamp)) {
          this.logger.info('Returning cached AI content', { requestId, cacheKey });
          return cached.result;
        }
      }

      // Generate prompt
      let prompt: string;
      let templateUsed: string | undefined;

      if (request.templateId) {
        templateUsed = request.templateId;
        prompt = this.templateManager.renderTemplate(request.templateId, request.data);
      } else if (request.customPrompt) {
        prompt = request.customPrompt;
      } else {
        // Use default template based on type
        templateUsed = this.getDefaultTemplateForType(request.type);
        prompt = this.templateManager.renderTemplate(templateUsed, request.data);
      }

      // Prepare LLM request
      const llmRequest: LLMRequest = {
        model: request.options?.model || this.config.openai.defaultModel,
        prompt,
        maxTokens: request.options?.maxTokens || this.config.openai.maxTokens,
        temperature: request.options?.temperature ?? this.config.openai.temperature,
        outputFormat: request.options?.outputFormat || 'text',
        systemMessage: this.getSystemMessageForType(request.type),
      };

      // Generate completion
      const llmResponse = await this.openaiClient.generateCompletion(llmRequest);
      
      // Track costs
      if (this.config.costTracking.enabled) {
        const costMetrics: CostMetrics = {
          requestId,
          organizationId,
          model: llmResponse.model,
          promptTokens: llmResponse.usage.promptTokens,
          completionTokens: llmResponse.usage.completionTokens,
          totalTokens: llmResponse.usage.totalTokens,
          estimatedCost: 0, // Will be calculated by cost tracker
          timestamp: new Date(),
          nodeType: context?.nodeType || 'ai_service',
          workflowId: context?.workflowId,
          runId: context?.runId,
        };
        
        this.costTracker.trackUsage(costMetrics);
        this.costTracker.updateRateLimit(organizationId, llmResponse.usage.totalTokens);
      }

      // Prepare result
      const result: ContentGenerationResult = {
        content: llmResponse.content,
        metadata: {
          templateUsed,
          model: llmResponse.model,
          tokensUsed: llmResponse.usage.totalTokens,
          processingTimeMs: Date.now() - startTime,
        },
        cost: {
          estimatedCost: 0, // Will be set by cost tracker
          tokenBreakdown: {
            prompt: llmResponse.usage.promptTokens,
            completion: llmResponse.usage.completionTokens,
            total: llmResponse.usage.totalTokens,
          },
        },
      };

      // Get cost from tracker
      const costSummary = this.costTracker.getCostSummary(organizationId);
      if (costSummary.requestCount > 0) {
        // Estimate cost for this request (rough approximation)
        result.cost.estimatedCost = costSummary.totalCost / costSummary.requestCount;
      }

      // Cache result if enabled
      if (this.config.caching.enabled) {
        const cacheKey = this.generateCacheKey(request);
        this.cache.set(cacheKey, { result, timestamp: new Date() });
        
        // Clean up old cache entries
        this.cleanupCache();
      }

      this.logger.info('AI content generated successfully', {
        requestId,
        organizationId,
        type: request.type,
        tokensUsed: result.metadata.tokensUsed,
        processingTimeMs: result.metadata.processingTimeMs,
        contentLength: result.content.length,
      });

      return result;

    } catch (error) {
      this.logger.error('AI content generation failed', {
        requestId,
        organizationId,
        type: request.type,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      });

      throw error;
    }
  }

  async validateConnection(): Promise<boolean> {
    return this.openaiClient.validateConnection();
  }

  getCostSummary(organizationId: string, timeRange?: { start: Date; end: Date }) {
    return this.costTracker.getCostSummary(organizationId, timeRange);
  }

  getTemplateManager(): TemplateManager {
    return this.templateManager;
  }

  getCostTracker(): CostTracker {
    return this.costTracker;
  }

  private getDefaultTemplateForType(type: ContentGenerationRequest['type']): string {
    switch (type) {
      case 'welcome_message':
        return 'welcome_message';
      case 'role_specific_content':
        return 'role_specific_content';
      case 'document_summary':
        return 'document_summary';
      case 'sentiment_analysis':
        return 'sentiment_analysis';
      default:
        throw new Error(`No default template for type: ${type}`);
    }
  }

  private getSystemMessageForType(type: ContentGenerationRequest['type']): string {
    switch (type) {
      case 'welcome_message':
        return 'You are a professional HR communication specialist. Create warm, welcoming, and informative messages for new employees.';
      case 'role_specific_content':
        return 'You are an expert in organizational onboarding and role-specific training. Provide comprehensive, actionable guidance.';
      case 'document_summary':
        return 'You are a skilled document analyst. Create clear, concise, and accurate summaries that capture key information.';
      case 'sentiment_analysis':
        return 'You are an expert in sentiment analysis and emotional intelligence. Provide accurate, nuanced analysis with actionable insights.';
      default:
        return 'You are a helpful AI assistant. Provide accurate, professional, and relevant responses.';
    }
  }

  private generateCacheKey(request: ContentGenerationRequest): string {
    const keyData = {
      type: request.type,
      templateId: request.templateId,
      customPrompt: request.customPrompt,
      data: request.data,
      options: request.options,
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  private isCacheValid(timestamp: Date): boolean {
    const now = new Date();
    const ageSeconds = (now.getTime() - timestamp.getTime()) / 1000;
    return ageSeconds < this.config.caching.ttlSeconds;
  }

  private cleanupCache(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isCacheValid(entry.timestamp)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    // Also limit cache size
    if (this.cache.size > 1000) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
      
      // Remove oldest 20% of entries
      const toRemove = Math.floor(entries.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }
}