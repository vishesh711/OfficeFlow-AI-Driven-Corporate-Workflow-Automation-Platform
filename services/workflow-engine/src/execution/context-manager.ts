/**
 * Execution context management for workflow runs
 */

import { UUID, ExecutionContext } from '@officeflow/types';
import { RedisStateManager } from '../state/redis-state-manager';

export interface ContextVariable {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  source: 'input' | 'node_output' | 'system' | 'secret';
  nodeId?: UUID;
}

export interface ParameterMapping {
  sourceType: 'context' | 'node_output' | 'static' | 'expression';
  sourcePath: string;
  targetPath: string;
  defaultValue?: any;
  required?: boolean;
}

export class ExecutionContextManager {
  constructor(private stateManager: RedisStateManager) {}

  /**
   * Create initial execution context for a workflow run
   */
  createInitialContext(
    organizationId: UUID,
    employeeId: UUID,
    triggerEvent: any,
    workflowVariables?: Record<string, any>
  ): ExecutionContext {
    return {
      organizationId,
      employeeId,
      triggerEvent,
      variables: {
        // System variables
        'system.timestamp': new Date().toISOString(),
        'system.organizationId': organizationId,
        'system.employeeId': employeeId,
        'system.triggerEvent': triggerEvent,

        // Workflow-specific variables
        ...workflowVariables,

        // Event data variables
        'event.type': triggerEvent.type,
        'event.payload': triggerEvent.payload,
        'event.timestamp': triggerEvent.timestamp,
      },
      secrets: {},
      correlationId: triggerEvent.correlationId || this.generateCorrelationId(),
    };
  }

  /**
   * Update context with node output
   */
  updateContextWithNodeOutput(
    context: ExecutionContext,
    nodeId: UUID,
    nodeName: string,
    output: Record<string, any>
  ): ExecutionContext {
    const updatedVariables = {
      ...context.variables,
    };

    // Store node output with both ID and name references
    updatedVariables[`nodes.${nodeId}.output`] = output;
    updatedVariables[`nodes.${nodeName}.output`] = output;

    // Flatten output for easier access
    Object.entries(output).forEach(([key, value]) => {
      updatedVariables[`nodes.${nodeId}.${key}`] = value;
      updatedVariables[`nodes.${nodeName}.${key}`] = value;
    });

    return {
      ...context,
      variables: updatedVariables,
    };
  }

  /**
   * Resolve parameter mappings for node input
   */
  resolveNodeInput(
    context: ExecutionContext,
    parameterMappings: ParameterMapping[],
    nodeOutputs: Map<UUID, Record<string, any>>
  ): Record<string, any> {
    const resolvedInput: Record<string, any> = {};

    parameterMappings.forEach((mapping) => {
      try {
        const value = this.resolveParameterValue(mapping, context, nodeOutputs);
        this.setNestedValue(resolvedInput, mapping.targetPath, value);
      } catch (error) {
        if (mapping.required) {
          throw new Error(`Failed to resolve required parameter '${mapping.targetPath}': ${error}`);
        }

        if (mapping.defaultValue !== undefined) {
          this.setNestedValue(resolvedInput, mapping.targetPath, mapping.defaultValue);
        }
      }
    });

    return resolvedInput;
  }

  /**
   * Resolve a single parameter value
   */
  private resolveParameterValue(
    mapping: ParameterMapping,
    context: ExecutionContext,
    nodeOutputs: Map<UUID, Record<string, any>>
  ): any {
    switch (mapping.sourceType) {
      case 'static':
        return this.parseStaticValue(mapping.sourcePath);

      case 'context':
        return this.getNestedValue(context.variables, mapping.sourcePath);

      case 'node_output':
        return this.resolveNodeOutputValue(mapping.sourcePath, nodeOutputs);

      case 'expression':
        return this.evaluateExpression(mapping.sourcePath, context, nodeOutputs);

      default:
        throw new Error(`Unknown parameter source type: ${mapping.sourceType}`);
    }
  }

  /**
   * Parse static value with type inference
   */
  private parseStaticValue(value: string): any {
    // Try to parse as JSON first
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if not valid JSON
      return value;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) {
        throw new Error(`Cannot access property '${key}' of ${current}`);
      }
      return current[key];
    }, obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: Record<string, any>, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;

    const target = keys.reduce((current, key) => {
      if (!(key in current)) {
        current[key] = {};
      }
      return current[key];
    }, obj);

    target[lastKey] = value;
  }

  /**
   * Resolve node output value
   */
  private resolveNodeOutputValue(
    sourcePath: string,
    nodeOutputs: Map<UUID, Record<string, any>>
  ): any {
    // Format: nodeId.outputKey or nodeName.outputKey
    const [nodeRef, ...pathParts] = sourcePath.split('.');
    const outputPath = pathParts.join('.');

    // Try to find by node ID first
    const output = nodeOutputs.get(nodeRef);
    if (!output) {
      throw new Error(`Node output not found for: ${nodeRef}`);
    }

    if (!outputPath) {
      return output;
    }

    return this.getNestedValue(output, outputPath);
  }

  /**
   * Evaluate simple expressions (basic implementation)
   */
  private evaluateExpression(
    expression: string,
    context: ExecutionContext,
    nodeOutputs: Map<UUID, Record<string, any>>
  ): any {
    // This is a simplified expression evaluator
    // In production, you'd want a more robust solution like JSONata or similar

    // Replace context variables
    let processedExpression = expression.replace(/\$\{([^}]+)\}/g, (match, varPath) => {
      try {
        const value = this.getNestedValue(context.variables, varPath);
        return JSON.stringify(value);
      } catch {
        return match; // Keep original if not found
      }
    });

    // Replace node outputs
    processedExpression = processedExpression.replace(
      /\$nodes\.([^.]+)\.([^}\s]+)/g,
      (match, nodeRef, outputPath) => {
        try {
          const output = nodeOutputs.get(nodeRef);
          if (output) {
            const value = this.getNestedValue(output, outputPath);
            return JSON.stringify(value);
          }
        } catch {
          // Ignore errors
        }
        return match;
      }
    );

    // Try to evaluate as JSON
    try {
      return JSON.parse(processedExpression);
    } catch {
      return processedExpression;
    }
  }

  /**
   * Add secrets to context
   */
  addSecretsToContext(
    context: ExecutionContext,
    secrets: Record<string, string>
  ): ExecutionContext {
    return {
      ...context,
      secrets: {
        ...context.secrets,
        ...secrets,
      },
    };
  }

  /**
   * Create child context for sub-workflows
   */
  createChildContext(
    parentContext: ExecutionContext,
    additionalVariables?: Record<string, any>
  ): ExecutionContext {
    return {
      ...parentContext,
      variables: {
        ...parentContext.variables,
        ...additionalVariables,
      },
      parentContext,
      correlationId: this.generateCorrelationId(),
    };
  }

  /**
   * Serialize context for storage
   */
  serializeContext(context: ExecutionContext): string {
    return JSON.stringify({
      ...context,
      // Don't serialize secrets for security
      secrets: Object.keys(context.secrets).reduce(
        (acc, key) => {
          acc[key] = '[REDACTED]';
          return acc;
        },
        {} as Record<string, string>
      ),
    });
  }

  /**
   * Deserialize context from storage
   */
  deserializeContext(serialized: string): ExecutionContext {
    const parsed = JSON.parse(serialized);
    return {
      ...parsed,
      secrets: {}, // Secrets need to be loaded separately
    };
  }

  private generateCorrelationId(): UUID {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
