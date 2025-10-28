import { NodeExecutor, NodeInput, NodeResult, NodeSchema, AINodeParams } from '@officeflow/types';
import { ValidationResult } from '@officeflow/types';
import { LLMService } from './llm/llm-service';
import { ContentGenerator, EmployeeProfile, CompanyProfile } from './content/content-generator';
import { Logger } from './utils/logger';
import MockJoi from './utils/mock-joi';

export class AINodeExecutor implements NodeExecutor {
  private llmService: LLMService;
  private contentGenerator: ContentGenerator;
  private logger: Logger;

  constructor(llmService: LLMService, logger: Logger) {
    this.llmService = llmService;
    this.contentGenerator = new ContentGenerator(llmService, logger);
    this.logger = logger;
  }

  async execute(input: NodeInput): Promise<NodeResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Executing AI node', {
        nodeId: input.nodeId,
        runId: input.runId,
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        attempt: input.attempt,
      });

      // Validate parameters
      const validation = this.validate(input.params);
      if (!validation.isValid) {
        throw new Error(`Parameter validation failed: ${validation.errors.join(', ')}`);
      }

      const params = input.params as AINodeParams;
      let result: any;

      // Execute based on AI node type (inferred from params or context)
      const aiType = this.inferAIType(params, input.context);

      switch (aiType) {
        case 'welcome_message':
          result = await this.executeWelcomeMessage(input, params);
          break;

        case 'role_specific_content':
          result = await this.executeRoleSpecificContent(input, params);
          break;

        case 'document_summary':
          result = await this.executeDocumentSummary(input, params);
          break;

        case 'sentiment_analysis':
          result = await this.executeSentimentAnalysis(input, params);
          break;

        case 'custom':
        default:
          result = await this.executeCustomPrompt(input, params);
          break;
      }

      const executionTime = Date.now() - startTime;

      this.logger.info('AI node executed successfully', {
        nodeId: input.nodeId,
        runId: input.runId,
        aiType,
        executionTimeMs: executionTime,
        outputLength: result.content?.length || 0,
      });

      return {
        status: 'success',
        output: {
          content: result.content,
          metadata: result.metadata,
          cost: result.cost,
          aiType,
        },
        metadata: {
          executionId: input.idempotencyKey,
          startTime: new Date(startTime),
          endTime: new Date(),
          duration: executionTime,
          retryCount: input.attempt - 1,
          correlationId: input.context.correlationId,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error('AI node execution failed', {
        nodeId: input.nodeId,
        runId: input.runId,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: executionTime,
        attempt: input.attempt,
      });

      // Determine if this is a retryable error
      const isRetryable = this.isRetryableError(error);

      return {
        status: isRetryable ? 'retry' : 'failed',
        output: {},
        error: {
          code: 'AI_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown AI execution error',
          timestamp: new Date(),
          details: {
            nodeId: input.nodeId,
            runId: input.runId,
            executionTimeMs: executionTime,
            isRetryable,
          },
        },
        metadata: {
          executionId: input.idempotencyKey,
          startTime: new Date(startTime),
          endTime: new Date(),
          duration: executionTime,
          retryCount: input.attempt - 1,
          correlationId: input.context.correlationId,
        },
      };
    }
  }

  validate(params: Record<string, any>): ValidationResult {
    const schema = MockJoi.object({
      provider: MockJoi.string().valid('openai', 'anthropic', 'azure_openai').default('openai'),
      model: MockJoi.string().optional(),
      prompt: MockJoi.string().required(),
      templateData: MockJoi.object().optional(),
      maxTokens: MockJoi.number().integer().min(1).max(8000).optional(),
      temperature: MockJoi.number().min(0).max(2).optional(),
      outputFormat: MockJoi.string().valid('text', 'json', 'markdown').default('text'),

      // AI-specific parameters
      aiType: MockJoi.string()
        .valid(
          'welcome_message',
          'role_specific_content',
          'document_summary',
          'sentiment_analysis',
          'custom'
        )
        .optional(),
      employee: MockJoi.object().optional(),
      company: MockJoi.object().optional(),
      document: MockJoi.object().optional(),
      text: MockJoi.string().optional(),
      options: MockJoi.object().optional(),
    });

    const { error, value } = schema.validate(params, { allowUnknown: true });

    if (error) {
      return {
        isValid: false,
        errors: error.details.map((detail) => detail.message),
      };
    }

    return {
      isValid: true,
      errors: [],
    };
  }

  getSchema(): NodeSchema {
    return {
      type: 'ai_service',
      name: 'AI Content Generator',
      description: 'Generate personalized content using AI/LLM services',
      category: 'AI & Content',
      parameters: [
        {
          name: 'provider',
          type: 'string',
          description: 'AI provider to use',
          required: false,
          defaultValue: 'openai',
          validation: {
            enum: ['openai', 'anthropic', 'azure_openai'],
          },
        },
        {
          name: 'model',
          type: 'string',
          description: 'AI model to use (optional, uses default if not specified)',
          required: false,
        },
        {
          name: 'prompt',
          type: 'string',
          description: 'Prompt template or custom prompt text',
          required: true,
          validation: {
            minLength: 10,
            maxLength: 10000,
          },
        },
        {
          name: 'templateData',
          type: 'object',
          description: 'Data to substitute in prompt template',
          required: false,
        },
        {
          name: 'maxTokens',
          type: 'number',
          description: 'Maximum tokens to generate',
          required: false,
          defaultValue: 2000,
          validation: {
            min: 1,
            max: 8000,
          },
        },
        {
          name: 'temperature',
          type: 'number',
          description: 'Creativity/randomness level (0.0 to 2.0)',
          required: false,
          defaultValue: 0.7,
          validation: {
            min: 0,
            max: 2,
          },
        },
        {
          name: 'outputFormat',
          type: 'string',
          description: 'Expected output format',
          required: false,
          defaultValue: 'text',
          validation: {
            enum: ['text', 'json', 'markdown'],
          },
        },
        {
          name: 'aiType',
          type: 'string',
          description: 'Type of AI content to generate',
          required: false,
          validation: {
            enum: [
              'welcome_message',
              'role_specific_content',
              'document_summary',
              'sentiment_analysis',
              'custom',
            ],
          },
        },
      ],
      outputs: [
        {
          name: 'content',
          type: 'string',
          description: 'Generated content',
        },
        {
          name: 'metadata',
          type: 'object',
          description: 'Generation metadata (model, tokens, etc.)',
        },
        {
          name: 'cost',
          type: 'object',
          description: 'Cost information and token usage',
        },
      ],
      examples: [
        {
          name: 'Welcome Message',
          description: 'Generate personalized welcome message for new employee',
          input: {
            aiType: 'welcome_message',
            prompt: 'Generate welcome message',
            templateData: {
              employee: {
                firstName: 'John',
                lastName: 'Doe',
                role: 'Software Engineer',
                department: 'Engineering',
              },
              company: {
                name: 'TechCorp',
                industry: 'Technology',
              },
            },
          },
          expectedOutput: {
            content:
              'Welcome to TechCorp, John! We are excited to have you join our Engineering team as a Software Engineer...',
            metadata: {
              model: 'gpt-4',
              tokensUsed: 150,
            },
          },
        },
      ],
    };
  }

  private inferAIType(params: AINodeParams, context: any): string {
    // Check explicit aiType parameter
    if ((params as any).aiType) {
      return (params as any).aiType;
    }

    // Infer from context or parameters
    if ((params as any).employee && (params as any).company) {
      if (params.prompt.toLowerCase().includes('welcome')) {
        return 'welcome_message';
      }
      return 'role_specific_content';
    }

    if ((params as any).document) {
      return 'document_summary';
    }

    if ((params as any).text && params.outputFormat === 'json') {
      return 'sentiment_analysis';
    }

    return 'custom';
  }

  private async executeWelcomeMessage(input: NodeInput, params: AINodeParams): Promise<any> {
    const employee = (params as any).employee as EmployeeProfile;
    const company = (params as any).company as CompanyProfile;
    const options = (params as any).options || {};

    if (!employee || !company) {
      throw new Error('Employee and company information required for welcome message generation');
    }

    return this.contentGenerator.generateWelcomeMessage(
      input.organizationId,
      employee,
      company,
      options,
      { workflowId: input.context.correlationId, runId: input.runId }
    );
  }

  private async executeRoleSpecificContent(input: NodeInput, params: AINodeParams): Promise<any> {
    const employee = (params as any).employee as EmployeeProfile;
    const company = (params as any).company as CompanyProfile;
    const options = (params as any).options || {};

    if (!employee || !company) {
      throw new Error(
        'Employee and company information required for role-specific content generation'
      );
    }

    return this.contentGenerator.generateRoleSpecificContent(
      input.organizationId,
      employee,
      company,
      options,
      { workflowId: input.context.correlationId, runId: input.runId }
    );
  }

  private async executeDocumentSummary(input: NodeInput, params: AINodeParams): Promise<any> {
    const document = (params as any).document;
    const options = (params as any).options || {};

    if (!document || !document.content) {
      throw new Error('Document with content required for summarization');
    }

    return this.contentGenerator.summarizeDocument(input.organizationId, document, options, {
      workflowId: input.context.correlationId,
      runId: input.runId,
    });
  }

  private async executeSentimentAnalysis(input: NodeInput, params: AINodeParams): Promise<any> {
    const text = (params as any).text;
    const options = (params as any).options || {};

    if (!text) {
      throw new Error('Text content required for sentiment analysis');
    }

    return this.contentGenerator.analyzeSentiment(input.organizationId, text, options, {
      workflowId: input.context.correlationId,
      runId: input.runId,
    });
  }

  private async executeCustomPrompt(input: NodeInput, params: AINodeParams): Promise<any> {
    const templateData = params.templateData || {};
    const options = {
      model: params.model,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      outputFormat: params.outputFormat,
    };

    return this.contentGenerator.generateCustomContent(
      input.organizationId,
      params.prompt,
      templateData,
      options,
      { workflowId: input.context.correlationId, runId: input.runId }
    );
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Rate limiting errors are retryable
      if (message.includes('rate limit') || message.includes('too many requests')) {
        return true;
      }

      // Temporary service errors are retryable
      if (message.includes('service unavailable') || message.includes('timeout')) {
        return true;
      }

      // Network errors are retryable
      if (message.includes('network') || message.includes('connection')) {
        return true;
      }
    }

    // Authentication, validation, and other errors are not retryable
    return false;
  }
}
