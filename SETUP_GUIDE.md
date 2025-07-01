# 🚀 AI Arbitrage Trading System - Setup Guide

This guide will help you set up and run the complete AI Arbitrage Trading System on any laptop with the same environment.

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.8 or higher)
- **Git**
- **Docker** (optional, for database setup)
- **MongoDB** (local or cloud)
- **Redis** (local or cloud)

## 🔧 Step-by-Step Setup

### 1. Clone the Repository
```bash
git clone https://github.com/SpaceCypher/Walmart-Arbitrage-System.git
cd Walmart-Arbitrage-System
```

### 2. Install Node.js Dependencies

#### Backend Setup
```bash
cd backend
npm install
```

#### Frontend Setup
```bash
cd ../frontend
npm install
cd ..
```

### 3. Set Up Python AI Agents
```bash
cd ai-agents
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

pip install -r requirements.txt
cd ..
```

### 4. Database Setup

#### Option A: Using Docker (Recommended)
```bash
# Start MongoDB and Redis using Docker Compose
docker-compose up -d mongodb redis
```

#### Option B: Local Installation
**MongoDB:**
```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb
sudo systemctl start mongodb

# Windows - Download from MongoDB website
```

**Redis:**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Windows - Download from Redis website or use WSL
```

### 5. Environment Configuration

#### Backend Environment
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/arbitrage-system
REDIS_URL=redis://localhost:6379

# API Keys (get from respective services)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here

# External APIs (optional for full functionality)
WALMART_API_KEY=your_walmart_api_key
AMAZON_API_KEY=your_amazon_api_key
```

#### Frontend Environment
```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api/v1
REACT_APP_WS_URL=ws://localhost:5000
```

#### AI Agents Environment
```bash
cd ../ai-agents
cp .env.example .env
```

Edit `ai-agents/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
BACKEND_URL=http://localhost:5000
REDIS_URL=redis://localhost:6379
```

### 6. Database Initialization

#### Generate Sample Data
```bash
cd backend
npm run build
npm run generate-data
```

#### Run Database Migrations (if any)
```bash
npm run migrate
```

### 7. Build the Applications

#### Build Backend
```bash
cd backend
npm run build
```

#### Build Frontend
```bash
cd ../frontend
npm run build
```

## 🚀 Running the Application

### Method 1: Start All Services Individually

#### Terminal 1: Start Database Services
```bash
# If using Docker
docker-compose up mongodb redis

# If using local services, make sure they're running
```

#### Terminal 2: Start Backend Server
```bash
cd backend
npm run dev
# Backend will run on http://localhost:5000
```

#### Terminal 3: Start AI Agents
```bash
cd ai-agents
source venv/bin/activate  # Windows: venv\Scripts\activate
python ai_agent_api.py
# AI agents will run on http://localhost:8000
```

#### Terminal 4: Start Frontend
```bash
cd frontend
npm start
# Frontend will run on http://localhost:3000
```

### Method 2: Use Docker Compose (All Services)
```bash
# Start everything with Docker
docker-compose up -d

# Or start with logs visible
docker-compose up
```

### Method 3: Production Build
```bash
# Build all components
npm run build:all

# Start production server
npm run start:prod
```

## 🔍 Verification Steps

### 1. Check Backend Health
```bash
curl http://localhost:5000/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-07-02T...",
  "services": {
    "database": "connected",
    "redis": "connected",
    "agents": "active"
  }
}
```

### 2. Check AI Agents
```bash
curl http://localhost:8000/health
```

### 3. Check Frontend
Open browser and go to:
```
http://localhost:3000
```

You should see the trading dashboard with:
- Trading opportunities
- Marketplace data
- Analytics dashboard
- AI insights

### 4. Test API Endpoints
```bash
# Get marketplace data
curl http://localhost:5000/api/v1/marketplace/bids

# Get AI opportunities
curl http://localhost:5000/api/v1/ai-agents/opportunities

# Get trade decisions
curl http://localhost:5000/api/v1/trade-decisions
```

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### 1. Port Already in Use
```bash
# Check what's using the port
lsof -i :3000  # or :5000, :8000
# Kill the process
kill -9 <PID>
```

#### 2. Database Connection Issues
```bash
# Check MongoDB status
mongosh --eval "db.runCommand('ping')"

# Check Redis status
redis-cli ping
```

#### 3. Missing Dependencies
```bash
# Clear npm cache and reinstall
cd frontend && rm -rf node_modules package-lock.json
npm cache clean --force
npm install

cd ../backend && rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

#### 4. Python Environment Issues
```bash
cd ai-agents
rm -rf venv
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### 5. Build Errors
```bash
# Frontend build issues
cd frontend
npm run build 2>&1 | tee build.log

# Backend build issues
cd ../backend
npm run build 2>&1 | tee build.log
```

## 📱 Access Points

Once everything is running:

- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:5000/api/v1
- **AI Agents API**: http://localhost:8000
- **API Documentation**: http://localhost:5000/api/docs (if implemented)

## 🔧 Development Commands

### Useful Development Commands
```bash
# Watch mode for backend
cd backend && npm run dev

# Watch mode for frontend
cd frontend && npm start

# Run tests
npm run test

# Lint code
npm run lint

# Check logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f ai-agents
```

### Database Management
```bash
# Backup database
mongodump --db arbitrage-system --out ./backup

# Restore database
mongorestore --db arbitrage-system ./backup/arbitrage-system

# Reset database (careful!)
cd backend && npm run reset-db
```

## 🎯 Quick Start Script

Create a file called `quick-start.sh`:
```bash
#!/bin/bash
echo "🚀 Starting AI Arbitrage Trading System..."

# Start databases
echo "📦 Starting databases..."
docker-compose up -d mongodb redis

# Wait for databases
sleep 10

# Start backend
echo "⚙️ Starting backend..."
cd backend && npm run dev &

# Wait for backend
sleep 15

# Start AI agents
echo "🤖 Starting AI agents..."
cd ../ai-agents && source venv/bin/activate && python ai_agent_api.py &

# Wait for AI agents
sleep 10

# Start frontend
echo "🖥️ Starting frontend..."
cd ../frontend && npm start

echo "✅ All services started!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:5000"
echo "🤖 AI Agents: http://localhost:8000"
```

Make it executable and run:
```bash
chmod +x quick-start.sh
./quick-start.sh
```

## 🚨 Important Notes

1. **API Keys**: Make sure to get actual API keys for production use
2. **Security**: Change all default passwords and secrets
3. **Database**: For production, use MongoDB Atlas or other cloud services
4. **Monitoring**: Check logs regularly for any issues
5. **Updates**: Keep dependencies updated for security

## 📞 Support

If you encounter any issues:
1. Check the logs in each terminal
2. Verify all services are running
3. Check the troubleshooting section above
4. Ensure all environment variables are set correctly

Happy Trading! 💰📈
