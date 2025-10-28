/**
 * Mock OpenAI client for compilation purposes
 * This is a workaround for workspace dependency issues
 */

export interface ChatCompletionMessageParam {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface Model {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ModelsResponse {
  object: string;
  data: Model[];
}

export class MockOpenAI {
  constructor(config: {
    apiKey: string;
    baseURL?: string;
    organization?: string;
    project?: string;
    timeout?: number;
    maxRetries?: number;
  }) {
    // Mock constructor - in real implementation this would initialize the OpenAI client
  }

  chat = {
    completions: {
      create: async (params: {
        model: string;
        messages: ChatCompletionMessageParam[];
        max_tokens?: number;
        temperature?: number;
        top_p?: number;
        frequency_penalty?: number;
        presence_penalty?: number;
        stop?: string[];
      }): Promise<ChatCompletion> => {
        // Mock implementation - in real implementation this would call OpenAI API
        return {
          id: 'chatcmpl-mock',
          object: 'chat.completion',
          created: Date.now(),
          model: params.model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content:
                  'This is a mock response. In production, this would be replaced with actual OpenAI integration.',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 50,
            completion_tokens: 20,
            total_tokens: 70,
          },
        };
      },
    },
  };

  models = {
    list: async (): Promise<ModelsResponse> => {
      // Mock implementation - in real implementation this would call OpenAI API
      return {
        object: 'list',
        data: [
          {
            id: 'gpt-4',
            object: 'model',
            created: Date.now(),
            owned_by: 'openai',
          },
          {
            id: 'gpt-3.5-turbo',
            object: 'model',
            created: Date.now(),
            owned_by: 'openai',
          },
        ],
      };
    },
  };
}

export default MockOpenAI;
