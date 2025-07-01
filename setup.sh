#!/bin/bash

# 🚀 AI Arbitrage Trading System - Quick Setup Script
# Run this script to set up everything automatically

set -e  # Exit on any error

echo "🚀 AI Arbitrage Trading System - Quick Setup"
echo "============================================="

# Check prerequisites
echo "🔍 Checking prerequisites..."

command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Please install Node.js v18+"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ Python3 is required but not installed. Please install Python 3.8+"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ Git is required but not installed. Please install Git"; exit 1; }

echo "✅ Prerequisites check passed!"

# Clone repository if not already cloned
if [ ! -d "Walmart-Arbitrage-System" ]; then
    echo "📥 Cloning repository..."
    git clone https://github.com/SpaceCypher/Walmart-Arbitrage-System.git
    cd Walmart-Arbitrage-System
else
    echo "📁 Repository already exists, using existing directory"
    cd Walmart-Arbitrage-System
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

# Install frontend dependencies
echo "🖥️ Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Set up Python virtual environment
echo "🐍 Setting up Python environment..."
cd ai-agents
python3 -m venv venv

# Activate virtual environment based on OS
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

pip install -r requirements.txt
cd ..

# Create environment files
echo "⚙️ Creating environment files..."

# Backend .env
cat > backend/.env << EOF
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/arbitrage-system
REDIS_URL=redis://localhost:6379

# API Keys (replace with actual keys for production)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# JWT Secret
JWT_SECRET=arbitrage_system_secret_key_12345

# External APIs (optional)
WALMART_API_KEY=your_walmart_api_key
AMAZON_API_KEY=your_amazon_api_key
EOF

# Frontend .env
cat > frontend/.env << EOF
REACT_APP_API_URL=http://localhost:5000/api/v1
REACT_APP_WS_URL=ws://localhost:5000
EOF

# AI Agents .env
cat > ai-agents/.env << EOF
GEMINI_API_KEY=your_gemini_api_key_here
BACKEND_URL=http://localhost:5000
REDIS_URL=redis://localhost:6379
EOF

# Check for Docker
if command -v docker >/dev/null 2>&1 && command -v docker-compose >/dev/null 2>&1; then
    echo "🐳 Docker found! Starting databases with Docker..."
    docker-compose up -d mongodb redis
    
    echo "⏳ Waiting for databases to start..."
    sleep 10
    
else
    echo "⚠️ Docker not found. Please start MongoDB and Redis manually:"
    echo "   MongoDB: mongod --dbpath /path/to/data"
    echo "   Redis: redis-server"
    echo "   Or install Docker for easier setup"
    read -p "Press Enter when databases are running..."
fi

# Build applications
echo "🔨 Building applications..."
cd backend
npm run build
cd ../frontend
npm run build
cd ..

# Generate sample data
echo "🎲 Generating sample data..."
cd backend
npm run generate-data 2>/dev/null || echo "⚠️ Sample data generation skipped (may need database running)"
cd ..

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "🚀 To start the application, run these commands in separate terminals:"
echo ""
echo "Terminal 1 - Backend:"
echo "  cd backend && npm run dev"
echo ""
echo "Terminal 2 - Frontend:"
echo "  cd frontend && npm start"
echo ""
echo "Terminal 3 - AI Agents:"
echo "  cd ai-agents && source venv/bin/activate && python ai_agent_api.py"
echo ""
echo "🌐 Access the application at:"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:5000"
echo "  AI Agents: http://localhost:8000"
echo ""
echo "📚 For detailed instructions, see SETUP_GUIDE.md"
echo ""
echo "Happy Trading! 💰📈"
