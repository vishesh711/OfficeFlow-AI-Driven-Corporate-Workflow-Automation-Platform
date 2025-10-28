import { NodeProps, Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';
import { BaseNode } from './BaseNode';

export function ConditionNode({ data, selected }: NodeProps) {
  const expression = data.params?.expression || 'condition';

  return (
    <div className="relative">
      <BaseNode
        data={data}
        selected={selected}
        icon={<GitBranch className="h-4 w-4" />}
        color="bg-yellow-500"
        handles={{ top: true }}
      >
        <div>If: {expression}</div>
      </BaseNode>

      {/* Custom handles for true/false branches */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: '25%' }}
        className="w-3 h-3 border-2 border-green-400 bg-green-100"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: '75%' }}
        className="w-3 h-3 border-2 border-red-400 bg-red-100"
      />

      {/* Labels for branches */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-4">
        <span className="text-xs text-green-600 font-medium">True</span>
        <span className="text-xs text-red-600 font-medium">False</span>
      </div>
    </div>
  );
}
