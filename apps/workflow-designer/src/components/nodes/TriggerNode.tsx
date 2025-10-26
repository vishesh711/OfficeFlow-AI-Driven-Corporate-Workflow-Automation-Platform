import { NodeProps } from 'reactflow'
import { Zap } from 'lucide-react'
import { BaseNode } from './BaseNode'

export function TriggerNode({ data, selected }: NodeProps) {
  const eventType = data.params?.eventType || 'employee.onboard'
  
  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Zap className="h-4 w-4" />}
      color="bg-green-500"
      handles={{ bottom: true }}
    >
      <div>Event: {eventType}</div>
    </BaseNode>
  )
}