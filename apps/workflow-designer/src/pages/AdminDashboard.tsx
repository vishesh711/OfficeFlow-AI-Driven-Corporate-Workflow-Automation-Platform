import { useState, useEffect } from 'react'
import { 
  Users, 
  Building, 
  Key, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,

  Shield,
  Activity,
  Database,
  Server
} from 'lucide-react'
import { adminApi, monitoringApi, User, Organization, IntegrationCredential, SystemHealth } from '../lib/api'
import { UserManagement } from '../components/UserManagement.tsx'
import { OrganizationManagement } from '../components/OrganizationManagement.tsx'
import { IntegrationManagement } from '../components/IntegrationManagement.tsx'
import { AuditLogViewer } from '../components/AuditLogViewer.tsx'
import { SystemHealthDashboard } from '../components/SystemHealthDashboard.tsx'

type AdminTab = 'overview' | 'users' | 'organizations' | 'integrations' | 'audit' | 'health'

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [users, setUsers] = useState<User[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [integrations, setIntegrations] = useState<IntegrationCredential[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOverviewData()
  }, [])

  const loadOverviewData = async () => {
    try {
      const [usersResponse, orgsResponse, integrationsResponse, healthResponse] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getOrganizations(),
        adminApi.getIntegrationCredentials(),
        monitoringApi.getSystemHealth()
      ])
      
      setUsers(usersResponse.data)
      setOrganizations(orgsResponse.data)
      setIntegrations(integrationsResponse.data)
      setSystemHealth(healthResponse.data)
    } catch (error) {
      console.error('Failed to load admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500'
      case 'degraded':
        return 'text-yellow-500'
      case 'unhealthy':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />
    }
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: Activity },
    { id: 'users', name: 'Users', icon: Users },
    { id: 'organizations', name: 'Organizations', icon: Building },
    { id: 'integrations', name: 'Integrations', icon: Key },
    { id: 'audit', name: 'Audit Logs', icon: FileText },
    { id: 'health', name: 'System Health', icon: Shield },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">System Administration</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage users, organizations, integrations, and system health
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mt-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* System Stats */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-6 w-6 text-blue-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Users
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">{users.length}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Building className="h-6 w-6 text-green-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Organizations
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">{organizations.length}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Key className="h-6 w-6 text-purple-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Integrations
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {integrations.filter(i => i.isActive).length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {systemHealth && getHealthStatusIcon(systemHealth.database.status)}
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          System Health
                        </dt>
                        <dd className={`text-lg font-medium capitalize ${
                          systemHealth ? getHealthStatusColor(systemHealth.database.status) : 'text-gray-900'
                        }`}>
                          {systemHealth?.database.status || 'Unknown'}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* System Health Overview */}
            {systemHealth && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    System Components
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <Database className="h-8 w-8 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Database</p>
                          <p className="text-xs text-gray-500">
                            {systemHealth.database.connections} connections
                          </p>
                        </div>
                      </div>
                      {getHealthStatusIcon(systemHealth.database.status)}
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <Server className="h-8 w-8 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Redis</p>
                          <p className="text-xs text-gray-500">
                            {systemHealth.redis.connections} connections
                          </p>
                        </div>
                      </div>
                      {getHealthStatusIcon(systemHealth.redis.status)}
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <Activity className="h-8 w-8 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Kafka</p>
                          <p className="text-xs text-gray-500">
                            {systemHealth.kafka.topics.length} topics
                          </p>
                        </div>
                      </div>
                      {getHealthStatusIcon(systemHealth.kafka.status)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Organizations */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Recent Organizations
                </h3>
                <div className="space-y-3">
                  {organizations.slice(0, 5).map((org) => (
                    <div key={org.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{org.name}</p>
                        <p className="text-xs text-gray-500">
                          {org.userCount} users • {org.workflowCount} workflows
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        org.plan === 'enterprise' 
                          ? 'bg-purple-100 text-purple-800'
                          : org.plan === 'pro'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {org.plan}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <UserManagement users={users} onUsersChange={setUsers} />
        )}

        {activeTab === 'organizations' && (
          <OrganizationManagement organizations={organizations} onOrganizationsChange={setOrganizations} />
        )}

        {activeTab === 'integrations' && (
          <IntegrationManagement integrations={integrations} onIntegrationsChange={setIntegrations} />
        )}

        {activeTab === 'audit' && (
          <AuditLogViewer />
        )}

        {activeTab === 'health' && systemHealth && (
          <SystemHealthDashboard health={systemHealth} />
        )}
      </div>
    </div>
  )
}