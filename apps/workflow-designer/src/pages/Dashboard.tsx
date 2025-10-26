import { Link } from 'react-router-dom'
import { Plus, GitBranch, Play, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { monitoringApi } from '@/lib/api'

export function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => monitoringApi.getWorkflowMetrics().then(res => res.data),
  })

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['recent-runs'],
    queryFn: () => monitoringApi.getWorkflowRuns({ limit: 5 }).then(res => res.data),
  })

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Overview of your workflow automation platform
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Link
            to="/workflows/new"
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Workflow
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <GitBranch className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Workflows
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {metricsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (metrics?.totalRuns || 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Play className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Running
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {metricsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (metrics?.runningRuns || 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Completed
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {metricsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (metrics?.completedRuns || 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XCircle className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Failed
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {metricsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (metrics?.failedRuns || 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Recent Activity
            </h3>
            {runsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading recent activity...</span>
              </div>
            ) : runs?.runs?.length === 0 ? (
              <div className="text-center py-8">
                <GitBranch className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No workflow runs</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating your first workflow.</p>
                <div className="mt-6">
                  <Link
                    to="/workflows/new"
                    className="btn btn-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workflow
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flow-root">
                <ul className="-mb-8">
                  {runs?.runs?.map((run, runIdx) => (
                    <li key={run.id}>
                      <div className="relative pb-8">
                        {runIdx !== (runs.runs.length - 1) ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span
                              className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                run.status === 'COMPLETED'
                                  ? 'bg-green-500'
                                  : run.status === 'RUNNING'
                                  ? 'bg-blue-500'
                                  : run.status === 'FAILED'
                                  ? 'bg-red-500'
                                  : 'bg-gray-500'
                              }`}
                            >
                              {run.status === 'COMPLETED' ? (
                                <CheckCircle className="h-5 w-5 text-white" />
                              ) : run.status === 'RUNNING' ? (
                                <Clock className="h-5 w-5 text-white" />
                              ) : run.status === 'FAILED' ? (
                                <XCircle className="h-5 w-5 text-white" />
                              ) : (
                                <Play className="h-5 w-5 text-white" />
                              )}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                <span className="font-medium text-gray-900">
                                  Workflow Run {run.id.slice(0, 8)}
                                </span>{' '}
                                - {run.status.toLowerCase()}
                              </p>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              <time>{new Date(run.startedAt).toLocaleString()}</time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}