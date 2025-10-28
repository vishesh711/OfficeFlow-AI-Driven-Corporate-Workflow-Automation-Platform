import Handlebars from 'handlebars';
import { EmailTemplate } from '../types/email-types';

export class TemplateEngine {
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private templateCache: Map<string, EmailTemplate> = new Map();
  private cacheTtl: number;

  constructor(cacheTtl: number = 3600000) {
    this.cacheTtl = cacheTtl;
    this.registerHelpers();
  }

  private registerHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', (date: Date, format: string) => {
      if (!date) return '';

      const options: Intl.DateTimeFormatOptions = {};
      switch (format) {
        case 'short':
          options.dateStyle = 'short';
          break;
        case 'medium':
          options.dateStyle = 'medium';
          break;
        case 'long':
          options.dateStyle = 'long';
          break;
        case 'full':
          options.dateStyle = 'full';
          break;
        default:
          options.dateStyle = 'medium';
      }

      return new Intl.DateTimeFormat('en-US', options).format(new Date(date));
    });

    // Conditional helper
    Handlebars.registerHelper('if_eq', function (a: any, b: any, options: any) {
      if (a === b) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    // Uppercase helper
    Handlebars.registerHelper('uppercase', (str: string) => {
      return str ? str.toUpperCase() : '';
    });

    // Lowercase helper
    Handlebars.registerHelper('lowercase', (str: string) => {
      return str ? str.toLowerCase() : '';
    });

    // Capitalize helper
    Handlebars.registerHelper('capitalize', (str: string) => {
      return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
    });

    // Join array helper
    Handlebars.registerHelper('join', (array: any[], separator: string = ', ') => {
      return Array.isArray(array) ? array.join(separator) : '';
    });
  }

  public compileTemplate(template: EmailTemplate): void {
    // Compile HTML template
    const htmlTemplate = Handlebars.compile(template.htmlContent);
    this.compiledTemplates.set(`${template.templateId}_html`, htmlTemplate);

    // Compile text template if available
    if (template.textContent) {
      const textTemplate = Handlebars.compile(template.textContent);
      this.compiledTemplates.set(`${template.templateId}_text`, textTemplate);
    }

    // Compile subject template
    const subjectTemplate = Handlebars.compile(template.subject);
    this.compiledTemplates.set(`${template.templateId}_subject`, subjectTemplate);

    // Cache the template
    this.templateCache.set(template.templateId, template);
  }

  public renderTemplate(
    templateId: string,
    variables: Record<string, any> = {}
  ): { subject: string; html: string; text?: string } {
    const template = this.templateCache.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Get compiled templates
    const htmlTemplate = this.compiledTemplates.get(`${templateId}_html`);
    const textTemplate = this.compiledTemplates.get(`${templateId}_text`);
    const subjectTemplate = this.compiledTemplates.get(`${templateId}_subject`);

    if (!htmlTemplate || !subjectTemplate) {
      throw new Error(`Compiled templates not found for ${templateId}`);
    }

    // Add default variables
    const context = {
      ...variables,
      currentYear: new Date().getFullYear(),
      currentDate: new Date(),
    };

    return {
      subject: subjectTemplate(context),
      html: htmlTemplate(context),
      text: textTemplate ? textTemplate(context) : undefined,
    };
  }

  public validateTemplate(htmlContent: string, textContent?: string, subject?: string): string[] {
    const errors: string[] = [];

    try {
      Handlebars.compile(htmlContent);
    } catch (error) {
      errors.push(`HTML template compilation error: ${error.message}`);
    }

    if (textContent) {
      try {
        Handlebars.compile(textContent);
      } catch (error) {
        errors.push(`Text template compilation error: ${error.message}`);
      }
    }

    if (subject) {
      try {
        Handlebars.compile(subject);
      } catch (error) {
        errors.push(`Subject template compilation error: ${error.message}`);
      }
    }

    return errors;
  }

  public extractVariables(content: string): string[] {
    const variables = new Set<string>();
    const ast = Handlebars.parse(content);

    const extractFromNode = (node: any) => {
      if (node.type === 'MustacheStatement' || node.type === 'BlockStatement') {
        if (node.path && node.path.original) {
          variables.add(node.path.original);
        }
      }

      if (node.program) {
        node.program.body.forEach(extractFromNode);
      }

      if (node.inverse) {
        node.inverse.body.forEach(extractFromNode);
      }
    };

    ast.body.forEach(extractFromNode);

    return Array.from(variables).filter(
      (v) =>
        !['currentYear', 'currentDate'].includes(v) &&
        !v.startsWith('if_') &&
        !['uppercase', 'lowercase', 'capitalize', 'formatDate', 'join'].includes(v)
    );
  }

  public clearCache(): void {
    this.compiledTemplates.clear();
    this.templateCache.clear();
  }
}
