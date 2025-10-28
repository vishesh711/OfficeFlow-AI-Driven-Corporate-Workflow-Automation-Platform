import { Link } from 'react-router-dom';
import {
  Plus,
  GitBranch,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { monitoringApi } from '@/lib/api';

export function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => monitoringApi.getWorkflowMetrics().then((res) => res.data),
  });

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['recent-runs'],
    queryFn: () => monitoringApi.getWorkflowRuns({ limit: 5 }).then((res) => res.data),
  });

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
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            </div>
            <p className="mt-2 text-sm text-gray-600 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Overview of your workflow automation platform
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

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="group bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-200 hover:border-blue-400 transition-all duration-200 hover:shadow-xl transform hover:-translate-y-1">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-2">Total Workflows</p>
                <p className="text-3xl font-bold text-gray-900">
                  {metricsLoading ? (
                    <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
                  ) : (
                    metrics?.totalRuns || 0
                  )}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl group-hover:from-blue-100 group-hover:to-blue-200 transition-colors">
                <GitBranch className="h-7 w-7 text-gray-600 group-hover:text-blue-600 transition-colors" />
              </div>
            </div>
          </div>
        </div>

        <div className="group bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-200 hover:border-blue-400 transition-all duration-200 hover:shadow-xl transform hover:-translate-y-1">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-2">Running</p>
                <p className="text-3xl font-bold text-gray-900">
                  {metricsLoading ? (
                    <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
                  ) : (
                    metrics?.runningRuns || 0
                  )}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl group-hover:from-blue-200 group-hover:to-blue-300 transition-colors">
                <Play className="h-7 w-7 text-blue-600 group-hover:text-blue-700 transition-colors" />
              </div>
            </div>
          </div>
        </div>

        <div className="group bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-200 hover:border-green-400 transition-all duration-200 hover:shadow-xl transform hover:-translate-y-1">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-2">Completed</p>
                <p className="text-3xl font-bold text-gray-900">
                  {metricsLoading ? (
                    <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
                  ) : (
                    metrics?.completedRuns || 0
                  )}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-green-100 to-green-200 rounded-xl group-hover:from-green-200 group-hover:to-green-300 transition-colors">
                <CheckCircle className="h-7 w-7 text-green-600 group-hover:text-green-700 transition-colors" />
              </div>
            </div>
          </div>
        </div>

        <div className="group bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-200 hover:border-red-400 transition-all duration-200 hover:shadow-xl transform hover:-translate-y-1">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-2">Failed</p>
                <p className="text-3xl font-bold text-gray-900">
                  {metricsLoading ? (
                    <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
                  ) : (
                    metrics?.failedRuns || 0
                  )}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-red-100 to-red-200 rounded-xl group-hover:from-red-200 group-hover:to-red-300 transition-colors">
                <XCircle className="h-7 w-7 text-red-600 group-hover:text-red-700 transition-colors" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <div className="bg-white shadow-lg rounded-2xl border-2 border-gray-200">
          <div className="px-6 py-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Clock className="h-6 w-6 text-blue-600" />
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
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating your first workflow.
                </p>
                <div className="mt-6">
                  <Link to="/workflows/new" className="btn btn-primary">
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
                        {runIdx !== runs.runs.length - 1 ? (
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
  );
}
