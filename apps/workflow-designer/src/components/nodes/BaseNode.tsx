import { ReactNode } from 'react'
import { Handle, Position } from 'reactflow'
import { cn } from '@/lib/utils'

interface BaseNodeProps {
  data: {
    label: string
    params?: Record<string, any>
  }
  selected?: boolean
  children?: ReactNode
  icon: ReactNode
  color?: string
  handles?: {
    top?: boolean
    bottom?: boolean
    left?: boolean
    right?: boolean
  }
}

export function BaseNode({ 
  data, 
  selected, 
  children, 
  icon, 
  color = 'bg-blue-500',
  handles = { top: true, bottom: true }
}: BaseNodeProps) {
  return (
    <div className={cn(
      "min-w-[220px] bg-white rounded-xl shadow-lg transition-all duration-200",
      "border-2 hover:shadow-xl",
      selected 
        ? "border-blue-500 shadow-blue-100 ring-2 ring-blue-200" 
        : "border-gray-200 hover:border-gray-300"
    )}>
      {handles.top && (
        <Handle
          type="target"
          position={Position.Top}
          className={cn(
            "w-3 h-3 !border-2 !bg-white transition-all",
            selected ? "!border-blue-500" : "!border-gray-400 hover:!border-blue-400"
          )}
        />
      )}
      
      <div className="p-4">
        <div className="flex items-center space-x-3 mb-3">
          <div className={cn(
            "p-2.5 rounded-lg text-white shadow-sm transition-transform hover:scale-105",
            color
          )}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
              {data.label}
            </h3>
          </div>
        </div>
        
        {children && (
          <div className="text-xs text-gray-600 mt-2 space-y-1 bg-gray-50 rounded-lg p-2.5 border border-gray-100">
            {children}
          </div>
        )}
      </div>
      
      {handles.bottom && (
        <Handle
          type="source"
          position={Position.Bottom}
          className={cn(
            "w-3 h-3 !border-2 !bg-white transition-all",
            selected ? "!border-blue-500" : "!border-gray-400 hover:!border-blue-400"
          )}
        />
      )}
      
      {handles.left && (
        <Handle
          type="target"
          position={Position.Left}
          className={cn(
            "w-3 h-3 !border-2 !bg-white transition-all",
            selected ? "!border-blue-500" : "!border-gray-400 hover:!border-blue-400"
          )}
        />
      )}
      
      {handles.right && (
        <Handle
          type="source"
          position={Position.Right}
          className={cn(
            "w-3 h-3 !border-2 !bg-white transition-all",
            selected ? "!border-blue-500" : "!border-gray-400 hover:!border-blue-400"
          )}
        />
      )}
    </div>
  )
}