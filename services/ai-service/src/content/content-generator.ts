import { LLMService } from '../llm/llm-service';
import { ContentGenerationRequest, ContentGenerationResult } from '../types/ai-types';
import { Logger } from '../utils/logger';

export interface EmployeeProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department: string;
  level?: string;
  startDate: Date;
  manager?: string;
  location?: string;
  teamSize?: number;
  skills?: string[];
  previousExperience?: string;
  interests?: string[];
}

export interface CompanyProfile {
  name: string;
  industry: string;
  size: string;
  culture?: string;
  values?: string[];
  technologies?: string[];
  benefits?: string[];
  mission?: string;
  vision?: string;
}

export interface WelcomeMessageOptions {
  includeTeamIntroduction?: boolean;
  includeFirstDaySchedule?: boolean;
  includeCompanyCulture?: boolean;
  tone?: 'formal' | 'casual' | 'friendly';
  length?: 'short' | 'medium' | 'long';
}

export interface RoleContentOptions {
  includeCareerPath?: boolean;
  includeTrainingResources?: boolean;
  includeSuccessMetrics?: boolean;
  focusAreas?: string[];
  format?: 'markdown' | 'html' | 'text';
}

export interface DocumentSummaryOptions {
  summaryType?: 'executive' | 'detailed' | 'bullet_points';
  targetAudience?: 'executives' | 'managers' | 'employees' | 'general';
  maxLength?: number;
  includeActionItems?: boolean;
}

export interface SentimentAnalysisOptions {
  includeEmotions?: boolean;
  includeRecommendations?: boolean;
  contextType?: 'feedback' | 'survey' | 'communication' | 'review';
}

export class ContentGenerator {
  private llmService: LLMService;
  private logger: Logger;

  constructor(llmService: LLMService, logger: Logger) {
    this.llmService = llmService;
    this.logger = logger;
  }

  async generateWelcomeMessage(
    organizationId: string,
    employee: EmployeeProfile,
    company: CompanyProfile,
    options: WelcomeMessageOptions = {},
    context?: { workflowId?: string; runId?: string }
  ): Promise<ContentGenerationResult> {
    this.logger.info('Generating welcome message', {
      organizationId,
      employeeId: employee.id,
      role: employee.role,
      department: employee.department,
    });

    const templateData = {
      employee: {
        ...employee,
        startDate: employee.startDate.toISOString(),
      },
      company,
      options: {
        includeTeamIntroduction: options.includeTeamIntroduction ?? true,
        includeFirstDaySchedule: options.includeFirstDaySchedule ?? true,
        includeCompanyCulture: options.includeCompanyCulture ?? true,
        tone: options.tone || 'friendly',
        length: options.length || 'medium',
      },
    };

    const request: ContentGenerationRequest = {
      type: 'welcome_message',
      templateId: 'welcome_message',
      data: templateData,
      options: {
        temperature: 0.7,
        maxTokens: this.getMaxTokensForLength(options.length),
      },
    };

    return this.llmService.generateContent(organizationId, request, {
      ...context,
      nodeType: 'welcome_message',
    });
  }

  async generateRoleSpecificContent(
    organizationId: string,
    employee: EmployeeProfile,
    company: CompanyProfile,
    options: RoleContentOptions = {},
    context?: { workflowId?: string; runId?: string }
  ): Promise<ContentGenerationResult> {
    this.logger.info('Generating role-specific content', {
      organizationId,
      employeeId: employee.id,
      role: employee.role,
      department: employee.department,
    });

    const templateData = {
      employee: {
        ...employee,
        startDate: employee.startDate.toISOString(),
      },
      company,
      options: {
        includeCareerPath: options.includeCareerPath ?? true,
        includeTrainingResources: options.includeTrainingResources ?? true,
        includeSuccessMetrics: options.includeSuccessMetrics ?? true,
        focusAreas: options.focusAreas || [],
        format: options.format || 'markdown',
      },
    };

    const request: ContentGenerationRequest = {
      type: 'role_specific_content',
      templateId: 'role_specific_content',
      data: templateData,
      options: {
        temperature: 0.5,
        maxTokens: 3000,
        outputFormat: options.format === 'markdown' ? 'markdown' : 'text',
      },
    };

    return this.llmService.generateContent(organizationId, request, {
      ...context,
      nodeType: 'role_specific_content',
    });
  }

  async summarizeDocument(
    organizationId: string,
    document: {
      title: string;
      content: string;
      type?: string;
      author?: string;
      date?: Date;
    },
    options: DocumentSummaryOptions = {},
    context?: { workflowId?: string; runId?: string }
  ): Promise<ContentGenerationResult> {
    this.logger.info('Summarizing document', {
      organizationId,
      documentTitle: document.title,
      contentLength: document.content.length,
      summaryType: options.summaryType,
    });

    // Truncate content if too long (keep within token limits)
    const maxContentLength = 8000; // Rough estimate for token limits
    const truncatedContent =
      document.content.length > maxContentLength
        ? document.content.substring(0, maxContentLength) + '...[truncated]'
        : document.content;

    const templateData = {
      document: {
        ...document,
        content: truncatedContent,
        date: document.date?.toISOString(),
      },
      summaryLength: options.maxLength || 200,
      summaryType: options.summaryType || 'executive',
      targetAudience: options.targetAudience || 'general',
      includeActionItems: options.includeActionItems ?? true,
    };

    const request: ContentGenerationRequest = {
      type: 'document_summary',
      templateId: 'document_summary',
      data: templateData,
      options: {
        temperature: 0.3,
        maxTokens: Math.min(1500, (options.maxLength || 200) * 3),
      },
    };

    return this.llmService.generateContent(organizationId, request, {
      ...context,
      nodeType: 'document_summary',
    });
  }

  async analyzeSentiment(
    organizationId: string,
    text: string,
    options: SentimentAnalysisOptions = {},
    context?: { workflowId?: string; runId?: string }
  ): Promise<ContentGenerationResult> {
    this.logger.info('Analyzing sentiment', {
      organizationId,
      textLength: text.length,
      contextType: options.contextType,
    });

    const templateData = {
      text,
      context: options.contextType,
      includeEmotions: options.includeEmotions ?? true,
      includeRecommendations: options.includeRecommendations ?? true,
    };

    const request: ContentGenerationRequest = {
      type: 'sentiment_analysis',
      templateId: 'sentiment_analysis',
      data: templateData,
      options: {
        temperature: 0.2,
        maxTokens: 800,
        outputFormat: 'json',
      },
    };

    const result = await this.llmService.generateContent(organizationId, request, {
      ...context,
      nodeType: 'sentiment_analysis',
    });

    // Validate JSON response
    try {
      const parsed = JSON.parse(result.content);

      // Add confidence score to metadata
      if (parsed.confidence !== undefined) {
        result.metadata.confidence = parsed.confidence;
      }

      return result;
    } catch (error) {
      this.logger.warn('Sentiment analysis returned invalid JSON', {
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        content: result.content.substring(0, 200),
      });

      // Return a structured error response
      result.content = JSON.stringify({
        sentiment: 'neutral',
        confidence: 0.0,
        tone: ['unclear'],
        emotions: [],
        key_phrases: [],
        summary: 'Unable to analyze sentiment due to parsing error',
        recommendations: ['Please review the input text and try again'],
        error: 'Failed to parse sentiment analysis response',
      });

      return result;
    }
  }

  async generateCustomContent(
    organizationId: string,
    prompt: string,
    data: Record<string, any> = {},
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      outputFormat?: 'text' | 'json' | 'markdown';
      systemMessage?: string;
    } = {},
    context?: { workflowId?: string; runId?: string }
  ): Promise<ContentGenerationResult> {
    this.logger.info('Generating custom content', {
      organizationId,
      promptLength: prompt.length,
      dataKeys: Object.keys(data),
      model: options.model,
    });

    // Simple template substitution for custom prompts
    let processedPrompt = prompt;
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      processedPrompt = processedPrompt.replace(placeholder, String(value));
    }

    const request: ContentGenerationRequest = {
      type: 'welcome_message', // Use as default type
      customPrompt: processedPrompt,
      data,
      options: {
        model: options.model,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens || 2000,
        outputFormat: options.outputFormat || 'text',
      },
    };

    return this.llmService.generateContent(organizationId, request, {
      ...context,
      nodeType: 'custom_content',
    });
  }

  async generateBulkContent(
    organizationId: string,
    requests: Array<{
      type: 'welcome_message' | 'role_specific_content' | 'document_summary' | 'sentiment_analysis';
      data: any;
      options?: any;
      id?: string;
    }>,
    context?: { workflowId?: string; runId?: string }
  ): Promise<Array<{ id?: string; result?: ContentGenerationResult; error?: string }>> {
    this.logger.info('Generating bulk content', {
      organizationId,
      requestCount: requests.length,
    });

    const results = await Promise.allSettled(
      requests.map(async (req, index) => {
        const id = req.id || `bulk_${index}`;

        try {
          let result: ContentGenerationResult;

          switch (req.type) {
            case 'welcome_message':
              result = await this.generateWelcomeMessage(
                organizationId,
                req.data.employee,
                req.data.company,
                req.options,
                context
              );
              break;

            case 'role_specific_content':
              result = await this.generateRoleSpecificContent(
                organizationId,
                req.data.employee,
                req.data.company,
                req.options,
                context
              );
              break;

            case 'document_summary':
              result = await this.summarizeDocument(
                organizationId,
                req.data.document,
                req.options,
                context
              );
              break;

            case 'sentiment_analysis':
              result = await this.analyzeSentiment(
                organizationId,
                req.data.text,
                req.options,
                context
              );
              break;

            default:
              throw new Error(`Unsupported bulk content type: ${req.type}`);
          }

          return { id, result };
        } catch (error) {
          return {
            id,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          id: requests[index].id || `bulk_${index}`,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        };
      }
    });
  }

  private getMaxTokensForLength(length?: 'short' | 'medium' | 'long'): number {
    switch (length) {
      case 'short':
        return 500;
      case 'medium':
        return 1000;
      case 'long':
        return 2000;
      default:
        return 1000;
    }
  }
}
