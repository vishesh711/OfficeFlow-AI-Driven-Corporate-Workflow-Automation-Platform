import { useCallback } from 'react'
import { useReactFlow } from 'reactflow'
import { 
  User, 
  Mail, 
  Calendar, 
  MessageSquare, 
  FileText, 
  Brain,
  Play,
  GitBranch,
  Clock,
  Zap
} from 'lucide-react'
import { useWorkflowStore } from '@/store/workflow'

const nodeCategories = [
  {
    name: 'Triggers',
    nodes: [
      {
        type: 'trigger',
        label: 'Event Trigger',
        icon: Zap,
        description: 'Start workflow on lifecycle events',
      },
      {
        type: 'schedule',
        label: 'Schedule',
        icon: Clock,
        description: 'Time-based workflow trigger',
      },
    ],
  },
  {
    name: 'Identity & Access',
    nodes: [
      {
        type: 'identity',
        label: 'Identity Service',
        icon: User,
        description: 'Provision/deprovision accounts',
      },
    ],
  },
  {
    name: 'Communication',
    nodes: [
      {
        type: 'email',
        label: 'Email',
        icon: Mail,
        description: 'Send personalized emails',
      },
      {
        type: 'slack',
        label: 'Slack',
        icon: MessageSquare,
        description: 'Send Slack messages',
      },
      {
        type: 'calendar',
        label: 'Calendar',
        icon: Calendar,
        description: 'Schedule meetings',
      },
    ],
  },
  {
    name: 'Documents & AI',
    nodes: [
      {
        type: 'document',
        label: 'Document',
        icon: FileText,
        description: 'Distribute documents',
      },
      {
        type: 'ai',
        label: 'AI Content',
        icon: Brain,
        description: 'Generate personalized content',
      },
    ],
  },
  {
    name: 'Flow Control',
    nodes: [
      {
        type: 'condition',
        label: 'Condition',
        icon: GitBranch,
        description: 'Conditional branching',
      },
      {
        type: 'delay',
        label: 'Delay',
        icon: Clock,
        description: 'Wait before continuing',
      },
    ],
  },
]

export function NodeSidebar() {
  const { addNode } = useWorkflowStore()

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.setData('application/nodelabel', label)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleAddNode = useCallback((nodeType: string, label: string) => {
    // Add node at a default position when clicked (not dragged)
    const newNode = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label,
        params: getDefaultParams(nodeType),
        retryPolicy: {
          maxRetries: 3,
          backoffMs: 1000,
        },
        timeoutMs: 300000,
      },
    }

    addNode(newNode)
  }, [addNode])

  const getDefaultParams = (nodeType: string): Record<string, any> => {
    switch (nodeType) {
      case 'trigger':
        return { eventType: 'employee.onboard' }
      case 'identity':
        return { action: 'provision', provider: 'google' }
      case 'email':
        return { template: 'welcome', recipients: '{{employee.email}}' }
      case 'ai':
        return { contentType: 'welcome_message' }
      case 'condition':
        return { expression: '{{employee.department}} === "Engineering"' }
      case 'delay':
        return { duration: 1, unit: 'hours' }
      case 'calendar':
        return { action: 'schedule_meeting' }
      case 'slack':
        return { action: 'send_message', channel: '#general' }
      case 'document':
        return { action: 'distribute', documentType: 'handbook' }
      case 'schedule':
        return { schedule: '0 9 * * 1' }
      default:
        return {}
    }
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Node Library</h2>
        
        <div className="space-y-6">
          {nodeCategories.map((category) => (
            <div key={category.name}>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                {category.name}
              </h3>
              <div className="space-y-2">
                {category.nodes.map((node) => (
                  <div
                    key={node.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, node.type, node.label)}
                    onClick={() => handleAddNode(node.type, node.label)}
                    className="flex items-start p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-move hover:bg-gray-100 transition-colors"
                    title={`Drag to canvas or click to add ${node.label}`}
                  >
                    <div className="flex-shrink-0 mr-3">
                      <node.icon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {node.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {node.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}