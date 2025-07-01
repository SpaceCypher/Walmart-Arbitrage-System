# 🚀 Quick Start Commands

## For Your Friend's Laptop

### Option 1: Super Quick Setup (Recommended)
```bash
# 1. Clone and setup everything automatically
git clone https://github.com/SpaceCypher/Walmart-Arbitrage-System.git
cd Walmart-Arbitrage-System
./setup.sh

# 2. Start all services
./start.sh
```

### Option 2: Manual Step-by-Step
```bash
# 1. Clone repository
git clone https://github.com/SpaceCypher/Walmart-Arbitrage-System.git
cd Walmart-Arbitrage-System

# 2. Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd ai-agents && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && cd ..

# 3. Start databases (if Docker available)
docker-compose up -d mongodb redis

# 4. Start services (in 3 separate terminals)
# Terminal 1:
cd backend && npm run dev

# Terminal 2:
cd ai-agents && source venv/bin/activate && python ai_agent_api.py

# Terminal 3:
cd frontend && npm start
```

## 📱 Access Points
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000
- **AI Agents**: http://localhost:8000

## 🛠️ Prerequisites
- Node.js 18+
- Python 3.8+
- Git
- Docker (optional but recommended)

## 📞 Need Help?
See `SETUP_GUIDE.md` for detailed instructions and troubleshooting.
