import { WorkflowDefinition } from './api';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  definition: WorkflowDefinition;
  tags: string[];
  createdAt: string;
}

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'employee-onboarding',
    name: 'Employee Onboarding',
    description:
      'Complete onboarding workflow for new employees including account setup, document distribution, and team introductions',
    category: 'HR',
    tags: ['onboarding', 'hr', 'identity', 'communication'],
    createdAt: '2024-01-01T00:00:00Z',
    definition: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: {
            label: 'Employee Onboard Event',
            params: { eventType: 'employee.onboard' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
        {
          id: 'identity-1',
          type: 'identity',
          position: { x: 100, y: 200 },
          data: {
            label: 'Create Google Account',
            params: { action: 'provision', provider: 'google' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
        {
          id: 'ai-1',
          type: 'ai',
          position: { x: 300, y: 200 },
          data: {
            label: 'Generate Welcome Message',
            params: { contentType: 'welcome_message' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
        {
          id: 'email-1',
          type: 'email',
          position: { x: 300, y: 300 },
          data: {
            label: 'Send Welcome Email',
            params: { template: 'welcome', recipients: '{{employee.email}}' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
        {
          id: 'document-1',
          type: 'document',
          position: { x: 100, y: 300 },
          data: {
            label: 'Distribute Handbook',
            params: { action: 'distribute', documentType: 'handbook' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
        {
          id: 'slack-1',
          type: 'slack',
          position: { x: 500, y: 200 },
          data: {
            label: 'Add to Team Channel',
            params: { action: 'add_to_channel', channel: '#team' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'identity-1' },
        { id: 'e2', source: 'trigger-1', target: 'ai-1' },
        { id: 'e3', source: 'ai-1', target: 'email-1' },
        { id: 'e4', source: 'identity-1', target: 'document-1' },
        { id: 'e5', source: 'identity-1', target: 'slack-1' },
      ],
    },
  },
  {
    id: 'employee-offboarding',
    name: 'Employee Offboarding',
    description:
      'Secure offboarding process including account deactivation, access revocation, and equipment return',
    category: 'HR',
    tags: ['offboarding', 'hr', 'security', 'identity'],
    createdAt: '2024-01-01T00:00:00Z',
    definition: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: {
            label: 'Employee Exit Event',
            params: { eventType: 'employee.exit' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
        {
          id: 'identity-1',
          type: 'identity',
          position: { x: 100, y: 200 },
          data: {
            label: 'Deactivate Accounts',
            params: { action: 'deprovision', provider: 'google' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
        {
          id: 'slack-1',
          type: 'slack',
          position: { x: 300, y: 200 },
          data: {
            label: 'Remove from Channels',
            params: { action: 'remove_from_channels' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
        {
          id: 'email-1',
          type: 'email',
          position: { x: 200, y: 300 },
          data: {
            label: 'Send Exit Survey',
            params: { template: 'exit_survey', recipients: '{{employee.personal_email}}' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'identity-1' },
        { id: 'e2', source: 'trigger-1', target: 'slack-1' },
        { id: 'e3', source: 'identity-1', target: 'email-1' },
      ],
    },
  },
  {
    id: 'access-request-approval',
    name: 'Access Request Approval',
    description:
      'Automated approval workflow for system access requests with manager approval and provisioning',
    category: 'Security',
    tags: ['access', 'approval', 'security', 'identity'],
    createdAt: '2024-01-01T00:00:00Z',
    definition: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: {
            label: 'Access Request Event',
            params: { eventType: 'access.request' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
        {
          id: 'condition-1',
          type: 'condition',
          position: { x: 100, y: 200 },
          data: {
            label: 'Check Request Type',
            params: { expression: '{{request.type}} === "high_privilege"' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
        {
          id: 'email-1',
          type: 'email',
          position: { x: 50, y: 300 },
          data: {
            label: 'Request Manager Approval',
            params: { template: 'approval_request', recipients: '{{employee.manager_email}}' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
        {
          id: 'identity-1',
          type: 'identity',
          position: { x: 200, y: 300 },
          data: {
            label: 'Grant Access',
            params: { action: 'provision', provider: 'okta' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
        {
          id: 'email-2',
          type: 'email',
          position: { x: 200, y: 400 },
          data: {
            label: 'Notify User',
            params: { template: 'access_granted', recipients: '{{employee.email}}' },
            retryPolicy: { maxRetries: 3, backoffMs: 1000 },
            timeoutMs: 300000,
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'condition-1' },
        { id: 'e2', source: 'condition-1', target: 'email-1', sourceHandle: 'true' },
        { id: 'e3', source: 'condition-1', target: 'identity-1', sourceHandle: 'false' },
        { id: 'e4', source: 'identity-1', target: 'email-2' },
      ],
    },
  },
];

export const getTemplatesByCategory = () => {
  const categories = workflowTemplates.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<string, WorkflowTemplate[]>
  );

  return categories;
};

export const searchTemplates = (query: string): WorkflowTemplate[] => {
  const lowercaseQuery = query.toLowerCase();
  return workflowTemplates.filter(
    (template) =>
      template.name.toLowerCase().includes(lowercaseQuery) ||
      template.description.toLowerCase().includes(lowercaseQuery) ||
      template.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery))
  );
};

export const cloneWorkflow = (workflow: { name: string; definition: WorkflowDefinition }) => {
  const clonedDefinition: WorkflowDefinition = {
    nodes: workflow.definition.nodes.map((node) => ({
      ...node,
      id: `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50,
      },
    })),
    edges: workflow.definition.edges.map((edge) => {
      const sourceNode = workflow.definition.nodes.find((n) => n.id === edge.source);
      const targetNode = workflow.definition.nodes.find((n) => n.id === edge.target);

      if (!sourceNode || !targetNode) return edge;

      const newSourceId = `${sourceNode.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newTargetId = `${targetNode.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        ...edge,
        id: `e-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: newSourceId,
        target: newTargetId,
      };
    }),
  };

  return {
    name: `${workflow.name} (Copy)`,
    definition: clonedDefinition,
  };
};
