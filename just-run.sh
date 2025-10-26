#!/bin/bash

# Just get it running - no bullshit
set -e

echo "🚀 Getting OfficeFlow running..."

# Install turbo globally
echo "📦 Installing turbo..."
npm install -g turbo@latest

# Clean everything
echo "🧹 Cleaning up..."
rm -rf node_modules
rm -f pnpm-lock.yaml
find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true

# Install pnpm if needed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --no-frozen-lockfile

# Start infrastructure
echo "🐳 Starting infrastructure..."
docker-compose -f docker-compose.dev.yml up -d

# Wait a bit
echo "⏳ Waiting for infrastructure..."
sleep 10

# Start services
echo "🚀 Starting services..."
pnpm run dev

echo "✅ Done!"