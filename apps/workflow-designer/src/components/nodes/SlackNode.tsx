import { NodeProps } from 'reactflow';
import { MessageSquare } from 'lucide-react';
import { BaseNode } from './BaseNode';

export function SlackNode({ data, selected }: NodeProps) {
  const action = data.params?.action || 'send_message';
  const channel = data.params?.channel || '#general';

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<MessageSquare className="h-4 w-4" />}
      color="bg-pink-500"
    >
      <div>Action: {action.replace('_', ' ')}</div>
      <div>Channel: {channel}</div>
    </BaseNode>
  );
}
