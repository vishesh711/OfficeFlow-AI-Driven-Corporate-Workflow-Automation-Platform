# OfficeFlow Platform Run Scripts

This document describes the run scripts available for managing the OfficeFlow platform development environment.

## Quick Start

### For Unix/Linux/macOS users:
```bash
# Make the script executable (first time only)
chmod +x run.sh

# Setup the entire project
./run.sh setup

# Start all services in development mode
./run.sh dev
```

### For Windows users:
```cmd
# Setup the entire project
run.bat setup

# Start all services in development mode
run.bat dev
```

## Available Commands

### Setup and Installation
- `setup` - Complete project setup (install dependencies, build, and test)
- `install` - Install all dependencies using npm workspaces

### Development
- `dev` - Start all services in development mode with hot reload
- `dev <service>` - Start a specific service in development mode
  - `dev ai-service` - Start AI service only
  - `dev identity-service` - Start Identity service only
  - `dev workflow-engine` - Start Workflow engine only

### Building
- `build` - Build all services for production
- `clean` - Clean all build artifacts and dist folders

### Testing
- `test` - Run all tests across all services
- `test <service>` - Run tests for a specific service
- `type-check` - Run TypeScript type checking across all services

### Code Quality
- `format` - Format all code using Prettier
- `format:check` - Check if code is properly formatted

### Help
- `help` - Show detailed usage information

## Services Overview

### AI Service (`ai-service`)
- **Purpose**: AI-powered content generation and processing
- **Port**: Typically runs on port 3001
- **Features**: OpenAI integration, template management, content generation

### Identity Service (`identity-service`)
- **Purpose**: Identity and access management
- **Port**: Typically runs on port 3002
- **Features**: OAuth2, user provisioning, credential management

### Workflow Engine (`workflow-engine`)
- **Purpose**: Core workflow orchestration
- **Port**: Typically runs on port 3000
- **Features**: Workflow execution, event processing, task management

## Prerequisites

Before using the run scripts, ensure you have:

1. **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
2. **npm 9+** - Usually comes with Node.js
3. **Git** - For version control

## Environment Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd OfficeFlow-AI-Driven-Corporate-Workflow-Automation-Platform
   ```

2. **Run initial setup**:
   ```bash
   # Unix/Linux/macOS
   ./run.sh setup
   
   # Windows
   run.bat setup
   ```

3. **Configure environment variables**:
   - Copy `.env.example` to `.env` in each service directory
   - Update the values according to your environment

## Development Workflow

### Starting Development
```bash
# Start all services
./run.sh dev

# Or start individual services in separate terminals
./run.sh dev workflow-engine
./run.sh dev ai-service
./run.sh dev identity-service
```

### Running Tests
```bash
# Run all tests
./run.sh test

# Run tests for specific service
./run.sh test identity-service
```

### Building for Production
```bash
# Build all services
./run.sh build

# Clean and rebuild
./run.sh clean
./run.sh build
```

## Troubleshooting

### Common Issues

1. **Permission denied on Unix/Linux/macOS**:
   ```bash
   chmod +x run.sh
   ```

2. **Node.js version issues**:
   - Ensure you have Node.js 18 or higher
   - Use `node --version` to check your version

3. **Port conflicts**:
   - Check if ports 3000, 3001, 3002 are available
   - Kill any processes using these ports

4. **Dependencies issues**:
   ```bash
   # Clean and reinstall
   ./run.sh clean
   rm -rf node_modules
   ./run.sh install
   ```

### Getting Help

- Run `./run.sh help` for detailed command information
- Check individual service README files for service-specific information
- Review the main project README.md for architecture details

## Advanced Usage

### Custom Environment Variables
Each service can be configured with environment variables. Create `.env` files in each service directory:

```bash
# services/ai-service/.env
OPENAI_API_KEY=your_openai_key
PORT=3001

# services/identity-service/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/identity
ENCRYPTION_KEY=your_32_character_encryption_key

# services/workflow-engine/.env
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
```

### Running with Docker (Future Enhancement)
The run scripts are designed to be extended with Docker support:

```bash
# Future commands (not yet implemented)
./run.sh docker:build
./run.sh docker:dev
./run.sh docker:prod
```

## Contributing

When adding new services or modifying existing ones:

1. Update the run scripts to include the new service
2. Add appropriate npm scripts to the service's package.json
3. Update this documentation
4. Test all commands work correctly

## Script Architecture

The run scripts use:
- **Turbo** for monorepo task orchestration
- **npm workspaces** for dependency management
- **TypeScript** for type checking
- **Jest** for testing
- **Prettier** for code formatting

This ensures consistent development experience across all services and platforms.