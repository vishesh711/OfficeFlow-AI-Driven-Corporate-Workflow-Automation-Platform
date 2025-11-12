# 📖 User Guides

Step-by-step guides for using and developing OfficeFlow.

## 🚀 Getting Started

- **[Getting Started](GETTING_STARTED.md)** - Complete setup guide
- **[Start Here](START_HERE.md)** - Quick start overview
- **[Run Scripts](RUN_SCRIPTS.md)** - How to run the application

## 💻 Development

- **[Template Modification](TEMPLATE_MODIFICATION_GUIDE.md)** - How to modify workflow templates
- **[Workflow Examples](WORKFLOW_EXAMPLES.md)** - Example workflow configurations

## 🎯 Quick Commands

### Start the Application
```bash
# Quick start (recommended)
./just-run.sh

# Or development mode
./start-dev.sh

# Or manual
pnpm install
docker-compose -f docker-compose.dev.yml up -d
pnpm run dev
```

### Common Tasks
```bash
# Install dependencies
pnpm install

# Run tests
pnpm run test

# Build everything
pnpm run build

# Lint and format
pnpm run lint --fix
pnpm run format

# Type check
pnpm run type-check
```

## 📂 Project Structure

```
officeflow-platform/
├── apps/               # Frontend apps
│   └── workflow-designer/
├── services/           # Backend services
│   ├── auth-service/
│   ├── workflow-engine/
│   ├── ai-service/
│   └── ...
├── packages/           # Shared packages
│   ├── types/
│   ├── config/
│   ├── database/
│   └── ...
├── k8s/               # Kubernetes configs
├── scripts/           # Helper scripts
└── docs/              # Documentation
```

## 🔗 Related Documentation

- [Troubleshooting](../troubleshooting/README.md)
- [CI/CD Documentation](../cicd/README.md)
- [Main Documentation](../README.md)

---

[← Back to Documentation](../README.md)

