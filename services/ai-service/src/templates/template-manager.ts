import MockHandlebars, { HandlebarsTemplateDelegate } from '../utils/mock-handlebars';
import { PromptTemplate, TemplateVariable } from '../types/ai-types';
import { ValidationResult } from '@officeflow/types';
import { Logger } from '../utils/logger';

export class TemplateManager {
  private templates: Map<string, PromptTemplate> = new Map();
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeDefaultTemplates();
    this.registerHelpers();
  }

  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
    
    try {
      const compiled = MockHandlebars.compile(template.template);
      this.compiledTemplates.set(template.id, compiled);
      
      this.logger.info('Template registered successfully', {
        templateId: template.id,
        name: template.name,
        category: template.category,
      });
    } catch (error) {
      this.logger.error('Failed to compile template', {
        templateId: template.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to compile template ${template.id}: ${error}`);
    }
  }

  getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId);
  }

  listTemplates(category?: string): PromptTemplate[] {
    const templates = Array.from(this.templates.values());
    return category 
      ? templates.filter(t => t.category === category)
      : templates;
  }

  renderTemplate(templateId: string, data: Record<string, any>): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const compiled = this.compiledTemplates.get(templateId);
    if (!compiled) {
      throw new Error(`Compiled template not found: ${templateId}`);
    }

    // Validate required variables
    const validation = this.validateTemplateData(template, data);
    if (!validation.isValid) {
      throw new Error(`Template data validation failed: ${validation.errors.join(', ')}`);
    }

    try {
      const rendered = compiled(data);
      
      this.logger.debug('Template rendered successfully', {
        templateId,
        dataKeys: Object.keys(data),
        renderedLength: rendered.length,
      });

      return rendered;
    } catch (error) {
      this.logger.error('Template rendering failed', {
        templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
        dataKeys: Object.keys(data),
      });
      throw new Error(`Template rendering failed: ${error}`);
    }
  }

  validateTemplateData(template: PromptTemplate, data: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    for (const variable of template.variables) {
      const value = data[variable.name];

      // Check required variables
      if (variable.required && (value === undefined || value === null)) {
        errors.push(`Required variable '${variable.name}' is missing`);
        continue;
      }

      // Skip validation for optional missing variables
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!this.validateVariableType(value, variable.type)) {
        errors.push(`Variable '${variable.name}' has invalid type. Expected ${variable.type}, got ${typeof value}`);
      }

      // Additional validation rules
      if (variable.validation) {
        const validationErrors = this.validateVariableConstraints(variable.name, value, variable.validation);
        errors.push(...validationErrors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validateVariableType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return false;
    }
  }

  private validateVariableConstraints(
    name: string, 
    value: any, 
    validation: TemplateVariable['validation']
  ): string[] {
    const errors: string[] = [];

    if (!validation) return errors;

    if (typeof value === 'string') {
      if (validation.minLength && value.length < validation.minLength) {
        errors.push(`Variable '${name}' is too short. Minimum length: ${validation.minLength}`);
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        errors.push(`Variable '${name}' is too long. Maximum length: ${validation.maxLength}`);
      }
      if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
        errors.push(`Variable '${name}' does not match required pattern`);
      }
    }

    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        errors.push(`Variable '${name}' is too small. Minimum value: ${validation.min}`);
      }
      if (validation.max !== undefined && value > validation.max) {
        errors.push(`Variable '${name}' is too large. Maximum value: ${validation.max}`);
      }
    }

    if (validation.enum && !validation.enum.includes(value)) {
      errors.push(`Variable '${name}' must be one of: ${validation.enum.join(', ')}`);
    }

    return errors;
  }

  private registerHelpers(): void {
    // Register custom Handlebars helpers
    MockHandlebars.registerHelper('capitalize', (str: string) => {
      return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    });

    MockHandlebars.registerHelper('uppercase', (str: string) => {
      return str ? str.toUpperCase() : '';
    });

    MockHandlebars.registerHelper('lowercase', (str: string) => {
      return str ? str.toLowerCase() : '';
    });

    MockHandlebars.registerHelper('formatDate', (date: Date | string, format?: string) => {
      const d = new Date(date);
      if (format === 'short') {
        return d.toLocaleDateString();
      }
      return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    });

    MockHandlebars.registerHelper('join', (array: any[], separator: string = ', ') => {
      return Array.isArray(array) ? array.join(separator) : '';
    });

    MockHandlebars.registerHelper('ifEquals', function(this: any, arg1: any, arg2: any, options: any) {
      return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
    });
  }

  private initializeDefaultTemplates(): void {
    // Welcome message template
    const welcomeTemplate: PromptTemplate = {
      id: 'welcome_message',
      name: 'Employee Welcome Message',
      description: 'Personalized welcome message for new employees',
      template: `Create a warm and professional welcome message for {{employee.firstName}} {{employee.lastName}} who is joining as a {{employee.role}} in the {{employee.department}} department.

Employee Details:
- Name: {{employee.firstName}} {{employee.lastName}}
- Role: {{employee.role}}
- Department: {{employee.department}}
- Start Date: {{formatDate employee.startDate}}
- Manager: {{employee.manager}}
{{#if employee.location}}
- Location: {{employee.location}}
{{/if}}

Company Information:
- Company: {{company.name}}
{{#if company.culture}}
- Culture: {{company.culture}}
{{/if}}

Please include:
1. A warm welcome
2. Brief overview of their role and team
3. What to expect on their first day
4. Key contacts and resources
5. Expression of excitement about their contribution

Tone: Professional yet warm and welcoming
Length: 2-3 paragraphs`,
      variables: [
        {
          name: 'employee',
          type: 'object',
          description: 'Employee information object',
          required: true,
        },
        {
          name: 'company',
          type: 'object',
          description: 'Company information object',
          required: true,
        },
      ],
      category: 'onboarding',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Role-specific content template
    const roleContentTemplate: PromptTemplate = {
      id: 'role_specific_content',
      name: 'Role-Specific Onboarding Content',
      description: 'Generate role-specific onboarding materials and guidance',
      template: `Generate comprehensive onboarding content for a {{employee.role}} position in the {{employee.department}} department.

Role Information:
- Position: {{employee.role}}
- Department: {{employee.department}}
- Level: {{employee.level}}
- Reports to: {{employee.manager}}
{{#if employee.teamSize}}
- Team Size: {{employee.teamSize}}
{{/if}}

Company Context:
- Industry: {{company.industry}}
- Size: {{company.size}}
{{#if company.technologies}}
- Key Technologies: {{join company.technologies}}
{{/if}}

Please provide:
1. Role overview and key responsibilities
2. Department structure and team dynamics
3. Essential tools and systems they'll use
4. Key processes and workflows
5. Success metrics and expectations
6. Learning resources and training recommendations
7. Important stakeholders and relationships

Format: Well-structured markdown with clear sections
Tone: Professional and informative`,
      variables: [
        {
          name: 'employee',
          type: 'object',
          description: 'Employee role and department information',
          required: true,
        },
        {
          name: 'company',
          type: 'object',
          description: 'Company context information',
          required: true,
        },
      ],
      category: 'onboarding',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Document summary template
    const documentSummaryTemplate: PromptTemplate = {
      id: 'document_summary',
      name: 'Document Summarization',
      description: 'Create concise summaries of documents',
      template: `Please provide a comprehensive summary of the following document:

Document Title: {{document.title}}
{{#if document.type}}
Document Type: {{document.type}}
{{/if}}

Content:
{{document.content}}

Please provide:
1. Executive Summary (2-3 sentences)
2. Key Points (bullet format)
3. Action Items (if any)
4. Important Dates or Deadlines (if mentioned)
{{#if summaryLength}}
5. Target length: {{summaryLength}} words
{{/if}}

Format the response in clear, well-organized sections.`,
      variables: [
        {
          name: 'document',
          type: 'object',
          description: 'Document information and content',
          required: true,
        },
        {
          name: 'summaryLength',
          type: 'number',
          description: 'Target summary length in words',
          required: false,
          defaultValue: 200,
        },
      ],
      category: 'document',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Sentiment analysis template
    const sentimentAnalysisTemplate: PromptTemplate = {
      id: 'sentiment_analysis',
      name: 'Sentiment Analysis',
      description: 'Analyze sentiment and tone of text content',
      template: `Analyze the sentiment and tone of the following text:

Text to analyze:
"{{text}}"

{{#if context}}
Context: {{context}}
{{/if}}

Please provide a JSON response with the following structure:
{
  "sentiment": "positive|negative|neutral",
  "confidence": 0.0-1.0,
  "tone": ["professional", "casual", "urgent", "friendly", etc.],
  "emotions": ["joy", "anger", "sadness", "fear", "surprise", etc.],
  "key_phrases": ["phrase1", "phrase2"],
  "summary": "Brief explanation of the analysis",
  "recommendations": ["suggestion1", "suggestion2"]
}

Focus on accuracy and provide actionable insights.`,
      variables: [
        {
          name: 'text',
          type: 'string',
          description: 'Text content to analyze',
          required: true,
          validation: {
            minLength: 1,
            maxLength: 5000,
          },
        },
        {
          name: 'context',
          type: 'string',
          description: 'Additional context for the analysis',
          required: false,
        },
      ],
      category: 'communication',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Register all default templates
    [
      welcomeTemplate,
      roleContentTemplate,
      documentSummaryTemplate,
      sentimentAnalysisTemplate,
    ].forEach(template => this.registerTemplate(template));
  }
}