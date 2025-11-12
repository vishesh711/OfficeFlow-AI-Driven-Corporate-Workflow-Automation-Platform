# 🐛 Troubleshooting Guide

Common issues and their fixes for the OfficeFlow platform.

## 📋 Available Guides

### General Fixes
- **[Fixes Applied](FIXES_APPLIED.md)** - Summary of all fixes applied
- **[Fixes Summary](FIXES_SUMMARY.md)** - Detailed list of fixes

### Registration Issues
- **[Registration Troubleshooting](REGISTRATION_TROUBLESHOOTING.md)** - Common registration problems
- **[Registration Fix Summary](REGISTRATION_FIX_SUMMARY.md)** - Registration fix details

### Testing Issues
- **[Test Run Fix](TEST_RUN_FIX.md)** - Fixing test execution problems
- **[Template Test Run Fix](TEMPLATE_TEST_RUN_FIX.md)** - Template-specific test fixes

### Workflow Issues
- **[Workflow Save Fix](WORKFLOW_SAVE_FIX.md)** - Fixing workflow saving problems

## 🆘 Quick Troubleshooting Steps

1. **Check logs**: Review application and service logs
2. **Verify environment**: Ensure all environment variables are set
3. **Check dependencies**: Run `pnpm install`
4. **Restart services**: Use `./just-run.sh` or `./start-dev.sh`
5. **Clear cache**: Delete `node_modules` and reinstall

## 🔗 Related Documentation

- [Getting Started Guide](../guides/GETTING_STARTED.md)
- [Run Scripts Guide](../guides/RUN_SCRIPTS.md)
- [CI/CD Documentation](../cicd/)

---

[← Back to Documentation](../README.md)

