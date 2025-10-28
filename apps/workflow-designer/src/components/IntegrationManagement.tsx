import React, { useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Key,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TestTube,
} from 'lucide-react';
import { adminApi, IntegrationCredential } from '../lib/api';

interface IntegrationManagementProps {
  integrations: IntegrationCredential[];
  onIntegrationsChange: (integrations: IntegrationCredential[]) => void;
}

export function IntegrationManagement({
  integrations,
  onIntegrationsChange,
}: IntegrationManagementProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<IntegrationCredential | null>(null);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleCreateIntegration = async (
    integrationData: Omit<IntegrationCredential, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    setLoading(true);
    try {
      const response = await adminApi.createIntegrationCredential(integrationData);
      onIntegrationsChange([...integrations, response.data]);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateIntegration = async (
    integrationId: string,
    integrationData: Partial<IntegrationCredential>
  ) => {
    setLoading(true);
    try {
      const response = await adminApi.updateIntegrationCredential(integrationId, integrationData);
      onIntegrationsChange(
        integrations.map((integration) =>
          integration.id === integrationId ? response.data : integration
        )
      );
      setEditingIntegration(null);
    } catch (error) {
      console.error('Failed to update integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;

    setLoading(true);
    try {
      await adminApi.deleteIntegrationCredential(integrationId);
      onIntegrationsChange(integrations.filter((integration) => integration.id !== integrationId));
    } catch (error) {
      console.error('Failed to delete integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestIntegration = async (integrationId: string) => {
    setTestingId(integrationId);
    try {
      const response = await adminApi.testIntegrationCredential(integrationId);
      if (response.data.success) {
        alert('Integration test successful!');
      } else {
        alert(`Integration test failed: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Failed to test integration:', error);
      alert('Integration test failed');
    } finally {
      setTestingId(null);
    }
  };

  const getProviderIcon = () => {
    // In a real app, you'd have specific icons for each provider
    return <Key className="h-5 w-5 text-gray-400" />;
  };

  const getStatusIcon = (isActive: boolean, expiresAt?: string) => {
    if (!isActive) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }

    if (expiresAt && new Date(expiresAt) < new Date()) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }

    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusColor = (isActive: boolean, expiresAt?: string) => {
    if (!isActive) {
      return 'bg-red-100 text-red-800';
    }

    if (expiresAt && new Date(expiresAt) < new Date()) {
      return 'bg-yellow-100 text-yellow-800';
    }

    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (isActive: boolean, expiresAt?: string) => {
    if (!isActive) return 'Inactive';
    if (expiresAt && new Date(expiresAt) < new Date()) return 'Expired';
    return 'Active';
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h2 className="text-xl font-semibold text-gray-900">Integration Management</h2>
          <p className="mt-2 text-sm text-gray-700">
            Manage API credentials and integrations with external services
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </button>
        </div>
      </div>

      {/* Integrations Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Integration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Used
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {integrations.map((integration) => (
              <tr key={integration.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">{getProviderIcon()}</div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{integration.name}</div>
                      <div className="text-sm text-gray-500">{integration.organizationId}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                  {integration.provider.replace('_', ' ')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {integration.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(integration.isActive, integration.expiresAt)}`}
                  >
                    {getStatusIcon(integration.isActive, integration.expiresAt)}
                    <span className="ml-1">
                      {getStatusText(integration.isActive, integration.expiresAt)}
                    </span>
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {integration.lastUsed
                    ? new Date(integration.lastUsed).toLocaleDateString()
                    : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleTestIntegration(integration.id)}
                      className="text-green-600 hover:text-green-900"
                      title="Test Integration"
                      disabled={testingId === integration.id}
                    >
                      <TestTube
                        className={`h-4 w-4 ${testingId === integration.id ? 'animate-pulse' : ''}`}
                      />
                    </button>
                    <button
                      onClick={() => setEditingIntegration(integration)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Edit Integration"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteIntegration(integration.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete Integration"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {integrations.length === 0 && (
          <div className="text-center py-8">
            <Key className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No integrations</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding a new integration.</p>
          </div>
        )}
      </div>

      {/* Create/Edit Integration Modal */}
      {(showCreateModal || editingIntegration) && (
        <IntegrationModal
          integration={editingIntegration}
          onSave={
            editingIntegration
              ? (integrationData) => handleUpdateIntegration(editingIntegration.id, integrationData)
              : handleCreateIntegration
          }
          onClose={() => {
            setShowCreateModal(false);
            setEditingIntegration(null);
          }}
          loading={loading}
        />
      )}
    </div>
  );
}

interface IntegrationModalProps {
  integration?: IntegrationCredential | null;
  onSave: (integrationData: any) => void;
  onClose: () => void;
  loading: boolean;
}

function IntegrationModal({ integration, onSave, onClose, loading }: IntegrationModalProps) {
  const [formData, setFormData] = useState({
    name: integration?.name || '',
    provider: integration?.provider || 'google_workspace',
    type: integration?.type || 'oauth2',
    organizationId: integration?.organizationId || '',
    isActive: integration?.isActive ?? true,
    expiresAt: integration?.expiresAt || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const providers = [
    'google_workspace',
    'office_365',
    'okta',
    'slack',
    'workday',
    'bamboohr',
    'successfactors',
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {integration ? 'Edit Integration' : 'Create Integration'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Provider</label>
              <select
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              >
                {providers.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              >
                <option value="oauth2">OAuth2</option>
                <option value="api_key">API Key</option>
                <option value="basic_auth">Basic Auth</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Organization ID</label>
              <input
                type="text"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.organizationId}
                onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Expires At (Optional)
              </label>
              <input
                type="datetime-local"
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                Active
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : integration ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
