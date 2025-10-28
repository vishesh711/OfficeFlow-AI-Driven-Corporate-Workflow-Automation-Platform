# OfficeFlow Platform - Client-Side Documentation

This document covers all client-side components, frontend applications, and user interfaces for the OfficeFlow platform.

## 🎨 Frontend Architecture

The client-side architecture follows a modern React-based approach with TypeScript:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend Applications                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │ Workflow        │    │ Admin           │    │ Mobile          │ │
│  │ Designer        │    │ Dashboard       │    │ App (Future)    │ │
│  │ (React/Vite)    │    │ (React/Next)    │    │ (React Native)  │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                     State Management                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │ Zustand         │    │ React Query     │    │ React Hook      │ │
│  │ (Global State)  │    │ (Server State)  │    │ Form (Forms)    │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                     UI Components                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │ React Flow      │    │ Lucide Icons    │    │ Tailwind CSS    │ │
│  │ (Workflow UI)   │    │ (Icons)         │    │ (Styling)       │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                     API Communication                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │ Axios           │    │ WebSocket       │    │ Server-Sent     │ │
│  │ (HTTP Client)   │    │ (Real-time)     │    │ Events (SSE)    │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 📱 Applications Overview

### 1. Workflow Designer (`apps/workflow-designer/`)

The primary frontend application for creating and managing workflows.

#### Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand + React Query
- **Forms**: React Hook Form + Zod validation
- **Workflow UI**: React Flow
- **Icons**: Lucide React
- **HTTP Client**: Axios

#### Key Features

- **Visual Workflow Designer**: Drag-and-drop interface for creating workflows
- **Node Library**: Pre-built nodes for common tasks (email, calendar, AI, etc.)
- **Real-time Collaboration**: Multiple users can edit workflows simultaneously
- **Template Gallery**: Pre-built workflow templates
- **Validation**: Real-time workflow validation and error checking
- **Testing**: Built-in workflow testing and debugging tools

#### Project Structure

```
apps/workflow-designer/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── nodes/          # Workflow node components
│   │   ├── Layout.tsx      # Main layout component
│   │   ├── PropertiesPanel.tsx
│   │   ├── ValidationPanel.tsx
│   │   └── TemplateGallery.tsx
│   ├── pages/              # Page components
│   │   ├── Dashboard.tsx
│   │   ├── WorkflowDesigner.tsx
│   │   ├── WorkflowList.tsx
│   │   ├── AdminDashboard.tsx
│   │   └── MonitoringDashboard.tsx
│   ├── lib/                # Utility libraries
│   │   ├── api.ts          # API client configuration
│   │   ├── templates.ts    # Workflow templates
│   │   └── utils.ts        # Helper functions
│   ├── hooks/              # Custom React hooks
│   ├── stores/             # Zustand stores
│   ├── types/              # TypeScript type definitions
│   └── styles/             # Global styles
├── public/                 # Static assets
├── index.html             # HTML template
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

#### Development Setup

```bash
# Navigate to the app directory
cd apps/workflow-designer

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Type checking
npm run type-check

# Linting
npm run lint
```

#### Environment Configuration

Create `.env.local` file:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_AUTH_SERVICE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3000/ws

# Feature Flags
VITE_ENABLE_COLLABORATION=true
VITE_ENABLE_AI_SUGGESTIONS=true
VITE_ENABLE_ANALYTICS=false

# External Services
VITE_SENTRY_DSN=your_sentry_dsn
VITE_ANALYTICS_ID=your_analytics_id
```

### 2. Admin Dashboard (Future)

Administrative interface for system management and monitoring.

#### Planned Features

- **User Management**: Create, edit, and manage user accounts
- **Organization Management**: Manage organizations and teams
- **System Monitoring**: Real-time system health and performance metrics
- **Audit Logs**: View and search system audit logs
- **Configuration**: System-wide configuration management
- **Analytics**: Usage analytics and reporting

## 🎯 Core Components

### Workflow Designer Components

#### 1. Workflow Canvas (`src/pages/WorkflowDesigner.tsx`)

```typescript
import React from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background
} from 'reactflow';

const WorkflowDesigner: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = (connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
  };

  return (
    <div className="h-screen w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background />
      </ReactFlow>
    </div>
  );
};
```

#### 2. Node Components (`src/components/nodes/`)

##### Email Node

```typescript
import React from 'react';
import { Handle, Position } from 'reactflow';
import { Mail } from 'lucide-react';

interface EmailNodeData {
  template: string;
  recipients: string[];
  subject: string;
}

const EmailNode: React.FC<{ data: EmailNodeData }> = ({ data }) => {
  return (
    <div className="bg-white border-2 border-blue-500 rounded-lg p-4 min-w-[200px]">
      <Handle type="target" position={Position.Top} />

      <div className="flex items-center gap-2 mb-2">
        <Mail className="w-5 h-5 text-blue-500" />
        <span className="font-semibold">Send Email</span>
      </div>

      <div className="text-sm text-gray-600">
        <div>Template: {data.template}</div>
        <div>Recipients: {data.recipients.length}</div>
        <div>Subject: {data.subject}</div>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default EmailNode;
```

##### AI Node

```typescript
import React from 'react';
import { Handle, Position } from 'reactflow';
import { Brain } from 'lucide-react';

interface AINodeData {
  prompt: string;
  model: string;
  maxTokens: number;
}

const AINode: React.FC<{ data: AINodeData }> = ({ data }) => {
  return (
    <div className="bg-white border-2 border-purple-500 rounded-lg p-4 min-w-[200px]">
      <Handle type="target" position={Position.Top} />

      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-5 h-5 text-purple-500" />
        <span className="font-semibold">AI Processing</span>
      </div>

      <div className="text-sm text-gray-600">
        <div>Model: {data.model}</div>
        <div>Max Tokens: {data.maxTokens}</div>
        <div className="truncate">Prompt: {data.prompt}</div>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default AINode;
```

#### 3. Properties Panel (`src/components/PropertiesPanel.tsx`)

```typescript
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const emailNodeSchema = z.object({
  template: z.string().min(1, 'Template is required'),
  recipients: z.array(z.string().email()),
  subject: z.string().min(1, 'Subject is required'),
  variables: z.record(z.string())
});

type EmailNodeForm = z.infer<typeof emailNodeSchema>;

const PropertiesPanel: React.FC<{ selectedNode: Node | null }> = ({ selectedNode }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<EmailNodeForm>({
    resolver: zodResolver(emailNodeSchema),
    defaultValues: selectedNode?.data
  });

  const onSubmit = (data: EmailNodeForm) => {
    // Update node data
    updateNodeData(selectedNode.id, data);
  };

  if (!selectedNode) {
    return (
      <div className="w-80 bg-gray-50 p-4">
        <p className="text-gray-500">Select a node to edit properties</p>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-l p-4">
      <h3 className="text-lg font-semibold mb-4">Node Properties</h3>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Template</label>
          <select {...register('template')} className="w-full border rounded px-3 py-2">
            <option value="">Select template</option>
            <option value="welcome">Welcome Email</option>
            <option value="reminder">Reminder Email</option>
          </select>
          {errors.template && (
            <p className="text-red-500 text-sm mt-1">{errors.template.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <input
            {...register('subject')}
            className="w-full border rounded px-3 py-2"
            placeholder="Email subject"
          />
          {errors.subject && (
            <p className="text-red-500 text-sm mt-1">{errors.subject.message}</p>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          Update Node
        </button>
      </form>
    </div>
  );
};
```

### State Management

#### 1. Workflow Store (Zustand)

```typescript
import { create } from 'zustand';
import { Node, Edge } from 'reactflow';

interface WorkflowState {
  // State
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  updateNode: (id: string, data: any) => void;
  deleteNode: (id: string) => void;
  selectNode: (node: Node | null) => void;
  saveWorkflow: () => Promise<void>;
  loadWorkflow: (id: string) => Promise<void>;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  selectedNode: null,
  isLoading: false,
  error: null,

  // Actions
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  updateNode: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
    })),

  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
    })),

  selectNode: (node) => set({ selectedNode: node }),

  saveWorkflow: async () => {
    const { nodes, edges } = get();
    set({ isLoading: true, error: null });

    try {
      await api.post('/workflows', { nodes, edges });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  loadWorkflow: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.get(`/workflows/${id}`);
      set({
        nodes: response.data.nodes,
        edges: response.data.edges,
      });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },
}));
```

#### 2. API Client (React Query)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// Workflows
export const useWorkflows = () => {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.get('/workflows').then((res) => res.data),
  });
};

export const useWorkflow = (id: string) => {
  return useQuery({
    queryKey: ['workflows', id],
    queryFn: () => api.get(`/workflows/${id}`).then((res) => res.data),
    enabled: !!id,
  });
};

export const useCreateWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workflow: any) => api.post('/workflows', workflow),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
};

export const useUpdateWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...workflow }: any) => api.put(`/workflows/${id}`, workflow),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflows', variables.id] });
    },
  });
};

// Templates
export const useTemplates = () => {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then((res) => res.data),
  });
};

// Organizations
export const useOrganizations = () => {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get('/organizations').then((res) => res.data),
  });
};
```

### UI Components

#### 1. Layout Component

```typescript
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Toaster } from 'react-hot-toast';

const Layout: React.FC = () => {
  return (
    <div className="h-screen flex bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      <Toaster position="top-right" />
    </div>
  );
};

export default Layout;
```

#### 2. Template Gallery

```typescript
import React from 'react';
import { useTemplates } from '../hooks/useApi';
import { useWorkflowStore } from '../stores/workflowStore';

const TemplateGallery: React.FC = () => {
  const { data: templates, isLoading } = useTemplates();
  const { setNodes, setEdges } = useWorkflowStore();

  const handleTemplateSelect = (template: any) => {
    setNodes(template.nodes);
    setEdges(template.edges);
  };

  if (isLoading) {
    return <div className="p-4">Loading templates...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Workflow Templates</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates?.map((template: any) => (
          <div
            key={template.id}
            className="border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleTemplateSelect(template)}
          >
            <h3 className="font-medium mb-2">{template.name}</h3>
            <p className="text-sm text-gray-600 mb-3">{template.description}</p>

            <div className="flex items-center justify-between">
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {template.category}
              </span>
              <span className="text-xs text-gray-500">
                {template.nodes?.length || 0} nodes
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateGallery;
```

## 🎨 Styling & Design System

### Tailwind CSS Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        secondary: {
          50: '#f8fafc',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};
```

### Design Tokens

```typescript
// src/styles/tokens.ts
export const colors = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    900: '#1e3a8a',
  },
  success: {
    50: '#f0fdf4',
    500: '#22c55e',
    600: '#16a34a',
  },
  warning: {
    50: '#fffbeb',
    500: '#f59e0b',
    600: '#d97706',
  },
  error: {
    50: '#fef2f2',
    500: '#ef4444',
    600: '#dc2626',
  },
};

export const spacing = {
  xs: '0.5rem',
  sm: '1rem',
  md: '1.5rem',
  lg: '2rem',
  xl: '3rem',
};

export const typography = {
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};
```

## 🔧 Build & Development

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@lib': path.resolve(__dirname, './src/lib'),
    },
  },
  server: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          reactflow: ['reactflow'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
  },
});
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@pages/*": ["./src/pages/*"],
      "@hooks/*": ["./src/hooks/*"],
      "@stores/*": ["./src/stores/*"],
      "@lib/*": ["./src/lib/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## 🧪 Testing

### Testing Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Test Utilities

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// src/test/utils.tsx
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
```

### Component Tests

```typescript
// src/components/__tests__/EmailNode.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/utils';
import EmailNode from '../nodes/EmailNode';

describe('EmailNode', () => {
  const mockData = {
    template: 'welcome',
    recipients: ['user@example.com'],
    subject: 'Welcome to OfficeFlow'
  };

  it('renders email node with correct data', () => {
    render(<EmailNode data={mockData} />);

    expect(screen.getByText('Send Email')).toBeInTheDocument();
    expect(screen.getByText('Template: welcome')).toBeInTheDocument();
    expect(screen.getByText('Recipients: 1')).toBeInTheDocument();
    expect(screen.getByText('Subject: Welcome to OfficeFlow')).toBeInTheDocument();
  });

  it('displays mail icon', () => {
    render(<EmailNode data={mockData} />);

    const mailIcon = screen.getByRole('img', { hidden: true });
    expect(mailIcon).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
// src/pages/__tests__/WorkflowDesigner.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/utils';
import WorkflowDesigner from '../WorkflowDesigner';

// Mock React Flow
vi.mock('reactflow', () => ({
  default: ({ children }: any) => <div data-testid="react-flow">{children}</div>,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  Background: () => <div data-testid="background" />,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
}));

describe('WorkflowDesigner', () => {
  it('renders workflow designer components', () => {
    render(<WorkflowDesigner />);

    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('controls')).toBeInTheDocument();
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
    expect(screen.getByTestId('background')).toBeInTheDocument();
  });
});
```

## 🚀 Deployment

### Docker Configuration

```dockerfile
# apps/workflow-designer/Dockerfile
FROM node:18-alpine AS base

# Install security updates and create non-root user
RUN apk update && apk upgrade && \
    addgroup -g 1001 -S nodejs && \
    adduser -S officeflow -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install pnpm
RUN npm install -g pnpm

# Development stage
FROM base AS deps
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN pnpm run build

# Production stage - use nginx to serve static files
FROM nginx:alpine AS runner

# Install security updates
RUN apk update && apk upgrade

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user for nginx
RUN addgroup -g 1001 -S nginx && \
    adduser -S officeflow -u 1001 -G nginx

# Change ownership of nginx directories
RUN chown -R officeflow:nginx /var/cache/nginx && \
    chown -R officeflow:nginx /var/log/nginx && \
    chown -R officeflow:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R officeflow:nginx /var/run/nginx.pid

# Switch to non-root user
USER officeflow

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Configuration

```nginx
# apps/workflow-designer/nginx.conf
user officeflow;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    server {
        listen 8080;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

        # Handle React Router
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### Build Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "type-check": "tsc --noEmit",
    "test": "vitest --run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "clean": "rm -rf dist node_modules/.vite"
  }
}
```

## 📱 Responsive Design

### Mobile-First Approach

```typescript
// Responsive breakpoints
const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// Responsive component example
const ResponsiveWorkflowList: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {workflows.map(workflow => (
        <div key={workflow.id} className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-2 truncate">
            {workflow.name}
          </h3>
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {workflow.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button className="flex-1 bg-blue-500 text-white py-2 px-4 rounded text-sm">
              Edit
            </button>
            <button className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded text-sm">
              Run
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### Touch-Friendly Interface

```css
/* Touch-friendly button sizes */
.btn {
  @apply min-h-[44px] min-w-[44px] px-4 py-2;
}

/* Larger touch targets for mobile */
@media (max-width: 768px) {
  .touch-target {
    @apply min-h-[48px] min-w-[48px];
  }

  .workflow-node {
    @apply min-w-[120px] min-h-[80px];
  }
}
```

## 🔍 Performance Optimization

### Code Splitting

```typescript
// Lazy loading for routes
import { lazy, Suspense } from 'react';

const WorkflowDesigner = lazy(() => import('../pages/WorkflowDesigner'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'));

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route
            path="designer"
            element={
              <Suspense fallback={<div>Loading...</div>}>
                <WorkflowDesigner />
              </Suspense>
            }
          />
          <Route
            path="admin"
            element={
              <Suspense fallback={<div>Loading...</div>}>
                <AdminDashboard />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
};
```

### Bundle Optimization

```typescript
// vite.config.ts - Manual chunks for better caching
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          reactflow: ['reactflow'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          ui: ['lucide-react', 'clsx', 'tailwind-merge'],
          state: ['zustand', '@tanstack/react-query'],
        },
      },
    },
  },
});
```

### Image Optimization

```typescript
// Optimized image component
const OptimizedImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className }) => {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.currentTarget.src = '/placeholder.svg';
      }}
    />
  );
};
```

## 🚨 Error Handling

### Error Boundaries

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    // Send to error reporting service
    if (import.meta.env.PROD) {
      // Sentry.captureException(error);
    }
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-4">
              We're sorry, but something unexpected happened.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### API Error Handling

```typescript
// API error handling with React Query
import { toast } from 'react-hot-toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      onError: (error: any) => {
        const message = error?.response?.data?.message || 'Something went wrong';
        toast.error(message);
      },
    },
    mutations: {
      onError: (error: any) => {
        const message = error?.response?.data?.message || 'Something went wrong';
        toast.error(message);
      },
    },
  },
});
```

## 📊 Analytics & Monitoring

### User Analytics

```typescript
// Analytics service
class AnalyticsService {
  private isEnabled = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';

  track(event: string, properties?: Record<string, any>) {
    if (!this.isEnabled) return;

    // Send to analytics service
    if (window.gtag) {
      window.gtag('event', event, properties);
    }
  }

  page(path: string) {
    if (!this.isEnabled) return;

    if (window.gtag) {
      window.gtag('config', import.meta.env.VITE_ANALYTICS_ID, {
        page_path: path,
      });
    }
  }

  identify(userId: string, traits?: Record<string, any>) {
    if (!this.isEnabled) return;

    if (window.gtag) {
      window.gtag('config', import.meta.env.VITE_ANALYTICS_ID, {
        user_id: userId,
        custom_map: traits,
      });
    }
  }
}

export const analytics = new AnalyticsService();

// Usage in components
const WorkflowDesigner: React.FC = () => {
  useEffect(() => {
    analytics.page('/designer');
  }, []);

  const handleNodeAdd = (nodeType: string) => {
    analytics.track('node_added', { nodeType });
    // ... add node logic
  };

  return (
    // ... component JSX
  );
};
```

### Performance Monitoring

```typescript
// Performance monitoring
const performanceMonitor = {
  measureRender: (componentName: string) => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (duration > 16) {
        // Longer than one frame
        console.warn(`Slow render: ${componentName} took ${duration.toFixed(2)}ms`);
      }
    };
  },

  measureAPI: async (apiCall: () => Promise<any>, endpoint: string) => {
    const startTime = performance.now();

    try {
      const result = await apiCall();
      const endTime = performance.now();
      const duration = endTime - startTime;

      analytics.track('api_call', {
        endpoint,
        duration,
        success: true,
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      analytics.track('api_call', {
        endpoint,
        duration,
        success: false,
        error: error.message,
      });

      throw error;
    }
  },
};

// Usage in hooks
const useWorkflows = () => {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () =>
      performanceMonitor.measureAPI(
        () => api.get('/workflows').then((res) => res.data),
        '/workflows'
      ),
  });
};
```

For more detailed information about specific components and features, see the individual component documentation in the `apps/workflow-designer/src/components/` directory.
