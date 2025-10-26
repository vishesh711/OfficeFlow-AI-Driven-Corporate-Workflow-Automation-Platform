# Getting Started with OfficeFlow Platform

Welcome to the OfficeFlow Platform! This guide will help you get up and running quickly.

## 🚀 Quick Start (30 seconds)

### Option 1: Using Run Scripts (Recommended)
```bash
# Clone and setup
git clone <repository-url>
cd OfficeFlow-AI-Driven-Corporate-Workflow-Automation-Platform

# One-command setup (installs, builds, tests everything)
./run.sh setup

# Start all services
./run.sh dev
```

### Option 2: Using npm scripts
```bash
# Setup
npm run setup

# Start development
npm start
```

### Option 3: Manual setup
```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Start development servers
npm run dev
```

## 🎯 What You Get

After running the setup, you'll have:

- **Workflow Engine** running on `http://localhost:3000`
- **AI Service** running on `http://localhost:3001`  
- **Identity Service** running on `http://localhost:3002`
- All tests passing ✅
- TypeScript compilation working ✅
- Hot reload enabled for development 🔥

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `./run.sh setup` | Complete project setup |
| `./run.sh dev` | Start all services |
| `./run.sh dev ai-service` | Start specific service |
| `./run.sh test` | Run all tests |
| `./run.sh build` | Build for production |
| `./run.sh clean` | Clean build artifacts |
| `./run.sh help` | Show all commands |

## 📁 Project Structure

```
OfficeFlow-Platform/
├── services/                 # Microservices
│   ├── workflow-engine/      # Core orchestration
│   ├── ai-service/          # AI content generation
│   └── identity-service/    # User management
├── packages/                # Shared libraries
│   ├── types/              # TypeScript definitions
│   ├── database/           # Database utilities
│   ├── kafka/              # Event streaming
│   └── shared/             # Common utilities
├── run.sh                  # Main run script (Unix/Linux/macOS)
├── run.bat                 # Main run script (Windows)
└── README.md              # Project documentation
```

## 🔧 Development Workflow

### Starting Development
```bash
# Start all services with hot reload
./run.sh dev

# Or start services individually in separate terminals
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
./run.sh clean && ./run.sh build
```

## 🌐 Service Endpoints

Once running, you can access:

- **Workflow Engine**: `http://localhost:3000`
  - Health check: `GET /health`
  - API docs: `GET /api-docs`

- **AI Service**: `http://localhost:3001`
  - Health check: `GET /health`
  - Generate content: `POST /api/generate`

- **Identity Service**: `http://localhost:3002`
  - Health check: `GET /health`
  - User operations: `POST /api/users`

## 🔍 Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :3001
lsof -i :3002

# Kill processes if needed
kill -9 <PID>
```

**Permission denied (Unix/Linux/macOS):**
```bash
chmod +x run.sh
```

**Node.js version issues:**
```bash
# Check version (need 18+)
node --version

# Install Node.js from https://nodejs.org/
```

**Dependencies issues:**
```bash
# Clean and reinstall
./run.sh clean
rm -rf node_modules
./run.sh install
```

### Getting Help

- Run `./run.sh help` for command details
- Check service-specific README files
- Review logs in the terminal output
- Check the main [README.md](./README.md) for architecture details

## 🎨 Customization

### Environment Variables
Create `.env` files in service directories:

```bash
# services/ai-service/.env
OPENAI_API_KEY=your_key_here
PORT=3001

# services/identity-service/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/db
ENCRYPTION_KEY=your_32_character_key_here
```

### Adding New Services
1. Create service in `services/` directory
2. Add to `run.sh` script
3. Update `turbo.json` configuration
4. Add npm scripts to service `package.json`

## 🚀 Next Steps

1. **Explore the Services**: Check out each service's README
2. **Review the Architecture**: Read the main README.md
3. **Check the Specs**: Look at `.kiro/specs/` for feature specifications
4. **Start Building**: Create your first workflow!

## 📚 Documentation

- [Run Scripts Guide](./RUN_SCRIPTS.md) - Detailed script documentation
- [Project README](./README.md) - Architecture and overview
- [Feature Specs](./.kiro/specs/) - Detailed feature specifications

---

**Happy coding! 🎉**

If you run into any issues, the run scripts provide helpful error messages and the community is here to help.