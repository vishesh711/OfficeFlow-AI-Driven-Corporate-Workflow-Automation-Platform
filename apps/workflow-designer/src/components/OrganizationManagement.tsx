import React, { useState } from 'react';
import { Plus, Edit, Trash2, Building, Users, GitBranch } from 'lucide-react';
import { adminApi, Organization } from '../lib/api';

interface OrganizationManagementProps {
  organizations: Organization[];
  onOrganizationsChange: (organizations: Organization[]) => void;
}

export function OrganizationManagement({
  organizations,
  onOrganizationsChange,
}: OrganizationManagementProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateOrganization = async (
    orgData: Omit<Organization, 'id' | 'userCount' | 'workflowCount' | 'createdAt' | 'updatedAt'>
  ) => {
    setLoading(true);
    try {
      const response = await adminApi.createOrganization(orgData);
      onOrganizationsChange([...organizations, response.data]);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrganization = async (orgId: string, orgData: Partial<Organization>) => {
    setLoading(true);
    try {
      const response = await adminApi.updateOrganization(orgId, orgData);
      onOrganizationsChange(organizations.map((org) => (org.id === orgId ? response.data : org)));
      setEditingOrg(null);
    } catch (error) {
      console.error('Failed to update organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrganization = async (orgId: string) => {
    if (
      !confirm('Are you sure you want to delete this organization? This action cannot be undone.')
    )
      return;

    setLoading(true);
    try {
      await adminApi.deleteOrganization(orgId);
      onOrganizationsChange(organizations.filter((org) => org.id !== orgId));
    } catch (error) {
      console.error('Failed to delete organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'pro':
        return 'bg-blue-100 text-blue-800';
      case 'free':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h2 className="text-xl font-semibold text-gray-900">Organization Management</h2>
          <p className="mt-2 text-sm text-gray-700">Manage organizations and their settings</p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Organization
          </button>
        </div>
      </div>

      {/* Organizations Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {organizations.map((org) => (
          <div key={org.id} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Building className="h-8 w-8 text-gray-400" />
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">{org.name}</h3>
                  <p className="text-sm text-gray-500">{org.domain}</p>
                </div>
                <div className="flex-shrink-0">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPlanColor(org.plan)}`}
                  >
                    {org.plan}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="flex items-center">
                  <Users className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-900">{org.userCount} users</span>
                </div>
                <div className="flex items-center">
                  <GitBranch className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-900">{org.workflowCount} workflows</span>
                </div>
              </div>

              <div className="mt-6 flex justify-between items-center">
                <p className="text-xs text-gray-500">
                  Created {new Date(org.createdAt).toLocaleDateString()}
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingOrg(org)}
                    className="text-blue-600 hover:text-blue-900"
                    title="Edit Organization"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteOrganization(org.id)}
                    className="text-red-600 hover:text-red-900"
                    title="Delete Organization"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {organizations.length === 0 && (
        <div className="text-center py-12">
          <Building className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No organizations</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new organization.</p>
        </div>
      )}

      {/* Create/Edit Organization Modal */}
      {(showCreateModal || editingOrg) && (
        <OrganizationModal
          organization={editingOrg}
          onSave={
            editingOrg
              ? (orgData) => handleUpdateOrganization(editingOrg.id, orgData)
              : handleCreateOrganization
          }
          onClose={() => {
            setShowCreateModal(false);
            setEditingOrg(null);
          }}
          loading={loading}
        />
      )}
    </div>
  );
}

interface OrganizationModalProps {
  organization?: Organization | null;
  onSave: (orgData: any) => void;
  onClose: () => void;
  loading: boolean;
}

function OrganizationModal({ organization, onSave, onClose, loading }: OrganizationModalProps) {
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    domain: organization?.domain || '',
    plan: organization?.plan || 'free',
    settings: organization?.settings || {},
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {organization ? 'Edit Organization' : 'Create Organization'}
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
              <label className="block text-sm font-medium text-gray-700">Domain</label>
              <input
                type="text"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Plan</label>
              <select
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value as any })}
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
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
                {loading ? 'Saving...' : organization ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
