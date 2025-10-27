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

# Get container names dynamically
POSTGRES_CONTAINER=$(docker ps --filter "ancestor=postgres:15-alpine" --format "{{.Names}}" | head -1)
REDIS_CONTAINER=$(docker ps --filter "ancestor=redis:7-alpine" --format "{{.Names}}" | head -1)
KAFKA_CONTAINER=$(docker ps --filter "ancestor=confluentinc/cp-kafka:7.4.0" --format "{{.Names}}" | head -1)

# Check PostgreSQL
echo "Checking PostgreSQL container: $POSTGRES_CONTAINER"
RETRY_COUNT=0
MAX_RETRIES=30
until docker exec "$POSTGRES_CONTAINER" pg_isready -U officeflow > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ PostgreSQL failed to start after $MAX_RETRIES attempts"
        echo "Check logs with: docker logs $POSTGRES_CONTAINER"
        exit 1
    fi
    echo "Waiting for PostgreSQL... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Check Redis
echo "Checking Redis container: $REDIS_CONTAINER"
RETRY_COUNT=0
until docker exec "$REDIS_CONTAINER" redis-cli ping > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Redis failed to start after $MAX_RETRIES attempts"
        exit 1
    fi
    echo "Waiting for Redis... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done
echo "✅ Redis is ready"

# Check Kafka
echo "Checking Kafka container: $KAFKA_CONTAINER"
RETRY_COUNT=0
until docker exec "$KAFKA_CONTAINER" kafka-topics --list --bootstrap-server localhost:9092 > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Kafka failed to start after $MAX_RETRIES attempts"
        exit 1
    fi
    echo "Waiting for Kafka... (attempt $RETRY_COUNT/$MAX_RETRIES)"
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
