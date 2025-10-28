# OfficeFlow Workflow Designer

A React-based visual workflow designer for the OfficeFlow automation platform.

## Features

- **Visual Workflow Editor**: Drag-and-drop interface for creating workflows
- **Node Library**: Pre-built nodes for identity, communication, AI, and flow control
- **Real-time Validation**: Instant feedback on workflow structure and dependencies
- **Properties Panel**: Configure node parameters and retry policies
- **Template Support**: Save and reuse workflow templates
- **TypeScript**: Full type safety and IntelliSense support

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+ or yarn 1.22+

### Installation

**Note**: Due to workspace dependencies in the monorepo, you may need to install dependencies from the root directory:

```bash
# From the root of the monorepo
npm install

# Or install dependencies directly (if workspace issues persist)
cd apps/workflow-designer
npm install --legacy-peer-deps
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

The application runs on `http://localhost:3001` by default.

### Known Issues

- **Dependency Installation**: The monorepo uses workspace protocol (`workspace:*`) which may cause installation issues. If you encounter `EUNSUPPORTEDPROTOCOL` errors, try installing from the root directory or use `--legacy-peer-deps` flag.
- **TypeScript Errors**: If you see JSX-related TypeScript errors, ensure React types are properly installed by running `npm install @types/react @types/react-dom`.

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

## Architecture

### Components

- **Layout**: Main application shell with navigation
- **WorkflowDesigner**: Main editor interface with React Flow
- **NodeSidebar**: Draggable node library
- **PropertiesPanel**: Node configuration interface
- **Custom Nodes**: Specialized components for each node type

### State Management

- **Zustand**: Lightweight state management for workflow data
- **React Query**: Server state management and caching

### Styling

- **TailwindCSS**: Utility-first CSS framework
- **React Flow**: Specialized styles for flow diagrams

## Node Types

### Triggers

- **Event Trigger**: Responds to lifecycle events
- **Schedule**: Time-based triggers

### Identity & Access

- **Identity Service**: Account provisioning/deprovisioning

### Communication

- **Email**: Send personalized emails
- **Slack**: Team communication
- **Calendar**: Meeting scheduling

### Documents & AI

- **Document**: File distribution
- **AI Content**: LLM-powered content generation

### Flow Control

- **Condition**: Conditional branching
- **Delay**: Time delays

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run type-check
```

## Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```
