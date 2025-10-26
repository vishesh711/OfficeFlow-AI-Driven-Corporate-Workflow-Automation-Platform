/**
 * REST API routes for workflow engine
 */

import { Router, Request, Response } from 'express';
import { WorkflowEngineService } from '../services/workflow-engine-service';
import { ExecutionContext } from '@officeflow/types';
import { 
  WorkflowRepositoryImpl, 
  WorkflowRunRepositoryImpl,
  EmployeeRepositoryImpl 
} from '@officeflow/database';

export function createWorkflowEngineRoutes(engineService: WorkflowEngineService): Router {
  const router = Router();
  
  // Initialize repositories for CRUD operations
  const workflowRepo = new WorkflowRepositoryImpl();
  const workflowRunRepo = new WorkflowRunRepositoryImpl();
  const employeeRepo = new EmployeeRepositoryImpl();

  /**
   * Get all workflows
   */
  router.get('/workflows', async (req: Request, res: Response) => {
    try {
      const workflows = await workflowRepo.findAll();
      res.json(workflows);
    } catch (error) {
      console.error('Failed to get workflows:', error);
      res.status(500).json({
        error: 'Failed to get workflows',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get workflow by ID
   */
  router.get('/workflows/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const workflow = await workflowRepo.findById(id);
      
      if (!workflow) {
        return res.status(404).json({
          error: 'Workflow not found',
        });
      }
      
      res.json(workflow);
    } catch (error) {
      console.error('Failed to get workflow:', error);
      res.status(500).json({
        error: 'Failed to get workflow',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Create new workflow
   */
  router.post('/workflows', async (req: Request, res: Response) => {
    try {
      const workflowData = req.body;
      const workflow = await workflowRepo.create(workflowData);
      
      res.status(201).json(workflow);
    } catch (error) {
      console.error('Failed to create workflow:', error);
      res.status(500).json({
        error: 'Failed to create workflow',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Update workflow
   */
  router.put('/workflows/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const workflow = await workflowRepo.update(id, updates);
      
      if (!workflow) {
        return res.status(404).json({
          error: 'Workflow not found',
        });
      }
      
      res.json(workflow);
    } catch (error) {
      console.error('Failed to update workflow:', error);
      res.status(500).json({
        error: 'Failed to update workflow',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Delete workflow
   */
  router.delete('/workflows/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await workflowRepo.delete(id);
      
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      res.status(500).json({
        error: 'Failed to delete workflow',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get workflow runs for monitoring
   */
  router.get('/monitoring/runs', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      
      const runs = await workflowRunRepo.findMany({ limit, offset });
      const total = await workflowRunRepo.count();
      
      res.json({
        runs,
        total,
      });
    } catch (error) {
      console.error('Failed to get workflow runs:', error);
      res.status(500).json({
        error: 'Failed to get workflow runs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get workflow metrics
   */
  router.get('/monitoring/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = {
        totalRuns: await workflowRunRepo.count(),
        runningRuns: await workflowRunRepo.count({ status: 'RUNNING' }),
        completedRuns: await workflowRunRepo.count({ status: 'COMPLETED' }),
        failedRuns: await workflowRunRepo.count({ status: 'FAILED' }),
        averageExecutionTime: 0, // TODO: Calculate from actual data
        successRate: 0, // TODO: Calculate from actual data
        runsByStatus: {
          PENDING: await workflowRunRepo.count({ status: 'PENDING' }),
          RUNNING: await workflowRunRepo.count({ status: 'RUNNING' }),
          COMPLETED: await workflowRunRepo.count({ status: 'COMPLETED' }),
          FAILED: await workflowRunRepo.count({ status: 'FAILED' }),
          CANCELLED: await workflowRunRepo.count({ status: 'CANCELLED' }),
        },
        runsByDay: [], // TODO: Implement time-based aggregation
        nodePerformance: [], // TODO: Implement node-level metrics
      };
      
      res.json(metrics);
    } catch (error) {
      console.error('Failed to get metrics:', error);
      res.status(500).json({
        error: 'Failed to get metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get system health for monitoring
   */
  router.get('/monitoring/health', async (req: Request, res: Response) => {
    try {
      const health = {
        services: [
          {
            name: 'workflow-engine',
            status: 'healthy' as const,
            lastCheck: new Date().toISOString(),
            responseTime: 1,
            errorRate: 0,
          },
          {
            name: 'database',
            status: 'healthy' as const,
            lastCheck: new Date().toISOString(),
            responseTime: 5,
            errorRate: 0,
          },
          {
            name: 'kafka',
            status: 'healthy' as const,
            lastCheck: new Date().toISOString(),
            responseTime: 2,
            errorRate: 0,
          },
          {
            name: 'redis',
            status: 'healthy' as const,
            lastCheck: new Date().toISOString(),
            responseTime: 1,
            errorRate: 0,
          },
        ],
        kafka: {
          status: 'healthy' as const,
          topics: [
            { name: 'workflow.run.pause', partitions: 1, lag: 0 },
            { name: 'workflow.run.resume', partitions: 1, lag: 0 },
            { name: 'workflow.run.cancel', partitions: 1, lag: 0 },
            { name: 'node.execute.result', partitions: 1, lag: 0 },
          ],
        },
        database: {
          status: 'healthy' as const,
          connections: 5,
          queryTime: 10,
        },
        redis: {
          status: 'healthy' as const,
          memory: 1024 * 1024 * 10, // 10MB
          connections: 3,
        },
      };
      
      res.json(health);
    } catch (error) {
      console.error('Failed to get system health:', error);
      res.status(500).json({
        error: 'Failed to get system health',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Admin routes - Users
   */
  router.get('/admin/users', async (req: Request, res: Response) => {
    try {
      // Mock user data for now
      const users = [
        {
          id: '1',
          email: 'admin@officeflow.com',
          name: 'Admin User',
          role: 'admin' as const,
          organizationId: 'org-1',
          isActive: true,
          lastLogin: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      
      res.json(users);
    } catch (error) {
      console.error('Failed to get users:', error);
      res.status(500).json({
        error: 'Failed to get users',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Admin routes - Organizations
   */
  router.get('/admin/organizations', async (req: Request, res: Response) => {
    try {
      // Mock organization data for now
      const organizations = [
        {
          id: 'org-1',
          name: 'OfficeFlow Corp',
          domain: 'officeflow.com',
          plan: 'enterprise' as const,
          settings: {},
          userCount: 1,
          workflowCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      
      res.json(organizations);
    } catch (error) {
      console.error('Failed to get organizations:', error);
      res.status(500).json({
        error: 'Failed to get organizations',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Admin routes - Integration Credentials
   */
  router.get('/admin/integrations', async (req: Request, res: Response) => {
    try {
      // Mock integration data for now
      const integrations = [
        {
          id: '1',
          organizationId: 'org-1',
          provider: 'slack',
          name: 'Slack Integration',
          type: 'oauth2' as const,
          isActive: false,
          lastUsed: undefined,
          expiresAt: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      
      res.json(integrations);
    } catch (error) {
      console.error('Failed to get integrations:', error);
      res.status(500).json({
        error: 'Failed to get integrations',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Execute a workflow manually
   */
  router.post('/workflows/:workflowId/execute', async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      const { organizationId, employeeId, variables = {}, secrets = {} } = req.body;

      if (!organizationId || !employeeId) {
        return res.status(400).json({
          error: 'organizationId and employeeId are required',
        });
      }

      const context: ExecutionContext = {
        organizationId,
        employeeId,
        triggerEvent: {
          type: 'manual',
          payload: req.body.payload || {},
          timestamp: new Date(),
        },
        variables,
        secrets,
        correlationId: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      };

      const workflowRun = await engineService.executeWorkflow(workflowId, context);

      res.status(201).json({
        success: true,
        data: workflowRun,
      });

    } catch (error) {
      console.error('Failed to execute workflow:', error);
      res.status(500).json({
        error: 'Failed to execute workflow',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Pause a workflow
   */
  router.post('/workflow-runs/:runId/pause', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      await engineService.pauseWorkflow(runId);

      res.json({
        success: true,
        message: 'Workflow paused successfully',
      });

    } catch (error) {
      console.error('Failed to pause workflow:', error);
      res.status(500).json({
        error: 'Failed to pause workflow',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Resume a workflow
   */
  router.post('/workflow-runs/:runId/resume', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      await engineService.resumeWorkflow(runId);

      res.json({
        success: true,
        message: 'Workflow resumed successfully',
      });

    } catch (error) {
      console.error('Failed to resume workflow:', error);
      res.status(500).json({
        error: 'Failed to resume workflow',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Cancel a workflow
   */
  router.post('/workflow-runs/:runId/cancel', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      await engineService.cancelWorkflow(runId);

      res.json({
        success: true,
        message: 'Workflow cancelled successfully',
      });

    } catch (error) {
      console.error('Failed to cancel workflow:', error);
      res.status(500).json({
        error: 'Failed to cancel workflow',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get workflow run details
   */
  router.get('/workflow-runs/:runId', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const workflowRun = await engineService.getWorkflowRun(runId);

      if (!workflowRun) {
        return res.status(404).json({
          error: 'Workflow run not found',
        });
      }

      res.json({
        success: true,
        data: workflowRun,
      });

    } catch (error) {
      console.error('Failed to get workflow run:', error);
      res.status(500).json({
        error: 'Failed to get workflow run',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get workflow run history
   */
  router.get('/workflows/:workflowId/runs', async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      const runs = await engineService.getWorkflowRunHistory(workflowId, limit);

      res.json({
        success: true,
        data: runs,
      });

    } catch (error) {
      console.error('Failed to get workflow run history:', error);
      res.status(500).json({
        error: 'Failed to get workflow run history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Health check endpoint
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await engineService.getHealthStatus();
      
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);

    } catch (error) {
      console.error('Failed to get health status:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Failed to get health status',
      });
    }
  });

  /**
   * Process lifecycle event (for testing)
   */
  router.post('/events/lifecycle', async (req: Request, res: Response) => {
    try {
      const event = req.body;
      
      if (!event.type || !event.organizationId || !event.employeeId) {
        return res.status(400).json({
          error: 'type, organizationId, and employeeId are required',
        });
      }

      const workflowRun = await engineService.processLifecycleEvent(event);

      res.status(201).json({
        success: true,
        data: workflowRun,
      });

    } catch (error) {
      console.error('Failed to process lifecycle event:', error);
      res.status(500).json({
        error: 'Failed to process lifecycle event',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}