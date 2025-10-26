import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { WorkflowList } from '@/pages/WorkflowList'
import { WorkflowDesigner } from '@/pages/WorkflowDesigner'
import { MonitoringDashboard } from '@/pages/MonitoringDashboard'
import { AdminDashboard } from '@/pages/AdminDashboard'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/workflows" element={<WorkflowList />} />
        <Route path="/workflows/new" element={<WorkflowDesigner />} />
        <Route path="/workflows/:id" element={<WorkflowDesigner />} />
        <Route path="/monitoring" element={<MonitoringDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Layout>
  )
}

export default App