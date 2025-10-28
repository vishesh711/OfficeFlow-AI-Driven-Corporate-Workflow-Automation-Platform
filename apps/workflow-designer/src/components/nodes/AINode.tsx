import { NodeProps } from 'reactflow';
import { Brain } from 'lucide-react';
import { BaseNode } from './BaseNode';

export function AINode({ data, selected }: NodeProps) {
  const contentType = data.params?.contentType || 'welcome_message';

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Brain className="h-4 w-4" />}
      color="bg-indigo-500"
    >
      <div>Generate: {contentType.replace('_', ' ')}</div>
    </BaseNode>
  );
}
