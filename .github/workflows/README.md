# GitHub Actions Workflows

This directory contains all CI/CD automation workflows for the OfficeFlow platform.

## 📋 Workflow Overview

### **Active Workflows**

| Workflow | File | Trigger | Purpose | Secrets Required |
|----------|------|---------|---------|------------------|
| 🔄 **Basic CI** | `basic-ci.yml` | Push, PR | Quick validation, no secrets needed | None ✅ |
| 🏗️ **CI Pipeline** | `ci.yml` | Push, PR | Full testing and building | None ✅ |
| 🚀 **Continuous Deployment** | `cd.yml` | Push to main | Build & push Docker images | `GITHUB_TOKEN` (auto) ✅ |
| 🔒 **Security Scanning** | `security.yml` | Daily, Push | Security vulnerability scans | Optional ⚠️ |
| 📊 **Performance Testing** | `performance.yml` | Daily, Manual | Load and performance tests | Optional ⚠️ |
| 🚢 **Deploy to Production** | `deploy.yml` | Tags, Manual | Production deployment | AWS/K8s required ❌ |
| ✅ **PR Checks** | `pr-checks.yml` | Pull Request | PR validation | None ✅ |

### **Workflow Status**

- ✅ = Works without configuration
- ⚠️ = Works with warnings, full features need secrets
- ❌ = Requires configuration to work

## 🚀 Quick Start

### **Minimal Setup (No secrets required):**

These workflows will work immediately:

1. **basic-ci.yml** - Simple validation
2. **ci.yml** - Full CI pipeline  
3. **cd.yml** - Docker image builds
4. **pr-checks.yml** - Pull request validation

### **Full Setup (All features):**

See [GITHUB_ACTIONS_FIX.md](./GITHUB_ACTIONS_FIX.md) for complete setup guide.

## 🔧 Recent Fixes Applied

### **January 2024 - Docker Build Context Fix**

**Problem**: Docker builds were failing because the build context was set to individual service directories, but Dockerfiles expect root context to access shared packages.

**Solution**:
- Changed `context: services/auth-service` → `context: .`
- Updated `file: services/auth-service/Dockerfile`
- Fixed in both `cd.yml` and `security.yml`

**Files Modified**:
- ✅ `.github/workflows/cd.yml` (line 82-84)
- ✅ `.github/workflows/security.yml` (line 149-150)

### **January 2024 - Security Policy Added**

**Problem**: Security compliance checks were failing due to missing SECURITY.md

**Solution**:
- ✅ Created `/SECURITY.md` with comprehensive security policy

### **January 2024 - Multi-arch Build Optimized**

**Problem**: ARM64 builds were taking too long and not needed for most deployments

**Solution**:
- Changed `platforms: linux/amd64,linux/arm64` → `platforms: linux/amd64`
- Reduced build time by ~50%
- Can be re-enabled if ARM64 support needed

## 📖 Workflow Details

### **basic-ci.yml** (Recommended for testing)

Simple workflow with no external dependencies:

```yaml
Triggers: Push, Pull Request
Jobs:
  - Quick Checks (type-check, lint, format)
  - Build Services
  - Docker Build Verification (sample services)
  - CI Summary
```

**Why use this:**
- No secrets required
- Fast execution (~5-10 minutes)
- Good for development validation

### **ci.yml** (Standard CI)

Full CI pipeline with comprehensive checks:

```yaml
Triggers: Push to main/develop, Pull Requests
Jobs:
  - Lint & Type Check
  - Run Tests (with PostgreSQL & Redis)
  - Build All Services
  - Build Docker Images (on main branch)
  - Security Scan
  - Lighthouse Performance
```

**Services Used:**
- PostgreSQL 15 (for integration tests)
- Redis 7 (for caching tests)

### **cd.yml** (Continuous Deployment)

Builds and pushes Docker images to GitHub Container Registry:

```yaml
Triggers: Push to main, Version tags
Registry: ghcr.io
Services Built:
  - workflow-engine
  - auth-service
  - identity-service
  - ai-service
  - email-service
  - document-service
  - calendar-service
  - slack-service
  - webhook-gateway
  - workflow-designer
```

**Features:**
- Multi-service matrix builds
- SBOM generation
- Security scanning
- Automatic staging deployment
- Blue-green production deployment

### **security.yml** (Security Scanning)

Comprehensive security scanning suite:

```yaml
Triggers: Daily at 2 AM UTC, Push to main, Manual
Scans:
  - Dependency vulnerabilities (npm audit, Snyk)
  - SAST (CodeQL, Semgrep)
  - Secret scanning (TruffleHog, GitLeaks)
  - Container scanning (Trivy, Grype, Docker Scout)
  - IaC scanning (Checkov, Terrascan, kube-score)
  - License compliance
  - Security policy compliance
```

**Optional Secrets:**
- `SNYK_TOKEN` - For Snyk scanning
- `SEMGREP_APP_TOKEN` - For Semgrep SAST
- `SECURITY_SLACK_WEBHOOK_URL` - For notifications

### **deploy.yml** (Production Deployment)

Production deployment to Kubernetes:

```yaml
Triggers: Push to main, Version tags, Manual
Environments: staging, production
Strategy: Blue-Green deployment
```

**Required Secrets:**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (if using AWS EKS)
- `STAGING_KUBECONFIG`, `PRODUCTION_KUBECONFIG`
- `SLACK_WEBHOOK_URL` (optional, for notifications)

### **performance.yml** (Performance Testing)

Automated performance and load testing:

```yaml
Triggers: Daily, Push to main, Manual
Tests:
  - Load testing (Artillery)
  - Database performance
  - Frontend performance (Lighthouse)
  - API response time
```

### **pr-checks.yml** (Pull Request Validation)

Validates pull requests before merging:

```yaml
Triggers: Pull Request
Checks:
  - Code quality
  - Test coverage
  - Breaking changes
  - Documentation
  - Commit messages
```

## 🎯 Common Tasks

### **Trigger a Manual Deployment**

1. Go to `Actions` tab
2. Select `Deploy to Production` workflow
3. Click `Run workflow`
4. Select environment: `staging` or `production`
5. Enter version (or leave empty for latest)
6. Click `Run workflow`

### **Trigger Security Scan**

1. Go to `Actions` tab
2. Select `Security Scanning` workflow
3. Click `Run workflow`
4. Select branch: `main`
5. Click `Run workflow`

### **View Container Images**

Images are published to: `ghcr.io/<your-username>/officeflow/<service>:<tag>`

```bash
# Pull an image
docker pull ghcr.io/<username>/officeflow/workflow-engine:latest

# List all images
https://github.com/users/<username>/packages?repo_name=OfficeFlow-AI-Driven-Corporate-Workflow-Automation-Platform
```

## 🐛 Troubleshooting

### **Workflow fails with "Docker build context not found"**

✅ **Fixed** in latest update. Ensure you have the latest version of `cd.yml` and `security.yml`.

### **Security scan fails with "SNYK_TOKEN not found"**

⚠️ **Expected** if you haven't configured Snyk. The scan will continue with other tools.

**To fix:** Add `SNYK_TOKEN` secret in repository settings.

### **Deployment fails with "kubeconfig not found"**

❌ **Expected** if you haven't configured Kubernetes access.

**To fix:** Add `STAGING_KUBECONFIG` and/or `PRODUCTION_KUBECONFIG` secrets.

### **Build fails with "pnpm: command not found"**

Check if `pnpm/action-setup@v2` step is present in the workflow.

### **Tests fail with "Cannot connect to database"**

Ensure PostgreSQL and Redis services are properly configured in the workflow:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    # ... configuration
  redis:
    image: redis:7-alpine
    # ... configuration
```

## 📊 Monitoring Workflows

### **View Workflow Status**

Add status badges to your README.md:

```markdown
![CI Pipeline](https://github.com/<username>/OfficeFlow/actions/workflows/ci.yml/badge.svg)
![CD Pipeline](https://github.com/<username>/OfficeFlow/actions/workflows/cd.yml/badge.svg)
![Security](https://github.com/<username>/OfficeFlow/actions/workflows/security.yml/badge.svg)
```

### **Check Build Logs**

1. Go to `Actions` tab
2. Click on the workflow run
3. Click on the failing job
4. Expand the failing step to see detailed logs

### **Download Artifacts**

Security reports and build artifacts are available for download:

1. Go to workflow run
2. Scroll to `Artifacts` section
3. Download desired artifacts

## 🔐 Security Best Practices

### **Secrets Management**

- ✅ Never commit secrets to repository
- ✅ Use GitHub Secrets for sensitive data
- ✅ Rotate secrets regularly
- ✅ Use environment-specific secrets

### **Workflow Security**

- ✅ Pin action versions (e.g., `@v4` instead of `@main`)
- ✅ Review workflow permissions
- ✅ Use `GITHUB_TOKEN` with minimal permissions
- ✅ Enable branch protection rules

### **Container Security**

- ✅ Multi-stage builds to minimize image size
- ✅ Run containers as non-root user
- ✅ Scan images for vulnerabilities
- ✅ Sign images (future enhancement)

## 📈 Optimization Tips

### **Speed Up Builds**

1. **Use caching**:
   ```yaml
   cache-from: type=gha
   cache-to: type=gha,mode=max
   ```

2. **Parallelize jobs**:
   ```yaml
   strategy:
     matrix:
       service: [auth, workflow, ai]
     max-parallel: 3
   ```

3. **Skip unnecessary jobs**:
   ```yaml
   if: github.event_name == 'push' && github.ref == 'refs/heads/main'
   ```

### **Reduce Workflow Minutes**

- Run security scans only on schedule (daily) or main branch
- Skip performance tests on PRs
- Use `continue-on-error: true` for non-critical jobs

## 📞 Getting Help

### **Resources**

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Setup Node Action](https://github.com/actions/setup-node)

### **Internal Documentation**

- [GITHUB_ACTIONS_FIX.md](./GITHUB_ACTIONS_FIX.md) - Detailed fix guide
- [../../DEPLOYMENT.md](../../DEPLOYMENT.md) - Deployment guide
- [../../SECURITY.md](../../SECURITY.md) - Security policy

### **Support**

If you encounter issues:

1. Check workflow logs for detailed error messages
2. Review [GITHUB_ACTIONS_FIX.md](./GITHUB_ACTIONS_FIX.md)
3. Search GitHub Discussions
4. Open an issue with workflow logs

---

**Last Updated**: January 2024  
**Maintained By**: OfficeFlow Team  
**Version**: 1.0.0
