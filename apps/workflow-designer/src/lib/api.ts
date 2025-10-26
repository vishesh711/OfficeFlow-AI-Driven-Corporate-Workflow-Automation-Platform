import axios from 'axios'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3000/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for auth
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export interface Workflow {
  id: string
  name: string
  description?: string
  eventTrigger: string
  version: number
  isActive: boolean
  definition: WorkflowDefinition
  createdAt: string
  updatedAt: string
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface WorkflowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label: string
    params: Record<string, any>
    retryPolicy?: {
      maxRetries: number
      backoffMs: number
    }
    timeoutMs?: number
  }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  data?: {
    condition?: string
    label?: string
  }
}

export interface WorkflowRun {
  id: string
  workflowId: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  startedAt: string
  endedAt?: string
  context: Record<string, any>
  nodeRuns: NodeRun[]
}

export interface NodeRun {
  id: string
  nodeId: string
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING'
  attempt: number
  startedAt?: string
  endedAt?: string
  input?: Record<string, any>
  output?: Record<string, any>
  error?: string
}

export interface WorkflowMetrics {
  totalRuns: number
  runningRuns: number
  completedRuns: number
  failedRuns: number
  averageExecutionTime: number
  successRate: number
  runsByStatus: Record<string, number>
  runsByDay: Array<{ date: string; count: number }>
  nodePerformance: Array<{
    nodeId: string
    nodeName: string
    averageExecutionTime: number
    successRate: number
    totalExecutions: number
  }>
}

export interface SystemHealth {
  services: Array<{
    name: string
    status: 'healthy' | 'degraded' | 'unhealthy'
    lastCheck: string
    responseTime?: number
    errorRate?: number
  }>
  kafka: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    topics: Array<{
      name: string
      partitions: number
      lag: number
    }>
  }
  database: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    connections: number
    queryTime: number
  }
  redis: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    memory: number
    connections: number
  }
}

export interface WorkflowRunFilter {
  status?: string[]
  workflowId?: string
  employeeId?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user' | 'viewer'
  organizationId: string
  isActive: boolean
  lastLogin?: string
  createdAt: string
  updatedAt: string
}

export interface Organization {
  id: string
  name: string
  domain: string
  plan: 'free' | 'pro' | 'enterprise'
  settings: Record<string, any>
  userCount: number
  workflowCount: number
  createdAt: string
  updatedAt: string
}

export interface IntegrationCredential {
  id: string
  organizationId: string
  provider: string
  name: string
  type: 'oauth2' | 'api_key' | 'basic_auth'
  isActive: boolean
  lastUsed?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  id: string
  organizationId: string
  userId?: string
  action: string
  resource: string
  resourceId?: string
  details: Record<string, any>
  ipAddress?: string
  userAgent?: string
  timestamp: string
}

export interface AuditLogFilter {
  organizationId?: string
  userId?: string
  action?: string
  resource?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

// API functions
export const workflowApi = {
  getWorkflows: () => apiClient.get<Workflow[]>('/workflows'),
  getWorkflow: (id: string) => apiClient.get<Workflow>(`/workflows/${id}`),
  createWorkflow: (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<Workflow>('/workflows', workflow),
  updateWorkflow: (id: string, workflow: Partial<Workflow>) =>
    apiClient.put<Workflow>(`/workflows/${id}`, workflow),
  deleteWorkflow: (id: string) => apiClient.delete(`/workflows/${id}`),
  getWorkflowRuns: (workflowId: string) =>
    apiClient.get<WorkflowRun[]>(`/workflows/${workflowId}/runs`),
}

export const monitoringApi = {
  getWorkflowRuns: (filter?: WorkflowRunFilter) =>
    apiClient.get<{ runs: WorkflowRun[]; total: number }>('/monitoring/runs', { params: filter }),
  getWorkflowRun: (runId: string) =>
    apiClient.get<WorkflowRun>(`/monitoring/runs/${runId}`),
  getWorkflowMetrics: (workflowId?: string, timeRange?: string) =>
    apiClient.get<WorkflowMetrics>('/monitoring/metrics', {
      params: { workflowId, timeRange }
    }),
  getSystemHealth: () =>
    apiClient.get<SystemHealth>('/monitoring/health'),
  pauseWorkflowRun: (runId: string) =>
    apiClient.post(`/monitoring/runs/${runId}/pause`),
  resumeWorkflowRun: (runId: string) =>
    apiClient.post(`/monitoring/runs/${runId}/resume`),
  cancelWorkflowRun: (runId: string) =>
    apiClient.post(`/monitoring/runs/${runId}/cancel`),
  retryWorkflowRun: (runId: string) =>
    apiClient.post(`/monitoring/runs/${runId}/retry`),
}

export const adminApi = {
  // User Management
  getUsers: (organizationId?: string) =>
    apiClient.get<User[]>('/admin/users', { params: { organizationId } }),
  getUser: (userId: string) =>
    apiClient.get<User>(`/admin/users/${userId}`),
  createUser: (user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<User>('/admin/users', user),
  updateUser: (userId: string, user: Partial<User>) =>
    apiClient.put<User>(`/admin/users/${userId}`, user),
  deleteUser: (userId: string) =>
    apiClient.delete(`/admin/users/${userId}`),

  // Organization Management
  getOrganizations: () =>
    apiClient.get<Organization[]>('/admin/organizations'),
  getOrganization: (orgId: string) =>
    apiClient.get<Organization>(`/admin/organizations/${orgId}`),
  createOrganization: (org: Omit<Organization, 'id' | 'userCount' | 'workflowCount' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<Organization>('/admin/organizations', org),
  updateOrganization: (orgId: string, org: Partial<Organization>) =>
    apiClient.put<Organization>(`/admin/organizations/${orgId}`, org),
  deleteOrganization: (orgId: string) =>
    apiClient.delete(`/admin/organizations/${orgId}`),

  // Integration Management
  getIntegrationCredentials: (organizationId?: string) =>
    apiClient.get<IntegrationCredential[]>('/admin/integrations', { params: { organizationId } }),
  getIntegrationCredential: (credentialId: string) =>
    apiClient.get<IntegrationCredential>(`/admin/integrations/${credentialId}`),
  createIntegrationCredential: (credential: Omit<IntegrationCredential, 'id' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<IntegrationCredential>('/admin/integrations', credential),
  updateIntegrationCredential: (credentialId: string, credential: Partial<IntegrationCredential>) =>
    apiClient.put<IntegrationCredential>(`/admin/integrations/${credentialId}`, credential),
  deleteIntegrationCredential: (credentialId: string) =>
    apiClient.delete(`/admin/integrations/${credentialId}`),
  testIntegrationCredential: (credentialId: string) =>
    apiClient.post<{ success: boolean; error?: string }>(`/admin/integrations/${credentialId}/test`),

  // Audit Logs
  getAuditLogs: (filter?: AuditLogFilter) =>
    apiClient.get<{ logs: AuditLog[]; total: number }>('/admin/audit-logs', { params: filter }),
  exportAuditLogs: (filter?: AuditLogFilter) =>
    apiClient.get('/admin/audit-logs/export', { params: filter, responseType: 'blob' }),
}