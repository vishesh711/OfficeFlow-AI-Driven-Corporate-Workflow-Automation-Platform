/**
 * Workflow and node state machine implementation
 */

import { WorkflowRunStatus, NodeRunStatus } from '@officeflow/types';
import {
  WorkflowState,
  NodeState,
  WorkflowTransition,
  NodeTransition,
  WORKFLOW_TRANSITIONS,
  NODE_TRANSITIONS,
} from '../types/workflow-state';

export class WorkflowStateMachine {
  private transitions: Map<string, WorkflowTransition[]> = new Map();

  constructor() {
    this.initializeTransitions();
  }

  private initializeTransitions(): void {
    WORKFLOW_TRANSITIONS.forEach((transition) => {
      const key = transition.fromStatus;
      if (!this.transitions.has(key)) {
        this.transitions.set(key, []);
      }
      this.transitions.get(key)!.push(transition);
    });
  }

  /**
   * Check if a workflow state transition is valid
   */
  canTransition(
    currentStatus: WorkflowRunStatus,
    trigger: WorkflowTransition['trigger'],
    state?: WorkflowState
  ): boolean {
    const possibleTransitions = this.transitions.get(currentStatus) || [];

    return possibleTransitions.some((transition) => {
      if (transition.trigger !== trigger) {
        return false;
      }

      if (transition.conditions && state) {
        return transition.conditions(state);
      }

      return true;
    });
  }

  /**
   * Get the next status for a workflow transition
   */
  getNextStatus(
    currentStatus: WorkflowRunStatus,
    trigger: WorkflowTransition['trigger'],
    state?: WorkflowState
  ): WorkflowRunStatus | null {
    const possibleTransitions = this.transitions.get(currentStatus) || [];

    const validTransition = possibleTransitions.find((transition) => {
      if (transition.trigger !== trigger) {
        return false;
      }

      if (transition.conditions && state) {
        return transition.conditions(state);
      }

      return true;
    });

    return validTransition ? validTransition.toStatus : null;
  }

  /**
   * Transition workflow state
   */
  transitionWorkflow(state: WorkflowState, trigger: WorkflowTransition['trigger']): WorkflowState {
    const nextStatus = this.getNextStatus(state.status, trigger, state);

    if (!nextStatus) {
      throw new Error(`Invalid workflow transition: ${state.status} -> ${trigger}`);
    }

    return {
      ...state,
      status: nextStatus,
      lastUpdatedAt: new Date(),
    };
  }
}

export class NodeStateMachine {
  private transitions: Map<string, NodeTransition[]> = new Map();

  constructor() {
    this.initializeTransitions();
  }

  private initializeTransitions(): void {
    NODE_TRANSITIONS.forEach((transition) => {
      const key = transition.fromStatus;
      if (!this.transitions.has(key)) {
        this.transitions.set(key, []);
      }
      this.transitions.get(key)!.push(transition);
    });
  }

  /**
   * Check if a node state transition is valid
   */
  canTransition(
    currentStatus: NodeRunStatus,
    trigger: NodeTransition['trigger'],
    state?: NodeState
  ): boolean {
    const possibleTransitions = this.transitions.get(currentStatus) || [];

    return possibleTransitions.some((transition) => {
      if (transition.trigger !== trigger) {
        return false;
      }

      if (transition.conditions && state) {
        return transition.conditions(state);
      }

      return true;
    });
  }

  /**
   * Get the next status for a node transition
   */
  getNextStatus(
    currentStatus: NodeRunStatus,
    trigger: NodeTransition['trigger'],
    state?: NodeState
  ): NodeRunStatus | null {
    const possibleTransitions = this.transitions.get(currentStatus) || [];

    const validTransition = possibleTransitions.find((transition) => {
      if (transition.trigger !== trigger) {
        return false;
      }

      if (transition.conditions && state) {
        return transition.conditions(state);
      }

      return true;
    });

    return validTransition ? validTransition.toStatus : null;
  }

  /**
   * Transition node state
   */
  transitionNode(state: NodeState, trigger: NodeTransition['trigger']): NodeState {
    const nextStatus = this.getNextStatus(state.status, trigger, state);

    if (!nextStatus) {
      throw new Error(`Invalid node transition: ${state.status} -> ${trigger}`);
    }

    const now = new Date();
    const updates: Partial<NodeState> = {
      status: nextStatus,
    };

    // Set timestamps based on status
    if (nextStatus === 'RUNNING' && state.status === 'QUEUED') {
      updates.startedAt = now;
    } else if (['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'SKIPPED'].includes(nextStatus)) {
      updates.endedAt = now;
    }

    return {
      ...state,
      ...updates,
    };
  }
}
