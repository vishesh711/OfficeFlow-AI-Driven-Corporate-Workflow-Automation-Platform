import { NodeProps } from 'reactflow';
import { FileText } from 'lucide-react';
import { BaseNode } from './BaseNode';

export function DocumentNode({ data, selected }: NodeProps) {
  const action = data.params?.action || 'distribute';
  const documentType = data.params?.documentType || 'handbook';

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<FileText className="h-4 w-4" />}
      color="bg-gray-500"
    >
      <div>Action: {action}</div>
      <div>Type: {documentType}</div>
    </BaseNode>
  );
}
