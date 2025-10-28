import {
  Database,
  Server,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Network,
} from 'lucide-react';
import { SystemHealth } from '../lib/api';

interface SystemHealthDashboardProps {
  health: SystemHealth;
}

export function SystemHealthDashboard({ health }: SystemHealthDashboardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">System Health Dashboard</h2>
        <p className="mt-2 text-sm text-gray-700">
          Real-time monitoring of system components and infrastructure
        </p>
      </div>

      {/* Overall System Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-blue-500 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">Database</h3>
                <p className="text-sm text-gray-500">PostgreSQL</p>
              </div>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health.database.status)}`}
            >
              {getStatusIcon(health.database.status)}
              <span className="ml-2 capitalize">{health.database.status}</span>
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Connections</p>
              <p className="text-lg font-semibold text-gray-900">{health.database.connections}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Query Time</p>
              <p className="text-lg font-semibold text-gray-900">{health.database.queryTime}ms</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Server className="h-8 w-8 text-red-500 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">Redis</h3>
                <p className="text-sm text-gray-500">Cache & State</p>
              </div>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health.redis.status)}`}
            >
              {getStatusIcon(health.redis.status)}
              <span className="ml-2 capitalize">{health.redis.status}</span>
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Memory</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatBytes(health.redis.memory)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Connections</p>
              <p className="text-lg font-semibold text-gray-900">{health.redis.connections}</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-purple-500 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">Kafka</h3>
                <p className="text-sm text-gray-500">Event Streaming</p>
              </div>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health.kafka.status)}`}
            >
              {getStatusIcon(health.kafka.status)}
              <span className="ml-2 capitalize">{health.kafka.status}</span>
            </span>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-gray-500">Topics</p>
            <p className="text-lg font-semibold text-gray-900">{health.kafka.topics.length}</p>
          </div>
        </div>
      </div>

      {/* Kafka Topics Detail */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Kafka Topics</h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Topic Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Partitions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Consumer Lag
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {health.kafka.topics.map((topic, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {topic.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {topic.partitions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          topic.lag > 1000
                            ? 'bg-red-100 text-red-800'
                            : topic.lag > 100
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {topic.lag}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          topic.lag > 1000
                            ? 'bg-red-100 text-red-800'
                            : topic.lag > 100
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {topic.lag > 1000 ? 'High Lag' : topic.lag > 100 ? 'Medium Lag' : 'Healthy'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Microservices Health */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Microservices Health</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {health.services.map((service, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Network className="h-5 w-5 text-gray-400 mr-2" />
                    <h4 className="text-sm font-medium text-gray-900">{service.name}</h4>
                  </div>
                  {getStatusIcon(service.status)}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Last Check:</span>
                    <span className="text-gray-900">
                      {new Date(service.lastCheck).toLocaleTimeString()}
                    </span>
                  </div>

                  {service.responseTime && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Response Time:</span>
                      <span className="text-gray-900">{service.responseTime}ms</span>
                    </div>
                  )}

                  {service.errorRate !== undefined && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Error Rate:</span>
                      <span
                        className={`${service.errorRate > 5 ? 'text-red-600' : 'text-gray-900'}`}
                      >
                        {service.errorRate.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
