import { WorkflowMetrics } from '../lib/api'

interface WorkflowMetricsChartProps {
  metrics: WorkflowMetrics
}

export function WorkflowMetricsChart({ metrics }: WorkflowMetricsChartProps) {
  const maxCount = Math.max(...metrics.runsByDay.map(d => d.count))
  
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Workflow Runs Over Time</h3>
      
      {/* Simple bar chart */}
      <div className="space-y-3">
        {metrics.runsByDay.slice(-7).map((day) => (
          <div key={day.date} className="flex items-center">
            <div className="w-16 text-xs text-gray-500">
              {new Date(day.date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
            <div className="flex-1 ml-4">
              <div className="flex items-center">
                <div 
                  className="bg-blue-500 h-4 rounded"
                  style={{ 
                    width: `${maxCount > 0 ? (day.count / maxCount) * 100 : 0}%`,
                    minWidth: day.count > 0 ? '4px' : '0px'
                  }}
                />
                <span className="ml-2 text-sm text-gray-900">{day.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Status breakdown */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Status Breakdown</h4>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(metrics.runsByStatus).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 capitalize">{status.toLowerCase()}</span>
              <span className="text-sm font-medium text-gray-900">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}