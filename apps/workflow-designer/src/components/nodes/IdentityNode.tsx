import { NodeProps } from 'reactflow'
import { User } from 'lucide-react'
import { BaseNode } from './BaseNode'

export function IdentityNode({ data, selected }: NodeProps) {
  const action = data.params?.action || 'provision'
  const provider = data.params?.provider || 'google'
  
  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<User className="h-4 w-4" />}
      color="bg-purple-500"
    >
      <div>{action} account on {provider}</div>
    </BaseNode>
  )
}