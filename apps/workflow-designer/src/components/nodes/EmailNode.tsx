import { NodeProps } from 'reactflow'
import { Mail } from 'lucide-react'
import { BaseNode } from './BaseNode'

export function EmailNode({ data, selected }: NodeProps) {
  const template = data.params?.template || 'welcome'
  const recipients = data.params?.recipients || '{{employee.email}}'
  
  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Mail className="h-4 w-4" />}
      color="bg-blue-500"
    >
      <div>Template: {template}</div>
      <div>To: {recipients}</div>
    </BaseNode>
  )
}