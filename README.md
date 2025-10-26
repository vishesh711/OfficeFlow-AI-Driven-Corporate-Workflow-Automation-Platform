# OfficeFlow Platform

An event-driven workflow automation platform designed to streamline corporate HR and IT processes through intelligent orchestration.

## Quick Start

Get up and running quickly with our automated run scripts:

```bash
# For Unix/Linux/macOS
./run.sh setup    # Install, build, and test everything
./run.sh dev      # Start all services in development mode

# For Windows
run.bat setup     # Install, build, and test everything
run.bat dev       # Start all services in development mode
```

📖 **See [RUN_SCRIPTS.md](./RUN_SCRIPTS.md) for detailed usage instructions**

## Overview

OfficeFlow transforms manual, error-prone HR/IT processes into automated, compliant workflows using:

- **Event-driven architecture** with Kafka for reliable message processing
- **Microservices** for scalable, independent node execution
- **AI integration** for adaptive content generation and decision-making
- **Visual workflow designer** for intuitive process creation
- **Comprehensive monitoring** and audit capabilities

## Architecture

The platform follows a distributed, event-driven architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Workflow       │    │  Admin          │    │  External       │
│  Designer       │    │  Dashboard      │    │  Systems        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  API Gateway    │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Workflow Engine │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Apache Kafka    │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Identity        │    │ Email           │    │ AI              │
│ Service         │    │ Service         │    │ Service         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Project Structure

This is a monorepo organized with the following structure:

```
officeflow-platform/
├── packages/                 # Shared libraries
│   ├── types/               # TypeScript type definitions
│   ├── config/              # Configuration management
│   └── shared/              # Common utilities
├── services/                # Backend microservices
│   ├── workflow-engine/     # Core orchestration service
│   ├── identity-service/    # User account management
│   ├── email-service/       # Email communications
│   └── ...                  # Other node executors
├── apps/                    # Frontend applications
│   ├── workflow-designer/   # Visual workflow editor
│   └── admin-dashboard/     # Monitoring and management
└── docs/                    # Documentation
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 14+
- Redis 6+
- Apache Kafka 3.0+

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd officeflow-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Build all packages:
```bash
npm run build
```

### Development

Start all services in development mode:
```bash
npm run dev
```

Run tests:
```bash
npm run test
```

Lint code:
```bash
npm run lint
```

Format code:
```bash
npm run format
```

## Core Concepts

### Workflows
Workflows are defined as Directed Acyclic Graphs (DAGs) where each node represents a specific task (e.g., create user account, send email, schedule meeting).

### Node Executors
Independent microservices that execute specific workflow tasks:
- **Identity Service**: User provisioning/deprovisioning
- **Email Service**: Template-based communications
- **Calendar Service**: Meeting scheduling
- **AI Service**: Content generation and analysis
- **Slack Service**: Team communication
- **Document Service**: File distribution

### Event Streaming
All system interactions flow through Kafka events, enabling:
- Loose coupling between services
- Reliable message delivery
- Event sourcing and audit trails
- Horizontal scalability

### Lifecycle Events
Standard events that trigger workflows:
- `employee.onboard`: New employee joining
- `employee.exit`: Employee leaving
- `employee.transfer`: Role/department changes
- `employee.update`: Profile modifications

## Configuration

The platform uses a hierarchical configuration system:

1. **Environment variables** (highest priority)
2. **Configuration files** (.env files)
3. **Default values** (lowest priority)

Key configuration areas:
- Database connections
- Kafka brokers
- Redis clusters
- External service integrations
- Authentication settings
- Observability configuration

## Monitoring and Observability

Built-in observability features:
- **Structured logging** with correlation IDs
- **Distributed tracing** with OpenTelemetry
- **Metrics collection** with Prometheus
- **Health checks** for all services
- **Audit logging** for compliance

## Security

Security features include:
- JWT-based authentication
- Role-based access control (RBAC)
- API rate limiting
- Input validation and sanitization
- Encryption at rest and in transit
- Audit logging for all operations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

[License information to be added]

## Support

For questions and support:
- Documentation: [Link to docs]
- Issues: [Link to issue tracker]
- Discussions: [Link to discussions]