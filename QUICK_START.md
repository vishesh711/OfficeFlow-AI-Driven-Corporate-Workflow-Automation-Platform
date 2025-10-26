# OfficeFlow Platform - Quick Start Guide

## 🚀 Quick Setup (2 minutes)

### One-Command Setup (Recommended)
```bash
# This does everything: installs dependencies, starts infrastructure, and runs services
./just-run.sh
```

### Manual Setup (If you prefer step-by-step)
```bash
# 1. Install dependencies
pnpm install --no-frozen-lockfile

# 2. Start infrastructure services (PostgreSQL, Redis, Kafka, MinIO)
docker-compose -f docker-compose.dev.yml up -d

# 3. Start application services locally
pnpm run dev
```

## 🔧 Troubleshooting

### Common Issues

#### 1. "turbo: command not found" or dependency errors
```bash
# Just run the setup script
./just-run.sh
```

#### 2. Docker build fails with "packages not found"
```bash
# Use the development compose file instead
docker-compose -f docker-compose.dev.yml up -d
```

#### 3. Port conflicts
```bash
# Check what's using the ports
lsof -i :3000-3008 :5432 :6379 :9092 :5173

# Kill conflicting processes or stop existing containers
docker-compose -f docker-compose.dev.yml down

# Or kill specific processes if needed
kill -9 <PID>
```

## 📊 Service Status

After running the setup, you can access:

### Infrastructure Services
- **PostgreSQL**: localhost:5432 (user: officeflow, password: officeflow_dev)
- **Redis**: localhost:6379
- **Kafka**: localhost:9092
- **MinIO**: localhost:9000 (console: localhost:9001)

### Application Services (when running locally)
- **Workflow Engine**: http://localhost:3000
- **Auth Service**: http://localhost:3001
- **Identity Service**: http://localhost:3002
- **AI Service**: http://localhost:3003
- **Email Service**: http://localhost:3004
- **Document Service**: http://localhost:3005
- **Calendar Service**: http://localhost:3006
- **Slack Service**: http://localhost:3007
- **Webhook Gateway**: http://localhost:3008

### Frontend Application
- **Workflow Designer**: http://localhost:5173

## 🎯 Next Steps

1. **Check Service Health**:
   ```bash
   curl http://localhost:3000/health  # Workflow Engine
   curl http://localhost:3001/health  # Auth Service
   ```

2. **View Logs**:
   ```bash
   # Infrastructure logs
   docker-compose -f docker-compose.dev.yml logs -f

   # Application logs (if running locally)
   pnpm run dev  # Shows all service logs
   ```

3. **Stop Services**:
   ```bash
   # Stop infrastructure
   docker-compose -f docker-compose.dev.yml down

   # Stop application services
   Ctrl+C  # If running pnpm run dev
   ```

## 📚 Documentation

- **[Complete Documentation](docs/README.md)** - Full documentation index
- **[Server-Side Guide](docs/SERVER_SIDE.md)** - Backend services documentation
- **[Client-Side Guide](docs/CLIENT_SIDE.md)** - Frontend documentation
- **[Requirements](docs/REQUIREMENTS.md)** - System requirements and specifications
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment

## 🆘 Need Help?

1. **Check the logs** for error messages
2. **Run the fix script**: `./fix-setup.sh`
3. **Use development compose**: `docker-compose -f docker-compose.dev.yml up -d`
4. **Check documentation** in the `docs/` directory
5. **Create an issue** if problems persist

---

**Happy coding! 🎉**