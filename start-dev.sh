#!/bin/bash

# OfficeFlow Development Startup Script
# This script starts all services for local development

set -e

echo "🚀 Starting OfficeFlow Platform Development Environment..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required but not installed. Aborting." >&2; exit 1; }

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from env.example..."
    cp env.example .env.local
    echo "⚠️  Please update .env.local with your API keys (especially OPENAI_API_KEY)"
    echo "Press Enter to continue after updating the file..."
    read
fi

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Start Docker infrastructure
echo "🐳 Starting Docker infrastructure..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for infrastructure services to be ready..."
sleep 10

# Check PostgreSQL
until docker exec officeflow-postgres pg_isready -U officeflow > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Check Redis
until docker exec officeflow-redis redis-cli ping > /dev/null 2>&1; do
    echo "Waiting for Redis..."
    sleep 2
done
echo "✅ Redis is ready"

# Check Kafka
until docker exec officeflow-kafka kafka-topics.sh --list --bootstrap-server localhost:9092 > /dev/null 2>&1; do
    echo "Waiting for Kafka..."
    sleep 2
done
echo "✅ Kafka is ready"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

# Build packages
echo "🔨 Building packages..."
pnpm run build --filter="@officeflow/types"
pnpm run build --filter="@officeflow/config"
pnpm run build --filter="@officeflow/shared"
pnpm run build --filter="@officeflow/observability"
pnpm run build --filter="@officeflow/database"

# Run database migrations
echo "🗄️ Running database migrations..."
cd packages/database && pnpm run migrate && cd ../..

# Start all services
echo "🎯 Starting all services..."
echo "   Workflow Engine: http://localhost:3000"
echo "   Workflow Designer: http://localhost:5173"
echo "   AI Service: http://localhost:3003"
echo ""

# Start services (excluding Slack if no credentials)
if [ -z "$SLACK_BOT_TOKEN" ] || [ "$SLACK_BOT_TOKEN" = "xoxb-placeholder-token" ]; then
    echo "ℹ️  Skipping Slack service (no credentials provided)"
    pnpm run dev --filter="!@officeflow/slack-service"
else
    pnpm run dev
fi
