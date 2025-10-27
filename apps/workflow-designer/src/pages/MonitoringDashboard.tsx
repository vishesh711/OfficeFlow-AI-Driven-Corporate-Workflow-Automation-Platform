import { useState, useEffect } from 'react'
import { 
  Play, 
  RefreshCw, 
  Clock,
  TrendingUp,
  Activity,
  Sparkles,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import { monitoringApi, WorkflowRun, WorkflowMetrics, WorkflowRunFilter } from '../lib/api'

export function MonitoringDashboard() {
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([])
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null)
  const filter: WorkflowRunFilter = {
    limit: 50,
    offset: 0
  }
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [timeRange, setTimeRange] = useState('24h')

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [filter, timeRange])

  const loadData = async () => {
    try {
      const [runsResponse, metricsResponse] = await Promise.all([
        monitoringApi.getWorkflowRuns(filter),
        monitoringApi.getWorkflowMetrics(undefined, timeRange)
      ])
      
      setWorkflowRuns(runsResponse.data.runs)
      setMetrics(metricsResponse.data)
    } catch (error) {
      console.error('Failed to load monitoring data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRunAction = async (runId: string, action: 'pause' | 'resume' | 'cancel' | 'retry') => {
    try {
      await monitoringApi.controlWorkflowRun(runId, action)
      await loadData()
    } catch (error) {
      console.error(`Failed to ${action} workflow run:`, error)
    }
  }

  const handleRefresh = () => {
    setLoading(true)
    loadData()
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
                <Activity className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Monitoring</h1>
            </div>
            <p className="mt-2 text-sm text-gray-600 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Real-time workflow execution monitoring
            </p>
          </div>
          <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-6 py-2 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200 transform hover:scale-105"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="group bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-200 hover:border-blue-400 transition-all duration-200 hover:shadow-xl transform hover:-translate-y-1">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-2">
                  Total Runs
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {loading ? <Loader2 className="h-7 w-7 animate-spin text-gray-400" /> : (metrics?.totalRuns || 0)}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl group-hover:from-blue-100 group-hover:to-blue-200 transition-colors">
                <TrendingUp className="h-7 w-7 text-gray-600 group-hover:text-blue-600 transition-colors" />
              </div>
            </div>
          </div>
        </div>

        <div className="group bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-200 hover:border-blue-400 transition-all duration-200 hover:shadow-xl transform hover:-translate-y-1">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-2">
                  Running
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {loading ? <Loader2 className="h-7 w-7 animate-spin text-gray-400" /> : (metrics?.runningRuns || 0)}
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
                <p className="text-sm font-medium text-gray-500 mb-2">
                  Completed
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {loading ? <Loader2 className="h-7 w-7 animate-spin text-gray-400" /> : (metrics?.completedRuns || 0)}
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
                <p className="text-sm font-medium text-gray-500 mb-2">
                  Failed
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {loading ? <Loader2 className="h-7 w-7 animate-spin text-gray-400" /> : (metrics?.failedRuns || 0)}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-red-100 to-red-200 rounded-xl group-hover:from-red-200 group-hover:to-red-300 transition-colors">
                <XCircle className="h-7 w-7 text-red-600 group-hover:text-red-700 transition-colors" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white shadow-lg rounded-2xl border-2 border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            Performance Metrics
          </h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <p>Chart visualization coming soon</p>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-2xl border-2 border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Clock className="h-6 w-6 text-purple-600" />
            Execution Timeline
          </h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <p>Timeline visualization coming soon</p>
          </div>
        </div>
      </div>

      {/* Workflow Runs Table */}
      <div className="bg-white shadow-lg rounded-2xl border-2 border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Activity className="h-6 w-6 text-blue-600" />
          Recent Workflow Runs
        </h3>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : workflowRuns.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">No workflow runs yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Run ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workflowRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {run.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        run.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        run.status === 'RUNNING' ? 'bg-blue-100 text-blue-800' :
                        run.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(run.startedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => setSelectedRun(run)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
