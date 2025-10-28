/**
 * Mock Handlebars implementation
 * This is a workaround for workspace dependency issues
 */

export interface HandlebarsTemplateDelegate {
  (context: any): string;
}

export class MockHandlebars {
  private static helpers: Map<string, Function> = new Map();

  static compile(template: string): HandlebarsTemplateDelegate {
    return (context: any) => {
      // Simple template replacement - in production this would use actual Handlebars
      let result = template;

      // Replace simple variables like {{variable}}
      result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const trimmedKey = key.trim();

        // Handle nested properties like {{object.property}}
        const value = this.getNestedProperty(context, trimmedKey);
        return value !== undefined ? String(value) : match;
      });

      // Handle basic conditionals like {{#if condition}}
      result = result.replace(
        /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (match, condition, content) => {
          const value = this.getNestedProperty(context, condition.trim());
          return value ? content : '';
        }
      );

      return result;
    };
  }

  static registerHelper(name: string, fn: Function): void {
    this.helpers.set(name, fn);
  }

  private static getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

export default MockHandlebars;
