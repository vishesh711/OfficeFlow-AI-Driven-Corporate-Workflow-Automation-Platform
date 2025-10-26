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
      "min-w-[200px] bg-white border-2 rounded-lg shadow-sm",
      selected ? "border-primary-500" : "border-gray-200"
    )}>
      {handles.top && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 border-2 border-gray-400 bg-white"
        />
      )}
      
      <div className="p-3">
        <div className="flex items-center space-x-3 mb-2">
          <div className={cn("p-2 rounded-lg text-white", color)}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">{data.label}</h3>
          </div>
        </div>
        
        {children && (
          <div className="text-xs text-gray-500 mt-2">
            {children}
          </div>
        )}
      </div>
      
      {handles.bottom && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 border-2 border-gray-400 bg-white"
        />
      )}
      
      {handles.left && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 border-2 border-gray-400 bg-white"
        />
      )}
      
      {handles.right && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 border-2 border-gray-400 bg-white"
        />
      )}
    </div>
  )
}