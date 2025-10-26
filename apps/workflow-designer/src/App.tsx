import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { WorkflowDesigner } from './pages/WorkflowDesigner'
import { WorkflowList } from './pages/WorkflowList'
import { Dashboard } from './pages/Dashboard'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/workflows" element={<WorkflowList />} />
        <Route path="/workflows/new" element={<WorkflowDesigner />} />
        <Route path="/workflows/:id" element={<WorkflowDesigner />} />
      </Routes>
    </Layout>
  )
}

export default App