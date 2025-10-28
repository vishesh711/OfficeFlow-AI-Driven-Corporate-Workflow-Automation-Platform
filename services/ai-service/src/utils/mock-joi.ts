/**
 * Mock Joi implementation
 * This is a workaround for workspace dependency issues
 */

export interface ValidationError {
  details: Array<{
    message: string;
    path: string[];
    type: string;
  }>;
}

export interface ValidationResult {
  error?: ValidationError;
  value: any;
}

export interface Schema {
  validate(value: any, options?: any): ValidationResult;
  optional(): Schema;
  required(): Schema;
  default(value: any): Schema;
}

interface StringSchema extends Schema {
  valid(...values: string[]): StringSchema;
  required(): StringSchema;
  optional(): StringSchema;
  default(value: string): StringSchema;
}

interface NumberSchema extends Schema {
  integer(): NumberSchema;
  min(value: number): NumberSchema;
  max(value: number): NumberSchema;
  optional(): NumberSchema;
  required(): NumberSchema;
  default(value: any): NumberSchema;
}

interface ObjectSchema extends Schema {
  optional(): ObjectSchema;
  required(): ObjectSchema;
}

export class MockJoi {
  static object(schema?: any): ObjectSchema {
    const createObjectSchema = (): ObjectSchema => ({
      validate: (value: any, options?: any) => {
        // Simple validation - in production this would use actual Joi
        return { error: undefined, value };
      },
      optional: () => createObjectSchema(),
      required: () => createObjectSchema(),
      default: (value: any) => createObjectSchema(),
    });
    return createObjectSchema();
  }

  static string(): StringSchema {
    const createStringSchema = (): StringSchema => ({
      validate: (value: any) => ({ error: undefined, value }),
      required: () => createStringSchema(),
      optional: () => createStringSchema(),
      valid: (...values: string[]) => createStringSchema(),
      default: (defaultValue: string) => createStringSchema(),
    });
    return createStringSchema();
  }

  static number(): NumberSchema {
    const createNumberSchema = (): NumberSchema => ({
      validate: (value: any) => ({ error: undefined, value }),
      integer: () => createNumberSchema(),
      min: (min: number) => createNumberSchema(),
      max: (max: number) => createNumberSchema(),
      optional: () => createNumberSchema(),
      required: () => createNumberSchema(),
      default: (value: any) => createNumberSchema(),
    });
    return createNumberSchema();
  }
}

export default MockJoi;
