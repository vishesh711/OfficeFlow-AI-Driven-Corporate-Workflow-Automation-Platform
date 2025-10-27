import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { WorkflowList } from '@/pages/WorkflowList'
import { WorkflowDesigner } from '@/pages/WorkflowDesigner'
import { MonitoringDashboard } from '@/pages/MonitoringDashboard'
import { AdminDashboard } from '@/pages/AdminDashboard'
import { Settings } from '@/pages/Settings'
import { Login } from '@/pages/Login'

// Simple auth check (replace with real auth later)
const isAuthenticated = () => {
  return localStorage.getItem('officeflow_auth') !== null
}

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/workflows" element={<WorkflowList />} />
                <Route path="/workflows/new" element={<WorkflowDesigner />} />
                <Route path="/workflows/:id" element={<WorkflowDesigner />} />
                <Route path="/monitoring" element={<MonitoringDashboard />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App