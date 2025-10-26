import { useState, useCallback } from 'react'
import { Search, X, Copy, Eye, Tag } from 'lucide-react'
import { workflowTemplates, getTemplatesByCategory, searchTemplates, WorkflowTemplate } from '@/lib/templates'
import { useWorkflowStore } from '@/store/workflow'

interface TemplateGalleryProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: WorkflowTemplate) => void
}

export function TemplateGallery({ isOpen, onClose, onSelectTemplate }: TemplateGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [previewTemplate, setPreviewTemplate] = useState<WorkflowTemplate | null>(null)

  const categories = getTemplatesByCategory()
  const categoryNames = ['all', ...Object.keys(categories)]

  const filteredTemplates = useCallback(() => {
    let templates = searchQuery ? searchTemplates(searchQuery) : workflowTemplates
    
    if (selectedCategory !== 'all') {
      templates = templates.filter(template => template.category === selectedCategory)
    }
    
    return templates
  }, [searchQuery, selectedCategory])

  const handleUseTemplate = useCallback((template: WorkflowTemplate) => {
    onSelectTemplate(template)
    onClose()
  }, [onSelectTemplate, onClose])

  const handlePreview = useCallback((template: WorkflowTemplate) => {
    setPreviewTemplate(template)
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Workflow Templates</h2>
              <p className="text-sm text-gray-500 mt-1">
                Choose from pre-built templates to get started quickly
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex h-[calc(90vh-120px)]">
            {/* Sidebar */}
            <div className="w-64 border-r border-gray-200 p-4">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input w-full pl-10"
                />
              </div>

              {/* Categories */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Categories</h3>
                <div className="space-y-1">
                  {categoryNames.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        selectedCategory === category
                          ? 'bg-primary-100 text-primary-900'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {category === 'all' ? 'All Templates' : category}
                      <span className="ml-2 text-xs text-gray-400">
                        ({category === 'all' ? workflowTemplates.length : categories[category]?.length || 0})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
              {previewTemplate ? (
                /* Template Preview */
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setPreviewTemplate(null)}
                      className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                    >
                      ← Back to templates
                    </button>
                    <button
                      onClick={() => handleUseTemplate(previewTemplate)}
                      className="btn btn-primary"
                    >
                      Use This Template
                    </button>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {previewTemplate.name}
                    </h3>
                    <p className="text-gray-600 mb-4">{previewTemplate.description}</p>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {previewTemplate.category}
                      </span>
                      <div className="flex items-center space-x-1">
                        <Tag className="h-4 w-4" />
                        <span>{previewTemplate.tags.join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Template Structure */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Template Structure</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Nodes: </span>
                        <span className="text-sm text-gray-600">
                          {previewTemplate.definition.nodes.length} nodes
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Connections: </span>
                        <span className="text-sm text-gray-600">
                          {previewTemplate.definition.edges.length} connections
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Node Types: </span>
                        <span className="text-sm text-gray-600">
                          {Array.from(new Set(previewTemplate.definition.nodes.map(n => n.type))).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Template Grid */
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates().map((template) => (
                      <div
                        key={template.id}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900 mb-1">
                              {template.name}
                            </h3>
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {template.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                          <span className="bg-gray-100 px-2 py-1 rounded">
                            {template.category}
                          </span>
                          <span>
                            {template.definition.nodes.length} nodes
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-3">
                          {template.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {tag}
                            </span>
                          ))}
                          {template.tags.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{template.tags.length - 3} more
                            </span>
                          )}
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={() => handlePreview(template)}
                            className="flex-1 btn btn-outline text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Preview
                          </button>
                          <button
                            onClick={() => handleUseTemplate(template)}
                            className="flex-1 btn btn-primary text-xs"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Use Template
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredTemplates().length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-4">
                        <Search className="h-12 w-12 mx-auto" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No templates found
                      </h3>
                      <p className="text-gray-500">
                        Try adjusting your search or category filter
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}