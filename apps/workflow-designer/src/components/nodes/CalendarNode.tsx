import { NodeProps } from 'reactflow';
import { Calendar } from 'lucide-react';
import { BaseNode } from './BaseNode';

export function CalendarNode({ data, selected }: NodeProps) {
  const action = data.params?.action || 'schedule_meeting';

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Calendar className="h-4 w-4" />}
      color="bg-teal-500"
    >
      <div>Action: {action.replace('_', ' ')}</div>
    </BaseNode>
  );
}
