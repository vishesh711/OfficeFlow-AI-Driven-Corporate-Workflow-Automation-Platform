import { Routes, Route } from 'react-router-dom'

// Simple test components
function SimpleDashboard() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard</h1>
      <p>This is a simple dashboard test.</p>
    </div>
  )
}

function App() {
  return (
    <div>
      <div className="test-sidebar">
        <nav>
          <h2>OfficeFlow</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><a href="/" style={{ display: 'block', padding: '8px 0' }}>Dashboard</a></li>
            <li><a href="/workflows" style={{ display: 'block', padding: '8px 0' }}>Workflows</a></li>
          </ul>
        </nav>
      </div>
      <div className="test-content">
        <Routes>
          <Route path="/" element={<SimpleDashboard />} />
          <Route path="/workflows" element={<div>Workflows Page</div>} />
        </Routes>
      </div>
    </div>
  )
}

export default App