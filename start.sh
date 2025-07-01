#!/bin/bash

# 🚀 AI Arbitrage Trading System - Start Script
# Run this to start all services after setup

echo "🚀 Starting AI Arbitrage Trading System..."
echo "=========================================="

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️ Port $1 is already in use"
        return 1
    else
        return 0
    fi
}

# Check if setup was completed
if [ ! -f "backend/.env" ] || [ ! -f "frontend/.env" ] || [ ! -f "ai-agents/.env" ]; then
    echo "❌ Setup not completed. Please run ./setup.sh first"
    exit 1
fi

# Check ports
echo "🔍 Checking ports..."
if ! check_port 3000; then
    echo "   Frontend port 3000 is busy"
fi
if ! check_port 5000; then
    echo "   Backend port 5000 is busy"
fi
if ! check_port 8000; then
    echo "   AI Agents port 8000 is busy"
fi

# Start databases if Docker is available
if command -v docker-compose >/dev/null 2>&1; then
    echo "🐳 Starting databases..."
    docker-compose up -d mongodb redis
    sleep 5
fi

# Start backend in background
echo "⚙️ Starting backend server..."
cd backend
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 10

# Start AI agents in background
echo "🤖 Starting AI agents..."
cd ai-agents
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi
python ai_agent_api.py > ../logs/ai-agents.log 2>&1 &
AI_AGENTS_PID=$!
cd ..

# Wait a bit for AI agents to start
sleep 5

# Start frontend (this will block and show output)
echo "🖥️ Starting frontend..."
cd frontend
echo ""
echo "🎉 System is starting up!"
echo ""
echo "🌐 Frontend will be available at: http://localhost:3000"
echo "🔧 Backend API available at: http://localhost:5000"
echo "🤖 AI Agents available at: http://localhost:8000"
echo ""
echo "📊 View logs in the logs/ directory"
echo "⏹️ Press Ctrl+C to stop all services"
echo ""

# Create logs directory
mkdir -p ../logs

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$AI_AGENTS_PID" ]; then
        kill $AI_AGENTS_PID 2>/dev/null
    fi
    # Kill any remaining node processes
    pkill -f "node.*dev" 2>/dev/null
    pkill -f "python.*ai_agent_api" 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Set up signal handling
trap cleanup SIGINT SIGTERM

# Start frontend (this will block)
npm start

# This line will only be reached if npm start exits
cleanup
