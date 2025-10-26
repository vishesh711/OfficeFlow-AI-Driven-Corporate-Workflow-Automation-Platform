/**
 * REST API routes for workflow engine
 */

import { Router, Request, Response } from 'express';
import { WorkflowEngineService } from '../services/workflow-engine-service';
import { ExecutionContext } from '@officeflow/types';

export function createWorkflowEngineRoutes(engineService: WorkflowEngineService): Router {
  const router = Router();

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