import { NodeProps } from 'reactflow'
import { Clock } from 'lucide-react'
import { BaseNode } from './BaseNode'

export function ScheduleNode({ data, selected }: NodeProps) {
  const schedule = data.params?.schedule || '0 9 * * 1'
  
  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Clock className="h-4 w-4" />}
      color="bg-cyan-500"
      handles={{ bottom: true }}
    >
      <div>Cron: {schedule}</div>
    </BaseNode>
  )
}