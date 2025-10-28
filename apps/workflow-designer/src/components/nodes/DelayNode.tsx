import { NodeProps } from 'reactflow';
import { Clock } from 'lucide-react';
import { BaseNode } from './BaseNode';

export function DelayNode({ data, selected }: NodeProps) {
  const duration = data.params?.duration || 1;
  const unit = data.params?.unit || 'hours';

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Clock className="h-4 w-4" />}
      color="bg-orange-500"
    >
      <div>
        Wait: {duration} {unit}
      </div>
    </BaseNode>
  );
}
