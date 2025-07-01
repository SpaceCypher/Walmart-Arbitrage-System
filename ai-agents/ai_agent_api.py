from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import asyncio
import logging
from datetime import datetime
import uvicorn
import os
from crew_orchestrator import AIAgentOrchestrator, run_agent_cycle
from gemini_agent import DatabaseManager
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Agent Management API",
    description="CrewAI-powered product management agents with Gemini AI",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global orchestrator
orchestrator = AIAgentOrchestrator()
db_manager = DatabaseManager()

# Pydantic models
class ProductAnalysisRequest(BaseModel):
    product_ids: List[str]
    force_analysis: bool = False

class AgentStatusResponse(BaseModel):
    total_products: int
    active_crews: int
    recent_decisions: int
    system_health: str
    last_updated: str

class OpportunityResponse(BaseModel):
    product_id: str
    opportunities: List[Dict[str, Any]]
    analysis_timestamp: str

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "AI Agent Management API",
        "version": "1.0.0",
        "powered_by": ["CrewAI", "Gemini AI", "FastAPI"],
        "endpoints": {
            "/status": "Get agent system status",
            "/analyze": "Analyze specific products",
            "/cycle": "Run complete agent cycle",
            "/opportunities": "Get recent opportunities"
        }
    }

@app.get("/status", response_model=AgentStatusResponse)
async def get_agent_status():
    """Get current status of the AI agent system"""
    try:
        status = orchestrator.get_agent_status()
        return AgentStatusResponse(**status)
    except Exception as e:
        logger.error(f"Error getting agent status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
async def analyze_products(request: ProductAnalysisRequest):
    """Analyze specific products using AI crews"""
    try:
        results = []
        
        for product_id in request.product_ids:
            result = await orchestrator.manage_product(product_id)
            results.append(result)
        
        return {
            "status": "completed",
            "analyzed_products": len(results),
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error analyzing products: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cycle")
async def run_cycle(background_tasks: BackgroundTasks):
    """Run a complete agent management cycle for all products"""
    try:
        # Run in background to avoid timeout
        background_tasks.add_task(run_agent_cycle)
        
        return {
            "status": "started",
            "message": "Agent cycle started in background",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error starting agent cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/opportunities")
async def get_recent_opportunities(limit: int = 20):
    """Get recent opportunities identified by agents"""
    try:
        decisions = list(db_manager.db.agent_decisions.find(
            {"decision.analysis_result.opportunities": {"$exists": True, "$not": {"$size": 0}}},
            {"productId": 1, "decision.analysis_result.opportunities": 1, "timestamp": 1}
        ).sort("timestamp", -1).limit(limit))
        
        opportunities = []
        for decision in decisions:
            analysis = decision.get('decision', {}).get('analysis_result', {})
            for opp in analysis.get('opportunities', []):
                opportunities.append({
                    "product_id": decision.get('productId'),
                    "opportunity": opp,
                    "timestamp": decision.get('timestamp')
                })
        
        return {
            "opportunities": opportunities,
            "count": len(opportunities),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting opportunities: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/products/{product_id}/status")
async def get_product_status(product_id: str):
    """Get detailed status for a specific product"""
    try:
        # Get product data
        product_data = db_manager.get_product_data(product_id)
        if not product_data:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Get recent decisions
        recent_decisions = list(db_manager.db.agent_decisions.find(
            {"productId": product_id}
        ).sort("timestamp", -1).limit(5))
        
        # Get cached decision
        cached_decision = db_manager.redis_client.get(f"recent_decision:{product_id}")
        if cached_decision:
            cached_decision = eval(cached_decision.decode())
        
        return {
            "product_id": product_id,
            "product_name": product_data.name,
            "category": product_data.category,
            "total_inventory": sum(inv.get('quantity', 0) for inv in product_data.inventory_levels),
            "store_count": len(product_data.inventory_levels),
            "recent_decisions": len(recent_decisions),
            "last_analysis": recent_decisions[0].get('timestamp') if recent_decisions else None,
            "cached_decision": cached_decision,
            "status": "active" if product_id in orchestrator.crews else "inactive"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting product status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/products/{product_id}/analyze")
async def analyze_single_product(product_id: str):
    """Analyze a single product immediately"""
    try:
        result = await orchestrator.manage_product(product_id)
        return result
    except Exception as e:
        logger.error(f"Error analyzing product {product_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test database connections
        db_status = "healthy"
        try:
            db_manager.db.products.find_one()
        except:
            db_status = "unhealthy"
        
        redis_status = "healthy"
        try:
            db_manager.redis_client.ping()
        except:
            redis_status = "unhealthy"
        
        return {
            "status": "healthy" if db_status == "healthy" and redis_status == "healthy" else "unhealthy",
            "database": db_status,
            "redis": redis_status,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Background task to run continuous agent management
@app.on_event("startup")
async def startup_event():
    """Initialize the AI agent system on startup"""
    logger.info("Starting AI Agent Management API...")
    logger.info("CrewAI orchestrator initialized")
    
    # Optionally start a background task for continuous management
    if os.getenv("AUTO_START_AGENTS", "false").lower() == "true":
        logger.info("Auto-starting continuous agent management...")
        # You can implement continuous background processing here

if __name__ == "__main__":
    port = int(os.getenv("AGENT_API_PORT", 8000))
    uvicorn.run(
        "ai_agent_api:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
