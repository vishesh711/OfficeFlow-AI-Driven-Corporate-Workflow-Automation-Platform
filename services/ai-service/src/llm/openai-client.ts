import MockOpenAI, { ChatCompletionMessageParam } from '../utils/mock-openai';
import { v4 as uuidv4 } from '../utils/uuid';
import { LLMRequest, LLMResponse } from '../types/ai-types';
import { OpenAIConfig } from '../config/ai-config';
import { ErrorDetails } from '@officeflow/types';
import { Logger } from '../utils/logger';

export class OpenAIClient {
  private client: MockOpenAI;
  private config: OpenAIConfig;
  private logger: Logger;

  constructor(config: OpenAIConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    this.client = new MockOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      organization: config.organization,
      project: config.project,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      this.logger.info('Generating OpenAI completion', {
        requestId,
        model: request.model,
        promptLength: request.prompt.length,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });

      const messages: ChatCompletionMessageParam[] = [];
      
      if (request.systemMessage) {
        messages.push({
          role: 'system',
          content: request.systemMessage,
        });
      }

      messages.push({
        role: 'user',
        content: request.prompt,
      });

      const completion = await this.client.chat.completions.create({
        model: request.model || this.config.defaultModel,
        messages,
        max_tokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature ?? this.config.temperature,
        top_p: request.topP,
        frequency_penalty: request.frequencyPenalty,
        presence_penalty: request.presencePenalty,
        stop: request.stop,
      });

      const processingTimeMs = Date.now() - startTime;
      const choice = completion.choices[0];
      
      if (!choice || !choice.message.content) {
        throw new Error('No completion generated');
      }

      let content = choice.message.content;

      // Handle output format conversion
      if (request.outputFormat === 'json') {
        try {
          // Validate that the content is valid JSON
          JSON.parse(content);
        } catch (error) {
          this.logger.warn('Generated content is not valid JSON, attempting to extract', {
            requestId,
            content: content.substring(0, 200),
          });
          
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            content = jsonMatch[0];
            JSON.parse(content); // Validate extracted JSON
          } else {
            throw new Error('Unable to extract valid JSON from response');
          }
        }
      }

      const response: LLMResponse = {
        content,
        finishReason: choice.finish_reason as any,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
        model: completion.model,
        requestId,
        processingTimeMs,
      };

      this.logger.info('OpenAI completion generated successfully', {
        requestId,
        model: response.model,
        finishReason: response.finishReason,
        tokensUsed: response.usage.totalTokens,
        processingTimeMs,
      });

      return response;

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      
      this.logger.error('OpenAI completion failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs,
        model: request.model,
      });

      // Transform OpenAI errors into our error format
      const errorDetails: ErrorDetails = {
        code: this.getErrorCode(error),
        message: error instanceof Error ? error.message : 'Unknown OpenAI error',
        timestamp: new Date(),
        details: {
          requestId,
          model: request.model,
          processingTimeMs,
          originalError: error,
        },
      };

      throw new Error(`OpenAI completion failed: ${errorDetails.message}`);
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      // Test connection with a minimal request
      await this.client.models.list();
      return true;
    } catch (error) {
      this.logger.error('OpenAI connection validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  async listAvailableModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data
        .filter((model: any) => model.id.includes('gpt'))
        .map((model: any) => model.id)
        .sort();
    } catch (error) {
      this.logger.error('Failed to list OpenAI models', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [this.config.defaultModel];
    }
  }

  private getErrorCode(error: any): string {
    if (error?.status) {
      switch (error.status) {
        case 400:
          return 'INVALID_REQUEST';
        case 401:
          return 'UNAUTHORIZED';
        case 403:
          return 'FORBIDDEN';
        case 404:
          return 'NOT_FOUND';
        case 429:
          return 'RATE_LIMITED';
        case 500:
          return 'INTERNAL_ERROR';
        case 503:
          return 'SERVICE_UNAVAILABLE';
        default:
          return 'UNKNOWN_ERROR';
      }
    }

    if (error?.code) {
      return error.code;
    }

    return 'UNKNOWN_ERROR';
  }
}