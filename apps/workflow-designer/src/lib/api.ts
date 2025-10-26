import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

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