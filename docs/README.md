# 📚 OfficeFlow Documentation

Complete documentation for the OfficeFlow workflow automation platform.

## 🚀 Quick Start

- **[Getting Started Guide](guides/GETTING_STARTED.md)** - Start here!
- **[Start Here](guides/START_HERE.md)** - Quick overview
- **[Run Scripts Guide](guides/RUN_SCRIPTS.md)** - How to run the project

## 📖 Core Documentation

### Architecture & Design
- **[Requirements](REQUIREMENTS.md)** - System requirements and specifications
- **[Server Side](SERVER_SIDE.md)** - Backend architecture and services
- **[Client Side](CLIENT_SIDE.md)** - Frontend architecture
- **[Observability](OBSERVABILITY.md)** - Monitoring and logging

### Deployment
- **[Deployment Guide](../DEPLOYMENT.md)** - Production deployment instructions
- **[CI/CD Documentation](cicd/)** - Continuous integration and deployment

## 🛠️ Guides

- **[Workflow Examples](guides/WORKFLOW_EXAMPLES.md)** - Example workflows
- **[Template Modification](guides/TEMPLATE_MODIFICATION_GUIDE.md)** - How to modify templates

## 🐛 Troubleshooting

Common issues and fixes:

- **[Fixes Applied](troubleshooting/FIXES_APPLIED.md)** - Summary of fixes
- **[Fixes Summary](troubleshooting/FIXES_SUMMARY.md)** - Detailed fixes
- **[Registration Troubleshooting](troubleshooting/REGISTRATION_TROUBLESHOOTING.md)** - Registration issues
- **[Registration Fix Summary](troubleshooting/REGISTRATION_FIX_SUMMARY.md)** - Registration fixes
- **[Test Run Fix](troubleshooting/TEST_RUN_FIX.md)** - Test execution issues
- **[Template Test Run Fix](troubleshooting/TEMPLATE_TEST_RUN_FIX.md)** - Template test issues
- **[Workflow Save Fix](troubleshooting/WORKFLOW_SAVE_FIX.md)** - Workflow saving issues

## 🔄 CI/CD

- **[CI/CD Setup](cicd/CI_CD_SETUP.md)** - Setting up CI/CD
- **[CI/CD Status](cicd/CICD_STATUS.md)** - Current CI/CD status
- **[PR Description Template](cicd/PR_DESCRIPTION.md)** - Pull request template

## 📂 Repository Structure

```
officeflow-platform/
├── apps/               # Frontend applications
│   └── workflow-designer/
├── services/           # Backend microservices
│   ├── auth-service/
│   ├── workflow-engine/
│   └── ...
├── packages/           # Shared packages
│   ├── types/
│   ├── config/
│   └── ...
├── k8s/               # Kubernetes manifests
├── scripts/           # Deployment scripts
├── docs/              # Documentation (you are here)
└── .github/workflows/ # CI/CD workflows
```

## 🔗 Quick Links

- [Main README](../README.md)
- [Security Policy](../SECURITY.md)
- [Contributing Guidelines](../CONTRIBUTING.md) _(if exists)_

## 💬 Need Help?

1. Check the [Troubleshooting section](#-troubleshooting)
2. Review the [Guides](#-guides)
3. Open an issue on GitHub
4. Contact the team

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Maintained By**: OfficeFlow Team
