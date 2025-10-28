import { v4 as uuidv4 } from '../utils/uuid';
import { LLMRequest, LLMResponse } from '../types/ai-types';
import { AnthropicConfig } from '../config/ai-config';
import { Logger } from '../utils/logger';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicClient {
  private config: AnthropicConfig;
  private logger: Logger;
  private baseURL: string;

  constructor(config: AnthropicConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.baseURL = config.baseURL || 'https://api.anthropic.com';
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      this.logger.info('Generating Anthropic completion', {
        requestId,
        model: request.model,
        promptLength: request.prompt.length,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });

      const messages: AnthropicMessage[] = [
        {
          role: 'user',
          content: request.prompt,
        },
      ];

      const requestBody = {
        model: request.model || this.config.defaultModel,
        messages,
        max_tokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature ?? this.config.temperature,
        system: request.systemMessage,
        stop_sequences: request.stop,
      };

      const response = await fetch(`${this.baseURL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const completion: AnthropicResponse = await response.json();
      const processingTimeMs = Date.now() - startTime;

      if (!completion.content || completion.content.length === 0) {
        throw new Error('No completion generated');
      }

      let content = completion.content[0].text;

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

      const llmResponse: LLMResponse = {
        content,
        finishReason: completion.stop_reason as any,
        usage: {
          promptTokens: completion.usage.input_tokens,
          completionTokens: completion.usage.output_tokens,
          totalTokens: completion.usage.input_tokens + completion.usage.output_tokens,
        },
        model: completion.model,
        processingTimeMs,
        metadata: {
          requestId,
          provider: 'anthropic',
          modelVersion: completion.model,
        },
      };

      this.logger.info('Anthropic completion generated successfully', {
        requestId,
        model: completion.model,
        promptTokens: completion.usage.input_tokens,
        completionTokens: completion.usage.output_tokens,
        processingTimeMs,
        finishReason: completion.stop_reason,
      });

      return llmResponse;
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error('Anthropic completion failed', {
        requestId,
        error: errorMessage,
        processingTimeMs,
        model: request.model || this.config.defaultModel,
      });

      throw new Error(`Anthropic API error: ${errorMessage}`);
    }
  }

  async streamCompletion(request: LLMRequest): Promise<AsyncIterable<string>> {
    const requestId = uuidv4();

    this.logger.info('Starting Anthropic streaming completion', {
      requestId,
      model: request.model,
    });

    const messages: AnthropicMessage[] = [
      {
        role: 'user',
        content: request.prompt,
      },
    ];

    const requestBody = {
      model: request.model || this.config.defaultModel,
      messages,
      max_tokens: request.maxTokens || this.config.maxTokens,
      temperature: request.temperature ?? this.config.temperature,
      system: request.systemMessage,
      stream: true,
    };

    const response = await fetch(`${this.baseURL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    return this.parseStreamResponse(response, requestId);
  }

  private async *parseStreamResponse(response: Response, requestId: string): AsyncIterable<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield parsed.delta.text;
              }
            } catch (error) {
              this.logger.warn('Failed to parse stream chunk', {
                requestId,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
