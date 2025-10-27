#!/bin/bash

echo "🚀 Starting OfficeFlow Platform with Authentication..."
echo ""

# Check if Docker services are running
echo "📋 Checking Docker services..."
if ! docker ps | grep -q postgres; then
    echo "❌ PostgreSQL is not running. Please start Docker services first:"
    echo "   docker-compose -f docker-compose.dev.yml up -d"
    exit 1
fi

echo "✅ Docker services are running"
echo ""

# Kill any existing processes
echo "🔄 Cleaning up existing processes..."
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

# Start all services
echo "🚀 Starting all services..."
echo "   - Auth Service (port 3001)"
echo "   - Workflow Engine (port 3000)"
echo "   - AI Service (port 3003)"
echo "   - Frontend (port 5173)"
echo ""

pnpm run dev \
  --filter="@officeflow/auth-service" \
  --filter="@officeflow/workflow-engine" \
  --filter="@officeflow/workflow-designer" \
  --filter="@officeflow/ai-service"

