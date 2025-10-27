import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Play, Pause, Edit, Trash2, Copy, GitBranch, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { workflowApi } from '@/lib/api'
import { cloneWorkflow } from '@/lib/templates'

export function WorkflowList() {
  const queryClient = useQueryClient()
  
  const { data: workflows, isLoading, error } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => workflowApi.getWorkflows().then(res => res.data),
  })

  const cloneWorkflowMutation = useMutation({
    mutationFn: async (workflow: any) => {
      const cloned = cloneWorkflow(workflow)
      return workflowApi.createWorkflow({
        ...cloned,
        eventTrigger: workflow.eventTrigger,
        version: 1,
        isActive: false,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })

  const toggleWorkflowMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return workflowApi.updateWorkflow(id, { isActive: !isActive })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })

  const deleteWorkflowMutation = useMutation({
    mutationFn: (id: string) => workflowApi.deleteWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })

  const handleCloneWorkflow = (workflow: any) => {
    cloneWorkflowMutation.mutate(workflow)
  }

  const handleToggleWorkflow = (workflow: any) => {
    toggleWorkflowMutation.mutate({ id: workflow.id, isActive: workflow.isActive })
  }

  const handleDeleteWorkflow = (id: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      deleteWorkflowMutation.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl w-1/3 mb-8"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center py-12 bg-red-50 rounded-2xl border-2 border-red-200">
          <AlertCircle className="mx-auto h-12 w-12 text-red-600 mb-4" />
          <p className="text-red-600 font-medium">Failed to load workflows</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-2xl p-8 mb-8 border border-gray-200 shadow-sm">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        
        <div className="relative sm:flex sm:items-center sm:justify-between">
          <div className="sm:flex-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg">
                <GitBranch className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
            </div>
            <p className="mt-2 text-sm text-gray-600 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Manage your automation workflows
            </p>
          </div>
          <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
            <Link
              to="/workflows/new"
              className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-105"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Workflow
            </Link>
          </div>
        </div>
      </div>

      {/* Workflows Grid */}
      {!workflows || workflows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-gray-200 shadow-lg">
          <GitBranch className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No workflows yet</h3>
          <p className="text-sm text-gray-500 mb-6">Get started by creating your first workflow.</p>
          <Link
            to="/workflows/new"
            className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Workflow
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow: any) => (
            <div
              key={workflow.id}
              className="group bg-white rounded-2xl border-2 border-gray-200 shadow-lg hover:shadow-xl hover:border-blue-400 transition-all duration-200 overflow-hidden transform hover:-translate-y-1"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                      {workflow.name}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {workflow.description || 'No description'}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      workflow.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {workflow.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700">
                    {workflow.eventTrigger}
                  </span>
                  <span>v{workflow.version}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/workflows/${workflow.id}`}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <Edit className="h-4 w-4 mr-1.5" />
                    Edit
                  </Link>
                  <button
                    onClick={() => handleToggleWorkflow(workflow)}
                    disabled={toggleWorkflowMutation.isPending}
                    className={`flex-1 inline-flex items-center justify-center px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                      workflow.isActive
                        ? 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100'
                        : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                    }`}
                  >
                    {toggleWorkflowMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : workflow.isActive ? (
                      <>
                        <Pause className="h-4 w-4 mr-1.5" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-1.5" />
                        Activate
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => handleCloneWorkflow(workflow)}
                    disabled={cloneWorkflowMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    {cloneWorkflowMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1.5" />
                        Clone
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteWorkflow(workflow.id)}
                    disabled={deleteWorkflowMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-red-700 hover:text-red-900 transition-colors"
                  >
                    {deleteWorkflowMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
