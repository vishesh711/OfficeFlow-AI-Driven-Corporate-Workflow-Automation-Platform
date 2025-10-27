# GitHub Actions CI/CD Workflows

This directory contains the GitHub Actions workflows for the OfficeFlow platform.

## Workflows Overview

### 🔄 Continuous Integration & Deployment

#### 1. `ci.yml` - Continuous Integration
**Triggers:** Push to main/develop, Pull Requests

**Jobs:**
- **Lint & Type Check** - ESLint and TypeScript checking
- **Test** - Run unit and integration tests with PostgreSQL and Redis
- **Build** - Build all services and packages
- **Docker Build** - Build and push Docker images (main branch only)
- **Security Scan** - Trivy vulnerability scanning
- **Lighthouse** - Performance testing for frontend (PRs only)

#### 2. `cd.yml` - Continuous Deployment ⭐ (Production-Ready)
**Triggers:** Push to main, version tags, manual dispatch

**Jobs:**
- **Build and Push** - Build Docker images to GitHub Container Registry (ghcr.io)
- **Security Scan Images** - Trivy scanning of built images
- **Deploy Staging** - Deploy to staging environment with smoke tests
- **Deploy Production** - Blue-green deployment to production
- **Rollback** - Automatic rollback on failure
- **Notify Deployment** - Slack notifications and GitHub releases
- **Generate SBOM** - Software Bill of Materials for compliance

**Features:**
- Multi-platform builds (amd64, arm64)
- Blue-green deployment strategy
- Automatic rollback on failure
- Production smoke tests
- SBOM generation for supply chain security

#### 3. `deploy.yml` - Kubernetes Deployment (Alternative)
**Triggers:** Push to main, version tags, manual dispatch

**Jobs:**
- **Deploy to Kubernetes** - Deploy services to AWS EKS cluster
- **Deploy Monitoring** - Setup Prometheus, Grafana, Jaeger
- **Notify** - Send Slack notifications

### ✅ Code Quality & Review

#### 4. `pr-checks.yml` - Pull Request Validation
**Triggers:** Pull Request opened/updated

**Jobs:**
- **PR Labels** - Ensure PR has required labels
- **Conventional Commits** - Check commit message format
- **Code Quality** - Format checking, TODO/FIXME detection
- **Bundle Size** - Monitor frontend bundle size
- **Dependency Review** - Check for vulnerable dependencies
- **Auto-approve Dependabot** - Automatically approve Dependabot PRs

### 🔒 Security & Compliance

#### 5. `security.yml` - Comprehensive Security Scanning ⭐
**Triggers:** Daily at 2 AM UTC, Push to main, Pull Requests, Manual

**Jobs:**
- **Dependency Scan** - npm audit + Snyk vulnerability scanning
- **SAST Scan** - CodeQL + Semgrep static analysis
- **Secret Scan** - TruffleHog + GitLeaks secret detection
- **Container Scan** - Trivy + Grype + Docker Scout image scanning
- **IaC Scan** - Checkov + Terrascan + kube-score for K8s manifests
- **License Scan** - License compliance + SBOM generation
- **Compliance Check** - Validate security policies and best practices
- **Security Report** - Consolidated security report
- **Notify Security Team** - Slack alerts for security issues

**Security Tools:**
- CodeQL (SAST)
- Semgrep (SAST)
- Snyk (Dependency vulnerabilities)
- TruffleHog (Secret detection)
- GitLeaks (Secret detection)
- Trivy (Container & filesystem scanning)
- Grype (Container vulnerabilities)
- Docker Scout (Container CVEs)
- Checkov (IaC security)
- Terrascan (K8s security)

### 📊 Performance & Monitoring

#### 6. `performance.yml` - Performance Testing Suite ⭐
**Triggers:** Daily at 3 AM UTC, Push to main, Manual dispatch

**Jobs:**
- **Load Testing** - Artillery load tests for all services
- **Stress Testing** - k6 stress tests with up to 300 concurrent users
- **Database Performance** - PostgreSQL query performance testing
- **Frontend Performance** - Lighthouse CI performance audits
- **Performance Analysis** - Consolidated performance reports
- **Notify Performance Issues** - Alerts for performance degradation

**Performance Metrics:**
- API response times
- Database query performance
- Frontend bundle size & load times
- Concurrent user handling
- Error rates under load

### ⏰ Scheduled Maintenance

#### 7. `cron-jobs.yml` - Scheduled Maintenance
**Triggers:** Weekly (Mondays 9 AM UTC), Manual dispatch

**Jobs:**
- **Dependency Updates** - Check for outdated packages
- **Database Backup** - Trigger production backups
- **Security Audit** - Run security vulnerability scans

## Required Secrets

Configure these in GitHub Settings → Secrets and variables → Actions:

### Essential Secrets

#### For Deployment (cd.yml)
- `STAGING_KUBECONFIG` - Kubernetes config for staging (base64 encoded)
- `PRODUCTION_KUBECONFIG` - Kubernetes config for production (base64 encoded)
- `GITHUB_TOKEN` - Automatically provided by GitHub

#### For Deployment (deploy.yml - Alternative)
- `AWS_ACCESS_KEY_ID` - AWS access key for EKS
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_REGION` - AWS region (e.g., us-east-1)

### Optional Secrets

#### Security Scanning
- `SNYK_TOKEN` - Snyk API token for vulnerability scanning
- `SEMGREP_APP_TOKEN` - Semgrep token for SAST
- `SECURITY_SLACK_WEBHOOK_URL` - Slack webhook for security alerts

#### Performance Testing
- `TEST_AUTH_TOKEN` - Auth token for performance tests
- `PERFORMANCE_SLACK_WEBHOOK_URL` - Slack webhook for performance alerts

#### General
- `SLACK_WEBHOOK_URL` - Slack webhook for deployment notifications
- `LHCI_GITHUB_APP_TOKEN` - Lighthouse CI GitHub app token

> **Note:** The workflows use GitHub Container Registry (ghcr.io) by default, which requires no additional secrets as `GITHUB_TOKEN` is automatically provided.

## Setup Instructions

### 1. Enable GitHub Actions
Go to your repository → Settings → Actions → General
- Select "Allow all actions and reusable workflows"
- Enable "Allow GitHub Actions to create and approve pull requests"
- Enable "Allow GitHub Actions to create pull requests" (for Dependabot)

### 2. Enable GitHub Container Registry
Go to Settings → Packages
- Make sure packages are visible
- The workflows will automatically push to `ghcr.io/YOUR_USERNAME/officeflow-*`

### 3. Add Required Secrets
Go to Settings → Secrets and variables → Actions → New repository secret

**Minimum for CI/CD:**
```
STAGING_KUBECONFIG=<your-base64-encoded-kubeconfig>
PRODUCTION_KUBECONFIG=<your-base64-encoded-kubeconfig>
```

**Recommended for full functionality:**
```
SNYK_TOKEN=<your-snyk-token>
SLACK_WEBHOOK_URL=<your-slack-webhook>
SECURITY_SLACK_WEBHOOK_URL=<your-security-slack-webhook>
PERFORMANCE_SLACK_WEBHOOK_URL=<your-performance-slack-webhook>
```

### 4. Enable GitHub Security Features
Go to Settings → Code security and analysis
- Enable **Dependency graph**
- Enable **Dependabot alerts**
- Enable **Dependabot security updates**
- Enable **Code scanning** (CodeQL will run automatically)
- Enable **Secret scanning**

### 5. Configure Branch Protection
Settings → Branches → Add branch protection rule for `main`:
- Require a pull request before merging
- Require approvals: 1
- Require status checks to pass before merging:
  - `Lint & Type Check`
  - `Run Tests`
  - `Build All Services`
  - `Static Application Security Testing`
  - `Secret Scanning`
- Require branches to be up to date before merging
- Require conversation resolution before merging

### 6. Set Up Environments
Settings → Environments → New environment

**Staging Environment:**
- Name: `staging`
- Protection rules: No wait timer
- Deployment branches: `main` only
- Add secret: `STAGING_KUBECONFIG`

**Production Environment:**
- Name: `production`
- Protection rules: Required reviewers (1-2 people)
- Wait timer: 5 minutes
- Deployment branches: Tags matching `v*` or `main`
- Add secret: `PRODUCTION_KUBECONFIG`

### 7. Test the Workflows
1. Create a new branch: `git checkout -b feature/test-ci`
2. Make a change: `echo "test" >> README.md`
3. Commit: `git commit -am "feat: test CI/CD"`
4. Push: `git push origin feature/test-ci`
5. Create a PR on GitHub
6. Watch the workflows run!

## Workflow Status Badges

Add these to your README.md:

```markdown
![CI Pipeline](https://github.com/YOUR_USERNAME/OfficeFlow-AI-Driven-Corporate-Workflow-Automation-Platform/workflows/CI%20Pipeline/badge.svg)
![Continuous Deployment](https://github.com/YOUR_USERNAME/OfficeFlow-AI-Driven-Corporate-Workflow-Automation-Platform/workflows/Continuous%20Deployment/badge.svg)
![Security Scanning](https://github.com/YOUR_USERNAME/OfficeFlow-AI-Driven-Corporate-Workflow-Automation-Platform/workflows/Security%20Scanning/badge.svg)
![Performance Testing](https://github.com/YOUR_USERNAME/OfficeFlow-AI-Driven-Corporate-Workflow-Automation-Platform/workflows/Performance%20Testing/badge.svg)
```

## Local Testing

Test workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act

# Run CI workflow
act push

# Run specific job
act -j test

# Run with secrets
act --secret-file .secrets
```

## Troubleshooting

### Workflows not running
- Check Actions tab for error messages
- Verify branch protection rules
- Ensure workflows are enabled in repository settings

### Docker build fails
- Verify Docker Hub credentials are correct
- Check Dockerfile paths in workflow
- Ensure sufficient disk space

### Deployment fails
- Verify AWS credentials
- Check EKS cluster is accessible
- Review kubectl commands in logs

## Best Practices

1. **Keep workflows fast** - Use caching, parallel jobs
2. **Fail fast** - Run quick checks before slow ones
3. **Use matrix builds** - Test multiple versions/services
4. **Monitor costs** - Review Actions usage regularly
5. **Secure secrets** - Never commit secrets, use GitHub Secrets
6. **Document changes** - Update this README when modifying workflows

## Support

For issues with workflows:
1. Check the Actions tab for detailed logs
2. Review this documentation
3. Create an issue with workflow run link

