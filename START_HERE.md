# 🚀 Quick Start Guide - OfficeFlow Platform

## Prerequisites

- Docker Desktop (running)
- Node.js 18+ and pnpm
- PostgreSQL, Redis, Kafka (via Docker)

## Step 1: Start Infrastructure

```bash
# Start all Docker services (PostgreSQL, Redis, Kafka, MinIO)
docker-compose -f docker-compose.dev.yml up -d

# Wait ~10 seconds for services to be ready
```

## Step 2: Run All Application Services

### Option A: Use the startup script (Recommended)
```bash
./start-all.sh
```

### Option B: Manual command
```bash
pnpm run dev \
  --filter="@officeflow/auth-service" \
  --filter="@officeflow/workflow-engine" \
  --filter="@officeflow/workflow-designer" \
  --filter="@officeflow/ai-service"
```

## Services & Ports

After starting, the following services will be available:

| Service | Port | URL |
|---------|------|-----|
| **Frontend (Workflow Designer)** | 5173 | http://localhost:5173 |
| **Auth Service** | 3001 | http://localhost:3001/api/auth/health |
| **Workflow Engine** | 3000 | http://localhost:3000/api/health |
| **AI Service** | 3003 | http://localhost:3003/health |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| Kafka | 9092 | localhost:9092 |
| MinIO | 9000 | http://localhost:9000 |

## Step 3: Access the Application

1. Open your browser to **http://localhost:5173**
2. You'll see the beautiful login page with two tabs:
   - **Sign In**: For existing users
   - **Sign Up**: Create a new account

### Create Your First Account

1. Click on the **Sign Up** tab
2. Fill in:
   - **Full Name**: Your name
   - **Email**: your@email.com
   - **Password**: Minimum 8 characters
   - **Confirm Password**: Same as password
3. Click **Create Account**
4. You'll be automatically logged in! 🎉

### Or Sign In

Use any account you've created, or use the demo credentials:
- **Email**: demo@officeflow.com
- **Password**: demo123 (Note: You'll need to create this account first via Sign Up)

## Features

Once logged in, you'll have access to:

- **Dashboard**: Overview of workflows and metrics
- **Workflows**: Create and manage automated workflows with drag-and-drop designer
- **Monitoring**: Real-time workflow execution monitoring
- **Admin**: User and integration management
- **Settings**: Profile, notifications, security settings

## Troubleshooting

### Services Not Starting?

1. **Check Docker is running**:
   ```bash
   docker ps
   ```
   You should see: postgres, redis, zookeeper, kafka, minio

2. **Check if ports are available**:
   ```bash
   lsof -i :3000  # Workflow Engine
   lsof -i :3001  # Auth Service
   lsof -i :3003  # AI Service
   lsof -i :5173  # Frontend
   ```

3. **Kill existing processes**:
   ```bash
   pkill -f "tsx watch"
   pkill -f "vite"
   ```

### Environment Variables

Make sure your `.env` file in the root directory contains:
```bash
DATABASE_URL=postgresql://officeflow:officeflow_dev@localhost:5432/officeflow
REDIS_URL=redis://localhost:6379
KAFKA_BROKER_URL=localhost:9092
ANTHROPIC_API_KEY=your_key_here
```

### Registration Fails?

- Make sure the **Auth Service (port 3001)** is running
- Check the terminal for error messages
- Verify PostgreSQL is accessible

### Can't Create Workflows?

- Make sure the **Workflow Engine (port 3000)** is running
- Check browser console for errors
- Verify you're logged in

## Development

### View Logs

All services log to the terminal. You'll see:
- `@officeflow/auth-service:dev` - Authentication logs
- `@officeflow/workflow-engine:dev` - Workflow execution logs  
- `@officeflow/ai-service:dev` - AI service logs
- `@officeflow/workflow-designer:dev` - Frontend (Vite) logs

### Stop Services

Press `Ctrl+C` in the terminal where services are running.

To stop Docker services:
```bash
docker-compose -f docker-compose.dev.yml down
```

## Next Steps

1. **Create your first workflow**:
   - Go to Workflows → Click "New Workflow"
   - Drag nodes from the sidebar
   - Connect them by dragging from node to node
   - Configure each node's properties
   - Save your workflow!

2. **Explore the dashboard** to see your workflow metrics

3. **Check monitoring** to see workflow execution in real-time

4. **Customize settings** in the Settings page

---

**Need Help?** Check the logs in your terminal or see the full documentation in `/docs`

**Enjoying OfficeFlow?** ⭐ Star the repo!

