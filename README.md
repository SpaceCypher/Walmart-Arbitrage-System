# Walmart Arbitrage System

Transform Walmart's inventory into a dynamic, self-optimizing profit generator using AI-driven autonomous agents for real-time inventory arbitrage across store locations.

## Features
- AI Product Agents for inventory monitoring and trade negotiation
- Real-time internal marketplace for inventory transfers
- Automated, predictive, and self-healing supply chain
- Modern dashboard for analytics and trade management

## Technology Stack
- **Frontend:** React, TypeScript, TailwindCSS
- **Backend:** Node.js, TypeScript, Express
- **AI Agents:** Python, Gemini API
- **Database:** MongoDB Atlas, KeyDB

## Getting Started

### 1. Frontend
```sh
cd frontend && npm i && npm run build && npm start
```

### 2. Backend
```sh
cd backend && npm i && npm run dev
```

### 3. AI Agents
```sh
cd ai-agents
then run:
pip install -r requirements.txt

cd ai-agents && source venv/bin/activate && python simple_ai_api.py
#NOTE above for mac/ linux
cd ai-agents && venv\Scripts\activate && python simple_ai_api.py
FOR WINDOWS

```
### 4. To get it running u need to run the following in your terminal imp : 
```sh
curl -X POST http://localhost:3001/api/v1/ai-agents/cycle
---

For more details, see the respective folder README or documentation.
