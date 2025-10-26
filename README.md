# OfficeFlow Platform

An event-driven workflow automation platform designed to streamline corporate HR and IT processes through intelligent orchestration.

## Quick Start

### Prerequisites

Before running the project, ensure you have:

- **Node.js** 18+ and **pnpm** installed
- **Docker** and **Docker Compose** installed
- **Git** installed
- Ports 3000-3007, 5173, 5432, 6379, 9092, and 9000 available

### One-Command Setup (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd OfficeFlow-AI-Driven-Corporate-Workflow-Automation-Platform

# Make the script executable and run
chmod +x just-run.sh
./just-run.sh
```

This will:
- Install all dependencies using pnpm
- Start Docker infrastructure (PostgreSQL, Redis, Kafka, MinIO)
- Launch all microservices
- Start the workflow designer frontend

### Manual Setup

If you prefer step-by-step control:

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure services
docker-compose -f docker-compose.dev.yml up -d

# 3. Wait for infrastructure to be ready (30-60 seconds)
sleep 30

# 4. Start all services
pnpm run dev
```

### Environment Configuration

**Important**: Create a `.env.local` file in the root directory with the following variables:

```bash
# Database
DATABASE_URL="postgresql://officeflow:officeflow_dev@localhost:5432/officeflow"

# Redis
REDIS_HOST="localhost"

# Kafka
KAFKA_BROKERS="localhost:9092"

# AI Service (Required for AI features)
OPENAI_API_KEY="your_openai_api_key"

# Slack Service (Optional - can be skipped)
SLACK_BOT_TOKEN="xoxb-your-slack-bot-token"
SLACK_SIGNING_SECRET="your-slack-signing-secret"
SLACK_CLIENT_ID="your-slack-client-id"
SLACK_CLIENT_SECRET="your-slack-client-secret"
```

**Note**: The Slack service is optional and will be skipped if credentials are not provided.

### Access Points

After successful startup, access the application at:

- **Main Application**: http://localhost:5173
- **Workflow Engine API**: http://localhost:3000
- **AI Service API**: http://localhost:3003
- **MinIO Console**: http://localhost:9000 (admin/password)

### Service Status

Check if services are running properly:

```bash
# Check workflow engine
curl http://localhost:3000/health

# Check AI service
curl http://localhost:3003/health

# Check workflow designer
curl http://localhost:5173
```

### Troubleshooting

**Common Issues and Solutions:**

1. **Port Conflicts**
   - Ensure ports 3000-3008, 5173, 5432, 6379, 9092, and 9000 are available
   - Check what's using these ports: `lsof -i :PORT_NUMBER`

2. **Docker Issues**
   ```bash
   # Restart Docker services
   docker-compose -f docker-compose.dev.yml down
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **Database Connection Issues**
   - Ensure PostgreSQL is running: `docker ps | grep postgres`
   - Check database logs: `docker logs officeflow-postgres`

4. **Kafka Issues**
   - Ensure Zookeeper and Kafka are running: `docker ps | grep kafka`
   - Check Kafka logs: `docker logs officeflow-kafka`

5. **Service Startup Failures**
   - Check service logs: `pnpm run logs --filter="@officeflow/service-name"`
   - Ensure all environment variables are set in `.env.local`

6. **Frontend Not Loading**
   - Check if Vite is running on port 5173
   - Verify no port conflicts
   - Check browser console for errors

**Clean Restart:**

If you encounter persistent issues:

```bash
# Stop all services
pnpm run stop

# Clean Docker containers
docker-compose -f docker-compose.dev.yml down -v

# Restart everything
./just-run.sh
```

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

## Deployment

### Local Development
```bash
# Docker Compose (recommended for local development)
docker-compose up -d

# Access services
# - Frontend: http://localhost:8080
# - API: http://localhost:3000
# - Auth: http://localhost:3001
```

### Production Deployment

The platform supports enterprise-grade deployment with multiple strategies:

#### Kubernetes Deployment
```bash
# Quick deployment to staging
./scripts/k8s-deploy.sh --namespace officeflow-staging

# Production deployment with blue-green strategy
./scripts/deploy.sh --strategy blue-green --environment production

# Canary deployment for gradual rollouts
./scripts/deploy.sh --strategy canary --environment production
```

#### Container Security
```bash
# Build and scan all containers
./scripts/docker-build-push.sh --local-only
./scripts/docker-security-scan.sh

# Multi-architecture builds for production
./scripts/docker-build-push.sh --multi-arch --registry ghcr.io
```

#### CI/CD Pipeline
Comprehensive GitHub Actions workflows provide:
- **Continuous Integration**: Automated testing, linting, security scanning
- **Continuous Deployment**: Multi-environment deployment with rollback
- **Security Scanning**: Daily vulnerability and compliance checks
- **Performance Testing**: Load testing and performance monitoring

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment documentation.

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
- Deployment environments (dev/staging/production)

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

## Documentation

📚 **[Complete Documentation](docs/README.md)** - Comprehensive guides and references

### Quick Links
- **[Getting Started](GETTING_STARTED.md)** - Quick start guide
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment
- **[Observability](docs/OBSERVABILITY.md)** - Monitoring and logging
- **[Feature Specs](.kiro/specs/)** - Detailed specifications

## Support

For questions and support:
- **Documentation**: [docs/](docs/) directory
- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions
- **Security**: security@officeflow.com