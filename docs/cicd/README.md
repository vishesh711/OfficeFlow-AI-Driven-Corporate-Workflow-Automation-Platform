# 🔄 CI/CD Documentation

Continuous Integration and Deployment setup for OfficeFlow.

## 📋 Available Documentation

- **[CI/CD Setup](CI_CD_SETUP.md)** - Complete setup instructions
- **[CI/CD Status](CICD_STATUS.md)** - Current status and configuration
- **[PR Description Template](PR_DESCRIPTION.md)** - Pull request guidelines

## 🚀 Workflows

### Active Workflows
- **CI Pipeline** - Runs on push and PR (lint, test, build)
- **Continuous Deployment** - Builds and pushes Docker images
- **Security Scanning** - Runs on push (disabled on schedule)
- **PR Checks** - Validates pull requests
- **Performance Testing** - Manual only (disabled on schedule)

### Disabled Workflows
- ~~Cron Jobs~~ - Scheduled maintenance (commented out)
- ~~Daily Security Scans~~ - (commented out)
- ~~Daily Performance Tests~~ - (commented out)

## 🔧 GitHub Actions Setup

### Required Secrets
None required for basic functionality! Workflows use `GITHUB_TOKEN` (automatic).

### Optional Secrets
- `SNYK_TOKEN` - For enhanced security scanning
- `SEMGREP_APP_TOKEN` - For SAST scanning
- `STAGING_KUBECONFIG` - For staging deployments
- `PRODUCTION_KUBECONFIG` - For production deployments
- `SLACK_WEBHOOK_URL` - For notifications

## 📊 Workflow Status

All non-critical checks are configured with `continue-on-error: true`:
- ✅ Allows PR merging even with warnings
- ⚠️ Shows status but doesn't block
- 🔧 Can be fixed later without blocking development

## 🎯 Best Practices

1. **Keep workflows fast** - Use caching and parallel jobs
2. **Make non-critical checks non-blocking** - Don't block PRs unnecessarily
3. **Use matrix strategies** - Build multiple services in parallel
4. **Add continue-on-error** - For optional checks
5. **Comment out schedules** - When not actively developing

## 🔗 Related Documentation

- [Deployment Guide](../../DEPLOYMENT.md)
- [Security Policy](../../SECURITY.md)
- [Workflow Files](../../.github/workflows/)

---

[← Back to Documentation](../README.md)

