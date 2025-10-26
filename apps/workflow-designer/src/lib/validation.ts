import { Node, Edge } from 'reactflow'

export interface ValidationError {
  id: string
  type: 'error' | 'warning'
  message: string
  nodeId?: string
  edgeId?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

export function validateWorkflow(nodes: Node[], edges: Edge[]): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Check for at least one trigger node
  const triggerNodes = nodes.filter(node => node.type === 'trigger' || node.type === 'schedule')
  if (triggerNodes.length === 0) {
    errors.push({
      id: 'no-trigger',
      type: 'error',
      message: 'Workflow must have at least one trigger node (Event Trigger or Schedule)',
    })
  }

  // Check for multiple trigger nodes (warning)
  if (triggerNodes.length > 1) {
    warnings.push({
      id: 'multiple-triggers',
      type: 'warning',
      message: 'Multiple trigger nodes detected. Only one will be active at a time.',
    })
  }

  // Check for orphaned nodes
  const connectedNodeIds = new Set([
    ...edges.map(edge => edge.source),
    ...edges.map(edge => edge.target)
  ])

  const orphanedNodes = nodes.filter(node => 
    !connectedNodeIds.has(node.id) && 
    node.type !== 'trigger' && 
    node.type !== 'schedule'
  )

  orphanedNodes.forEach(node => {
    warnings.push({
      id: `orphaned-${node.id}`,
      type: 'warning',
      message: `Node "${node.data.label}" is not connected to the workflow`,
      nodeId: node.id,
    })
  })

  // Check for circular dependencies
  const hasCycle = detectCycles(nodes, edges)
  if (hasCycle.length > 0) {
    hasCycle.forEach(cycle => {
      errors.push({
        id: `cycle-${cycle.join('-')}`,
        type: 'error',
        message: `Circular dependency detected: ${cycle.map(id => {
          const node = nodes.find(n => n.id === id)
          return node?.data.label || id
        }).join(' → ')}`,
      })
    })
  }

  // Validate individual nodes
  nodes.forEach(node => {
    const nodeErrors = validateNode(node)
    errors.push(...nodeErrors.filter(e => e.type === 'error'))
    warnings.push(...nodeErrors.filter(e => e.type === 'warning'))
  })

  // Check for unreachable nodes
  const reachableNodes = findReachableNodes(nodes, edges, triggerNodes)
  const unreachableNodes = nodes.filter(node => 
    !reachableNodes.has(node.id) && 
    node.type !== 'trigger' && 
    node.type !== 'schedule'
  )

  unreachableNodes.forEach(node => {
    warnings.push({
      id: `unreachable-${node.id}`,
      type: 'warning',
      message: `Node "${node.data.label}" is not reachable from any trigger`,
      nodeId: node.id,
    })
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

function validateNode(node: Node): ValidationError[] {
  const errors: ValidationError[] = []
  const { type, data } = node

  // Common validations
  if (!data.label || data.label.trim() === '') {
    errors.push({
      id: `empty-label-${node.id}`,
      type: 'warning',
      message: `Node "${node.id}" has no label`,
      nodeId: node.id,
    })
  }

  // Type-specific validations
  switch (type) {
    case 'email':
      if (!data.params?.recipients) {
        errors.push({
          id: `email-no-recipients-${node.id}`,
          type: 'error',
          message: `Email node "${data.label}" has no recipients configured`,
          nodeId: node.id,
        })
      }
      if (!data.params?.template) {
        errors.push({
          id: `email-no-template-${node.id}`,
          type: 'error',
          message: `Email node "${data.label}" has no template selected`,
          nodeId: node.id,
        })
      }
      break

    case 'condition':
      if (!data.params?.expression) {
        errors.push({
          id: `condition-no-expression-${node.id}`,
          type: 'error',
          message: `Condition node "${data.label}" has no expression configured`,
          nodeId: node.id,
        })
      }
      break

    case 'delay':
      if (!data.params?.duration || data.params.duration < 1) {
        errors.push({
          id: `delay-invalid-duration-${node.id}`,
          type: 'error',
          message: `Delay node "${data.label}" has invalid duration`,
          nodeId: node.id,
        })
      }
      break

    case 'identity':
      if (!data.params?.action) {
        errors.push({
          id: `identity-no-action-${node.id}`,
          type: 'error',
          message: `Identity node "${data.label}" has no action configured`,
          nodeId: node.id,
        })
      }
      if (!data.params?.provider) {
        errors.push({
          id: `identity-no-provider-${node.id}`,
          type: 'error',
          message: `Identity node "${data.label}" has no provider configured`,
          nodeId: node.id,
        })
      }
      break

    case 'ai':
      if (!data.params?.contentType) {
        errors.push({
          id: `ai-no-content-type-${node.id}`,
          type: 'error',
          message: `AI node "${data.label}" has no content type configured`,
          nodeId: node.id,
        })
      }
      if (data.params?.contentType === 'custom' && !data.params?.prompt) {
        errors.push({
          id: `ai-no-custom-prompt-${node.id}`,
          type: 'error',
          message: `AI node "${data.label}" requires a custom prompt`,
          nodeId: node.id,
        })
      }
      break
  }

  // Validate retry policy
  if (data.retryPolicy) {
    if (data.retryPolicy.maxRetries < 0 || data.retryPolicy.maxRetries > 10) {
      errors.push({
        id: `retry-invalid-max-${node.id}`,
        type: 'warning',
        message: `Node "${data.label}" has invalid max retries (should be 0-10)`,
        nodeId: node.id,
      })
    }
    if (data.retryPolicy.backoffMs < 100) {
      errors.push({
        id: `retry-invalid-backoff-${node.id}`,
        type: 'warning',
        message: `Node "${data.label}" has invalid backoff time (should be at least 100ms)`,
        nodeId: node.id,
      })
    }
  }

  // Validate timeout
  if (data.timeoutMs && data.timeoutMs < 1000) {
    errors.push({
      id: `timeout-too-short-${node.id}`,
      type: 'warning',
      message: `Node "${data.label}" has very short timeout (less than 1 second)`,
      nodeId: node.id,
    })
  }

  return errors
}

function detectCycles(nodes: Node[], edges: Edge[]): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  const dfs = (nodeId: string): boolean => {
    if (recursionStack.has(nodeId)) {
      // Found a cycle
      const cycleStart = path.indexOf(nodeId)
      cycles.push([...path.slice(cycleStart), nodeId])
      return true
    }

    if (visited.has(nodeId)) {
      return false
    }

    visited.add(nodeId)
    recursionStack.add(nodeId)
    path.push(nodeId)

    const outgoingEdges = edges.filter(edge => edge.source === nodeId)
    for (const edge of outgoingEdges) {
      if (dfs(edge.target)) {
        return true
      }
    }

    recursionStack.delete(nodeId)
    path.pop()
    return false
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id)
    }
  }

  return cycles
}

function findReachableNodes(nodes: Node[], edges: Edge[], triggerNodes: Node[]): Set<string> {
  const reachable = new Set<string>()
  const queue = [...triggerNodes.map(n => n.id)]

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (reachable.has(nodeId)) continue

    reachable.add(nodeId)

    const outgoingEdges = edges.filter(edge => edge.source === nodeId)
    for (const edge of outgoingEdges) {
      if (!reachable.has(edge.target)) {
        queue.push(edge.target)
      }
    }
  }

  return reachable
}