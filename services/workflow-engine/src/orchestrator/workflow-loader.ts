/**
 * Workflow loading and version management service
 */

import { 
  WorkflowDefinition, 
  WorkflowRepository, 
  WorkflowEntity,
  UUID 
} from '@officeflow/types';
import { WorkflowParser, ParsedWorkflow } from './workflow-parser';
import { mapWorkflowEntityToDefinition } from '../utils/entity-mappers';

export interface WorkflowLoadOptions {
  includeInactive?: boolean;
  version?: number;
  validateOnly?: boolean;
}

export interface WorkflowVersionInfo {
  workflowId: UUID;
  versions: Array<{
    version: number;
    isActive: boolean;
    createdAt: Date;
    createdBy?: UUID;
  }>;
  activeVersion?: number;
  latestVersion: number;
}

export class WorkflowLoader {
  private workflowCache = new Map<string, { workflow: ParsedWorkflow; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private workflowRepo: WorkflowRepository
  ) {}

  /**
   * Load and parse workflow by ID
   */
  async loadWorkflow(
    workflowId: UUID, 
    options: WorkflowLoadOptions = {}
  ): Promise<ParsedWorkflow> {
    const cacheKey = `${workflowId}:${options.version || 'active'}`;
    
    // Check cache first
    const cached = this.workflowCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.workflow;
    }

    // Load from database
    let workflowEntity: WorkflowEntity | null;
    
    if (options.version) {
      workflowEntity = await this.loadWorkflowVersion(workflowId, options.version);
    } else {
      workflowEntity = await this.workflowRepo.findById(workflowId);
    }

    if (!workflowEntity) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Check if workflow is active (unless explicitly including inactive)
    if (!options.includeInactive && !workflowEntity.is_active) {
      throw new Error(`Workflow is not active: ${workflowId}`);
    }

    // Convert entity to definition and parse
    const workflowDefinition = mapWorkflowEntityToDefinition(workflowEntity);
    
    if (options.validateOnly) {
      // Only validate, don't cache
      const errors = WorkflowParser.validateWorkflowDefinition(workflowDefinition);
      if (errors.length > 0) {
        throw new Error(`Workflow validation failed: ${errors.map(e => e.message).join(', ')}`);
      }
      // Return minimal parsed workflow for validation
      return {
        definition: workflowDefinition,
        executionOrder: [],
        entryNodes: [],
        exitNodes: [],
        nodeMap: new Map(),
        edgeMap: new Map(),
        dependencyMap: new Map()
      };
    }

    const parsedWorkflow = WorkflowParser.parseWorkflow(workflowDefinition);

    // Cache the result
    this.workflowCache.set(cacheKey, {
      workflow: parsedWorkflow,
      timestamp: Date.now()
    });

    return parsedWorkflow;
  }

  /**
   * Load workflows by event trigger
   */
  async loadWorkflowsByTrigger(
    eventTrigger: string,
    organizationId?: UUID
  ): Promise<ParsedWorkflow[]> {
    const workflowEntities = await this.workflowRepo.findByEventTrigger(eventTrigger);
    
    // Filter by organization if specified
    const filteredEntities = organizationId 
      ? workflowEntities.filter(w => w.org_id === organizationId)
      : workflowEntities;

    // Only include active workflows
    const activeEntities = filteredEntities.filter(w => w.is_active);

    const parsedWorkflows: ParsedWorkflow[] = [];
    
    for (const entity of activeEntities) {
      try {
        const definition = mapWorkflowEntityToDefinition(entity);
        const parsed = WorkflowParser.parseWorkflow(definition);
        parsedWorkflows.push(parsed);
      } catch (error) {
        console.warn(`Failed to parse workflow ${entity.workflow_id}:`, error);
        // Continue with other workflows
      }
    }

    return parsedWorkflows;
  }

  /**
   * Get workflow version information
   */
  async getWorkflowVersionInfo(workflowId: UUID): Promise<WorkflowVersionInfo> {
    // This would require a more sophisticated query to get all versions
    // For now, we'll work with the current schema
    const workflow = await this.workflowRepo.findById(workflowId);
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    return {
      workflowId,
      versions: [{
        version: workflow.version,
        isActive: workflow.is_active,
        createdAt: workflow.created_at,
        createdBy: workflow.created_by
      }],
      activeVersion: workflow.is_active ? workflow.version : undefined,
      latestVersion: workflow.version
    };
  }

  /**
   * Activate workflow version
   */
  async activateWorkflowVersion(
    workflowId: UUID, 
    version: number,
    activatedBy?: UUID
  ): Promise<void> {
    const workflow = await this.loadWorkflowVersion(workflowId, version);
    
    if (!workflow) {
      throw new Error(`Workflow version not found: ${workflowId} v${version}`);
    }

    // Validate workflow before activation
    const definition = mapWorkflowEntityToDefinition(workflow);
    const errors = WorkflowParser.validateWorkflowDefinition(definition);
    
    if (errors.length > 0) {
      throw new Error(`Cannot activate invalid workflow: ${errors.map(e => e.message).join(', ')}`);
    }

    // In a real implementation, you would:
    // 1. Deactivate all other versions of this workflow
    // 2. Activate the specified version
    // 3. Log the activation event
    
    await this.workflowRepo.update(workflowId, { 
      is_active: true,
      updated_at: new Date()
    });

    // Clear cache for this workflow
    this.clearWorkflowCache(workflowId);

    console.log(`Activated workflow ${workflowId} version ${version} by ${activatedBy || 'system'}`);
  }

  /**
   * Deactivate workflow
   */
  async deactivateWorkflow(workflowId: UUID, deactivatedBy?: UUID): Promise<void> {
    const workflow = await this.workflowRepo.findById(workflowId);
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    await this.workflowRepo.update(workflowId, { 
      is_active: false,
      updated_at: new Date()
    });

    // Clear cache for this workflow
    this.clearWorkflowCache(workflowId);

    console.log(`Deactivated workflow ${workflowId} by ${deactivatedBy || 'system'}`);
  }

  /**
   * Create new workflow version
   */
  async createWorkflowVersion(
    baseWorkflowId: UUID,
    updatedDefinition: WorkflowDefinition,
    createdBy?: UUID
  ): Promise<WorkflowDefinition> {
    const baseWorkflow = await this.workflowRepo.findById(baseWorkflowId);
    
    if (!baseWorkflow) {
      throw new Error(`Base workflow not found: ${baseWorkflowId}`);
    }

    // Validate new definition
    const errors = WorkflowParser.validateWorkflowDefinition(updatedDefinition);
    if (errors.length > 0) {
      throw new Error(`Invalid workflow definition: ${errors.map(e => e.message).join(', ')}`);
    }

    // Create new version (increment version number)
    const newVersion = baseWorkflow.version + 1;
    
    const newWorkflowEntity: Omit<WorkflowEntity, 'created_at' | 'updated_at'> = {
      workflow_id: baseWorkflowId, // Use the same ID for versioning
      org_id: baseWorkflow.org_id,
      name: updatedDefinition.name,
      description: updatedDefinition.description,
      event_trigger: updatedDefinition.eventTrigger,
      version: newVersion,
      is_active: false, // New versions start inactive
      definition: updatedDefinition.definition,
      created_by: createdBy
    };

    const createdEntity = await this.workflowRepo.create(newWorkflowEntity);
    return mapWorkflowEntityToDefinition(createdEntity);
  }

  /**
   * Validate workflow definition without loading
   */
  async validateWorkflowDefinition(definition: WorkflowDefinition): Promise<{
    isValid: boolean;
    errors: Array<{ code: string; message: string; nodeId?: UUID; edgeId?: UUID }>;
  }> {
    try {
      const errors = WorkflowParser.validateWorkflowDefinition(definition);
      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown validation error'
        }]
      };
    }
  }

  /**
   * Preload and cache frequently used workflows
   */
  async preloadWorkflows(workflowIds: UUID[]): Promise<void> {
    const loadPromises = workflowIds.map(async (id) => {
      try {
        await this.loadWorkflow(id);
      } catch (error) {
        console.warn(`Failed to preload workflow ${id}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  /**
   * Clear workflow cache
   */
  clearWorkflowCache(workflowId?: UUID): void {
    if (workflowId) {
      // Clear specific workflow cache entries
      const keysToDelete = Array.from(this.workflowCache.keys())
        .filter(key => key.startsWith(`${workflowId}:`));
      
      for (const key of keysToDelete) {
        this.workflowCache.delete(key);
      }
    } else {
      // Clear entire cache
      this.workflowCache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ key: string; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.workflowCache.entries()).map(([key, value]) => ({
      key,
      age: now - value.timestamp
    }));

    return {
      size: this.workflowCache.size,
      entries
    };
  }

  /**
   * Load specific workflow version (helper method)
   */
  private async loadWorkflowVersion(workflowId: UUID, version: number): Promise<WorkflowEntity | null> {
    // In the current schema, we don't have version-specific queries
    // This would need to be implemented based on your versioning strategy
    const workflow = await this.workflowRepo.findById(workflowId);
    
    if (workflow && workflow.version === version) {
      return workflow;
    }
    
    return null;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, value] of this.workflowCache.entries()) {
      if ((now - value.timestamp) > this.CACHE_TTL) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.workflowCache.delete(key);
    }
  }

  /**
   * Start cache cleanup interval
   */
  startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCache();
    }, this.CACHE_TTL);
  }
}