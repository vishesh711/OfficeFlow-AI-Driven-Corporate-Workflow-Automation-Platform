export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: TemplateVariable[];
  category: 'onboarding' | 'offboarding' | 'communication' | 'document' | 'general';
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: any[];
    min?: number;
    max?: number;
  };
}

export interface LLMRequest {
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  outputFormat?: 'text' | 'json' | 'markdown';
  systemMessage?: string;
}

export interface LLMResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'function_call';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  requestId: string;
  processingTimeMs: number;
}

export interface CostMetrics {
  requestId: string;
  organizationId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: Date;
  nodeType: string;
  workflowId?: string;
  runId?: string;
}

export interface RateLimitState {
  requestCount: number;
  tokenCount: number;
  windowStart: Date;
  isLimited: boolean;
}

export interface ContentGenerationRequest {
  type: 'welcome_message' | 'role_specific_content' | 'document_summary' | 'sentiment_analysis';
  templateId?: string;
  customPrompt?: string;
  data: Record<string, any>;
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    outputFormat?: 'text' | 'json' | 'markdown';
  };
}

export interface ContentGenerationResult {
  content: string;
  metadata: {
    templateUsed?: string;
    model: string;
    tokensUsed: number;
    processingTimeMs: number;
    confidence?: number;
  };
  cost: {
    estimatedCost: number;
    tokenBreakdown: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
}