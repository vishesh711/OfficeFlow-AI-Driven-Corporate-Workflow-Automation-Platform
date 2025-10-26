import { useState, useEffect } from 'react'
import { 
  Play, 
  RefreshCw, 
  Clock,
  Search,
  TrendingUp,
  Activity
} from 'lucide-react'
import { monitoringApi, WorkflowRun, WorkflowMetrics, WorkflowRunFilter } from '../lib/api'
import { WorkflowRunTimeline } from '../components/WorkflowRunTimeline.tsx'
import { WorkflowMetricsChart } from '../components/WorkflowMetricsChart.tsx'
import { WorkflowRunTable } from '../components/WorkflowRunTable.tsx'

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
      switch (action) {
        case 'pause':
          await monitoringApi.pauseWorkflowRun(runId)
          break
        case 'resume':
          await monitoringApi.resumeWorkflowRun(runId)
          break
        case 'cancel':
          await monitoringApi.cancelWorkflowRun(runId)
          break
        case 'retry':
          await monitoringApi.retryWorkflowRun(runId)
          break
      }
      loadData() // Refresh data after action
    } catch (error) {
      console.error(`Failed to ${action} workflow run:`, error)
    }
  }



  const filteredRuns = workflowRuns.filter(run => {
    const matchesSearch = searchTerm === '' || 
      run.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      run.context.employeeName?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(run.status)
    
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Workflow Monitoring</h1>
          <p className="mt-2 text-sm text-gray-700">
            Real-time monitoring and analytics for workflow executions
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            onClick={loadData}
            className="btn btn-secondary"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Overview */}
      {metrics && (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Runs
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">{metrics.totalRuns}</dd>
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
                    <dd className="text-lg font-medium text-gray-900">{metrics.runningRuns}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Success Rate
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {(metrics.successRate * 100).toFixed(1)}%
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
                  <Clock className="h-6 w-6 text-purple-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Avg. Execution Time
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {Math.round(metrics.averageExecutionTime / 1000)}s
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts and Analytics */}
      {metrics && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <WorkflowMetricsChart metrics={metrics} />
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Node Performance</h3>
            <div className="space-y-4">
              {metrics.nodePerformance.slice(0, 5).map((node) => (
                <div key={node.nodeId} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{node.nodeName}</p>
                    <p className="text-xs text-gray-500">{node.totalExecutions} executions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900">
                      {Math.round(node.averageExecutionTime / 1000)}s avg
                    </p>
                    <p className="text-xs text-gray-500">
                      {(node.successRate * 100).toFixed(1)}% success
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="mt-8 bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Search by run ID or employee name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <select
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              
              <div className="relative">
                <select
                  multiple
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(Array.from(e.target.selectedOptions, option => option.value))}
                >
                  <option value="PENDING">Pending</option>
                  <option value="RUNNING">Running</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="FAILED">Failed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Runs Table */}
      <div className="mt-8">
        <WorkflowRunTable 
          runs={filteredRuns}
          onSelectRun={setSelectedRun}
          onRunAction={handleRunAction}
        />
      </div>

      {/* Timeline Modal */}
      {selectedRun && (
        <WorkflowRunTimeline
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
        />
      )}
    </div>
  )
}