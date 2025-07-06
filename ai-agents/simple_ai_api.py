from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import asyncio
import logging
from datetime import datetime
import uvicorn
import os
from bson import ObjectId
from simple_ai_agent import AgentRunner, DatabaseManager
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Agent Management API",
    description="Simplified AI-powered product management agents with Gemini AI",
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

# Global agent runner
try:
    agent_runner = AgentRunner()
    db_manager = DatabaseManager()
    logger.info("AI Agent system initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize AI Agent system: {e}")
    agent_runner = None
    db_manager = None

# Pydantic models
class ProductAnalysisRequest(BaseModel):
    product_ids: List[str]
    force_analysis: bool = False

class AgentStatusResponse(BaseModel):
    total_products: int
    system_health: str
    last_updated: str
    ai_agent_available: bool

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "AI Agent Management API",
        "version": "1.0.0",
        "powered_by": ["Gemini AI", "FastAPI"],
        "status": "operational" if agent_runner else "degraded",
        "endpoints": {
            "/status": "Get agent system status",
            "/analyze": "Analyze specific products",
            "/cycle": "Run complete agent cycle",
            "/opportunities": "Get recent opportunities",
            "/health": "Health check"
        }
    }

@app.get("/status", response_model=AgentStatusResponse)
async def get_agent_status():
    """Get current status of the AI agent system"""
    try:
        if not agent_runner:
            return AgentStatusResponse(
                total_products=0,
                system_health="unavailable",
                last_updated=datetime.now().isoformat(),
                ai_agent_available=False
            )
        
        total_products = agent_runner.db_manager.db.products.count_documents({"isActive": True})
        
        return AgentStatusResponse(
            total_products=total_products,
            system_health="healthy",
            last_updated=datetime.now().isoformat(),
            ai_agent_available=True
        )
    except Exception as e:
        logger.error(f"Error getting agent status: {e}")
        return AgentStatusResponse(
            total_products=0,
            system_health="error",
            last_updated=datetime.now().isoformat(),
            ai_agent_available=False
        )

@app.post("/analyze")
async def analyze_products(request: ProductAnalysisRequest):
    """Analyze specific products using AI agents"""
    try:
        if not agent_runner:
            raise HTTPException(status_code=503, detail="AI agent system not available")
        
        results = []
        
        for product_id in request.product_ids:
            result = agent_runner.run_agent_for_product(product_id)
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
async def run_cycle(background_tasks: BackgroundTasks, limit: int = 10):
    """Run a complete agent cycle for multiple products"""
    try:
        if not agent_runner:
            raise HTTPException(status_code=503, detail="AI agent system not available")
        
        def run_agents_background():
            try:
                results = agent_runner.run_agents_for_all_products(limit)
                logger.info(f"Background agent cycle completed: {len(results)} products analyzed")
            except Exception as e:
                logger.error(f"Error in background agent cycle: {e}")
        
        # Run in background
        background_tasks.add_task(run_agents_background)
        
        return {
            "status": "started",
            "message": f"Agent cycle started for up to {limit} products",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error starting agent cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/opportunities")
async def get_recent_opportunities(limit: int = 20, storeId: Optional[str] = None):
    """Get recent opportunities identified by agents, optionally filtered by storeId"""
    try:
        if not db_manager:
            raise HTTPException(status_code=503, detail="Database not available")
        
        decisions = list(db_manager.db.agent_decisions.find(
            {"decision.analysis_result.opportunities": {"$exists": True}},
            {"productId": 1, "decision": 1, "timestamp": 1, "processed_opportunities": 1, "_id": 1}
        ).sort("timestamp", -1).limit(limit * 2))  # Get more to account for filtering
        
        opportunities = []
        for decision in decisions:
            analysis = decision.get('decision', {}).get('analysis_result', {})
            processed_opps = decision.get('processed_opportunities', [])
            decision_id = str(decision.get('_id', ''))
            
            # Create a set of processed opportunity identifiers for quick lookup
            processed_ids = set()
            for proc_opp in processed_opps:
                processed_ids.add(proc_opp.get('opportunity_id', ''))
            
            for i, opp in enumerate(analysis.get('opportunities', [])):
                # Filter by storeId if provided
                if storeId:
                    if not (str(opp.get('source_store', '')) == storeId or str(opp.get('target_store', '')) == storeId):
                        continue
                # Create a unique ID for this opportunity using decision ID, product ID, stores, and index
                opp_id = f"{decision_id}-{decision.get('productId')}-{opp.get('source_store', '')}-{opp.get('target_store', '')}-{i}"
                # Skip if this opportunity has been processed
                if opp_id not in processed_ids:
                    opportunities.append({
                        "id": opp_id,  # Add unique ID for tracking
                        "product_id": decision.get('productId'),
                        "opportunity": opp,
                        "timestamp": decision.get('timestamp'),
                        "analysis": analysis.get('analysis', '')
                    })
        # Limit to requested amount after filtering
        opportunities = opportunities[:limit]
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
        if not db_manager:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Get product data
        product = db_manager.db.products.find_one({"productId": product_id})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Get recent decisions
        recent_decisions = list(db_manager.db.agent_decisions.find(
            {"productId": product_id}
        ).sort("timestamp", -1).limit(5))
        
        # Get inventory count
        inventory_count = db_manager.db.inventories.count_documents({"productId": product_id})
        total_inventory = sum(inv.get('quantity', 0) for inv in 
                            db_manager.db.inventories.find({"productId": product_id}))
        
        return {
            "product_id": product_id,
            "product_name": product.get('name'),
            "category": product.get('category'),
            "total_inventory": total_inventory,
            "store_count": inventory_count,
            "recent_decisions": len(recent_decisions),
            "last_analysis": recent_decisions[0].get('timestamp') if recent_decisions else None,
            "status": "active"
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
        if not agent_runner:
            raise HTTPException(status_code=503, detail="AI agent system not available")
        
        result = agent_runner.run_agent_for_product(product_id)
        return result
    except Exception as e:
        logger.error(f"Error analyzing product {product_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/opportunities/{opportunity_id}/process")
async def process_opportunity(opportunity_id: str, request: dict):
    """Mark an opportunity as processed (approved/rejected)"""
    try:
        if not db_manager:
            raise HTTPException(status_code=503, detail="Database not available")
        
        decision = request.get('decision')
        trade_id = request.get('tradeId')
        bid_id = request.get('bidId')
        processed_at = request.get('processedAt', datetime.now().isoformat())
        
        if not decision or decision not in ['approved', 'rejected']:
            raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'")
        
        # Extract decision ID from opportunity ID
        decision_id = opportunity_id.split('-')[0] if '-' in opportunity_id else None
        
        if decision_id:
            # Update the specific agent decision by its ObjectId
            try:
                decision_obj_id = ObjectId(decision_id)
                update_result = db_manager.db.agent_decisions.update_one(
                    {"_id": decision_obj_id},
                    {
                        "$push": {
                            "processed_opportunities": {
                                "opportunity_id": opportunity_id,
                                "decision": decision,
                                "trade_id": trade_id,
                                "bid_id": bid_id,
                                "processed_at": processed_at
                            }
                        }
                    }
                )
            except Exception as e:
                logger.warning(f"Could not parse decision ID as ObjectId: {e}")
                # Fallback to broader update
                update_result = db_manager.db.agent_decisions.update_many(
                    {"decision.analysis_result.opportunities": {"$exists": True}},
                    {
                        "$push": {
                            "processed_opportunities": {
                                "opportunity_id": opportunity_id,
                                "decision": decision,
                                "trade_id": trade_id,
                                "bid_id": bid_id,
                                "processed_at": processed_at
                            }
                        }
                    }
                )
        else:
            # Fallback to broader update if we can't extract decision ID
            update_result = db_manager.db.agent_decisions.update_many(
                {"decision.analysis_result.opportunities": {"$exists": True}},
                {
                    "$push": {
                        "processed_opportunities": {
                            "opportunity_id": opportunity_id,
                            "decision": decision,
                            "trade_id": trade_id,
                            "bid_id": bid_id,
                            "processed_at": processed_at
                        }
                    }
                }
            )
        
        logger.info(f"Marked opportunity {opportunity_id} as {decision}. Updated {update_result.modified_count} records.")
        
        return {
            "opportunity_id": opportunity_id,
            "decision": decision,
            "trade_id": trade_id,
            "processed_at": processed_at,
            "updated_records": update_result.modified_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing opportunity {opportunity_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test database connections
        db_status = "healthy"
        redis_status = "healthy"
        gemini_status = "healthy"
        
        if db_manager:
            try:
                db_manager.db.products.find_one()
            except:
                db_status = "unhealthy"
            
            try:
                db_manager.redis_client.ping()
            except:
                redis_status = "unhealthy"
        else:
            db_status = "unavailable"
            redis_status = "unavailable"
        
        # Test Gemini API key
        gemini_api_key = os.getenv('GEMINI_API_KEY')
        if not gemini_api_key or gemini_api_key == 'your_gemini_api_key_here':
            gemini_status = "no_api_key"
        
        overall_status = "healthy"
        if db_status != "healthy" or redis_status != "healthy":
            overall_status = "degraded"
        if gemini_status != "healthy":
            overall_status = "configuration_needed"
        
        return {
            "status": overall_status,
            "components": {
                "database": db_status,
                "redis": redis_status,
                "gemini_api": gemini_status,
                "ai_agents": "available" if agent_runner else "unavailable"
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize the AI agent system on startup"""
    logger.info("AI Agent Management API starting...")
    
    # Check configuration
    gemini_key = os.getenv('GEMINI_API_KEY')
    if not gemini_key or gemini_key == 'your_gemini_api_key_here':
        logger.warning("⚠️  Gemini API key not configured. Set GEMINI_API_KEY in .env file")
    else:
        logger.info("✅ Gemini API key configured")
    
    if agent_runner:
        logger.info("✅ AI Agent system ready")
    else:
        logger.warning("❌ AI Agent system failed to initialize")

if __name__ == "__main__":
    port = int(os.getenv("AGENT_API_PORT", 8000))
    logger.info(f"Starting AI Agent API on port {port}")
    uvicorn.run(
        "simple_ai_api:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
