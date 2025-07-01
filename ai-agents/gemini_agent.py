import os
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import google.generativeai as genai
from pymongo import MongoClient
import redis
import json
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO')),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.getenv('LOG_FILE', 'agents.log')),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

@dataclass
class ProductData:
    product_id: str
    name: str
    category: str
    brand: str
    pricing: Dict[str, Any]
    inventory_levels: List[Dict[str, Any]]
    market_trends: Dict[str, Any]
    last_updated: datetime

@dataclass
class MarketOpportunity:
    type: str  # 'arbitrage', 'restock', 'price_optimization'
    confidence: float
    potential_profit: float
    source_store: str
    target_store: str
    quantity: int
    reasoning: str
    urgency: str  # 'low', 'medium', 'high', 'critical'

class DatabaseManager:
    """Handles connections to MongoDB and KeyDB"""
    
    def __init__(self):
        self.mongo_client = MongoClient(os.getenv('MONGODB_URI'))
        self.db = self.mongo_client.arbitrage_network
        self.redis_client = redis.from_url(os.getenv('KEYDB_URL'))
        
    def get_product_data(self, product_id: str) -> Optional[ProductData]:
        """Fetch comprehensive product data from database"""
        try:
            # Get product info
            product = self.db.products.find_one({'productId': product_id})
            if not product:
                return None
                
            # Get inventory levels
            inventory = list(self.db.inventories.find({'productId': product_id}))
            
            # Get recent market data (if available)
            market_trends = self.redis_client.hgetall(f"market_trends:{product_id}")
            if market_trends:
                market_trends = {k.decode(): v.decode() for k, v in market_trends.items()}
            else:
                market_trends = {}
            
            return ProductData(
                product_id=product_id,
                name=product.get('name', ''),
                category=product.get('category', ''),
                brand=product.get('brand', ''),
                pricing=product.get('pricing', {}),
                inventory_levels=inventory,
                market_trends=market_trends,
                last_updated=datetime.now()
            )
        except Exception as e:
            logger.error(f"Error fetching product data for {product_id}: {e}")
            return None
    
    def update_agent_decision(self, product_id: str, decision: Dict[str, Any]):
        """Store agent decision in database"""
        try:
            self.db.agent_decisions.insert_one({
                'productId': product_id,
                'decision': decision,
                'timestamp': datetime.now()
            })
            
            # Cache recent decision in Redis
            self.redis_client.setex(
                f"recent_decision:{product_id}",
                300,  # 5 minutes
                json.dumps(decision, default=str)
            )
        except Exception as e:
            logger.error(f"Error storing decision for {product_id}: {e}")
    
    def get_marketplace_data(self) -> Dict[str, Any]:
        """Get current marketplace state"""
        try:
            response = requests.get(f"{os.getenv('BACKEND_API_URL')}/api/v1/marketplace/bids")
            bids = response.json().get('data', {}).get('bids', [])
            
            response = requests.get(f"{os.getenv('BACKEND_API_URL')}/api/v1/marketplace/matches")
            matches = response.json().get('data', {}).get('matches', [])
            
            return {
                'active_bids': len(bids),
                'recent_matches': len(matches),
                'market_activity': 'high' if len(bids) > 10 else 'low'
            }
        except Exception as e:
            logger.error(f"Error fetching marketplace data: {e}")
            return {'active_bids': 0, 'recent_matches': 0, 'market_activity': 'low'}

class GeminiAgent:
    """Individual AI agent powered by Gemini for product management"""
    
    def __init__(self, product_id: str, db_manager: DatabaseManager):
        self.product_id = product_id
        self.db_manager = db_manager
        
        # Configure Gemini
        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        self.model = genai.GenerativeModel(
            model_name=os.getenv('GEMINI_MODEL', 'gemini-1.5-flash'),
            generation_config={
                'temperature': float(os.getenv('GEMINI_TEMPERATURE', 0.7)),
                'max_output_tokens': int(os.getenv('GEMINI_MAX_TOKENS', 2048)),
            }
        )
        
        self.role = f"""You are an AI agent responsible for managing product {product_id}. Your primary responsibilities include:

1. INVENTORY MONITORING: Track stock levels across different stores and identify low-stock situations
2. ARBITRAGE DETECTION: Find profitable opportunities to transfer inventory between stores
3. PRICE OPTIMIZATION: Analyze pricing trends and suggest optimal pricing strategies
4. DEMAND FORECASTING: Predict future demand based on historical data and market trends
5. RISK ASSESSMENT: Evaluate potential risks in trading decisions

You should always provide:
- Clear reasoning for your decisions
- Confidence levels (0-1) for your recommendations
- Specific action items with expected outcomes
- Risk assessments for proposed actions

Respond in JSON format with structured data that can be easily processed."""

    def analyze_product(self, product_data: ProductData, marketplace_data: Dict[str, Any]) -> List[MarketOpportunity]:
        """Analyze product data and identify opportunities"""
        
        try:
            # Prepare context for Gemini
            context = self._prepare_analysis_context(product_data, marketplace_data)
            
            prompt = f"""
{self.role}

CURRENT PRODUCT DATA:
{json.dumps(context, indent=2, default=str)}

ANALYSIS REQUEST:
Please analyze this product data and identify opportunities for:
1. Inventory arbitrage between stores
2. Restocking recommendations
3. Price optimization suggestions
4. Risk factors to consider

Provide your response in the following JSON format:
{{
    "opportunities": [
        {{
            "type": "arbitrage|restock|price_optimization",
            "confidence": 0.0-1.0,
            "potential_profit": estimated_profit_amount,
            "source_store": "store_id_or_null",
            "target_store": "store_id_or_null", 
            "quantity": recommended_quantity,
            "reasoning": "detailed_explanation",
            "urgency": "low|medium|high|critical"
        }}
    ],
    "overall_assessment": "summary_of_product_health",
    "risk_factors": ["list", "of", "risks"],
    "confidence_score": 0.0-1.0
}}
"""

            response = self.model.generate_content(prompt)
            
            # Parse Gemini response
            try:
                result = json.loads(response.text)
                opportunities = []
                
                for opp in result.get('opportunities', []):
                    opportunities.append(MarketOpportunity(
                        type=opp.get('type', 'unknown'),
                        confidence=float(opp.get('confidence', 0)),
                        potential_profit=float(opp.get('potential_profit', 0)),
                        source_store=opp.get('source_store', ''),
                        target_store=opp.get('target_store', ''),
                        quantity=int(opp.get('quantity', 0)),
                        reasoning=opp.get('reasoning', ''),
                        urgency=opp.get('urgency', 'low')
                    ))
                
                # Store the decision
                self.db_manager.update_agent_decision(self.product_id, {
                    'analysis_result': result,
                    'opportunities_found': len(opportunities),
                    'confidence': result.get('confidence_score', 0)
                })
                
                return opportunities
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini response for {self.product_id}: {e}")
                logger.error(f"Raw response: {response.text}")
                return []
                
        except Exception as e:
            logger.error(f"Error in product analysis for {self.product_id}: {e}")
            return []
    
    def _prepare_analysis_context(self, product_data: ProductData, marketplace_data: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare structured context for Gemini analysis"""
        
        # Calculate inventory metrics
        total_inventory = sum(inv.get('quantity', 0) for inv in product_data.inventory_levels)
        avg_price = product_data.pricing.get('basePrice', 0)
        
        # Identify high/low stock stores
        high_stock_stores = [inv for inv in product_data.inventory_levels if inv.get('quantity', 0) > 100]
        low_stock_stores = [inv for inv in product_data.inventory_levels if inv.get('quantity', 0) < 20]
        
        return {
            'product_info': {
                'id': product_data.product_id,
                'name': product_data.name,
                'category': product_data.category,
                'brand': product_data.brand,
                'base_price': avg_price
            },
            'inventory_summary': {
                'total_units': total_inventory,
                'stores_count': len(product_data.inventory_levels),
                'high_stock_stores': len(high_stock_stores),
                'low_stock_stores': len(low_stock_stores)
            },
            'inventory_details': product_data.inventory_levels,
            'marketplace_state': marketplace_data,
            'market_trends': product_data.market_trends,
            'analysis_timestamp': product_data.last_updated.isoformat()
        }
    
    def execute_opportunity(self, opportunity: MarketOpportunity) -> Dict[str, Any]:
        """Execute an identified opportunity by calling backend APIs"""
        
        try:
            if opportunity.type == 'arbitrage' and opportunity.confidence > 0.7:
                # Create marketplace bid for arbitrage
                bid_data = {
                    'productId': self.product_id,
                    'sourceStoreId': opportunity.source_store,
                    'targetStoreId': opportunity.target_store,
                    'quantity': opportunity.quantity,
                    'maxPrice': opportunity.potential_profit * 0.8,  # Conservative pricing
                    'urgency': opportunity.urgency,
                    'reasoning': opportunity.reasoning
                }
                
                response = requests.post(
                    f"{os.getenv('BACKEND_API_URL')}/api/v1/marketplace/bids",
                    json=bid_data
                )
                
                if response.status_code == 201:
                    logger.info(f"Successfully created arbitrage bid for {self.product_id}")
                    return {'status': 'success', 'action': 'bid_created', 'data': bid_data}
                else:
                    logger.error(f"Failed to create bid: {response.text}")
                    return {'status': 'failed', 'error': response.text}
            
            elif opportunity.type == 'restock' and opportunity.confidence > 0.6:
                # Log restock recommendation (backend would handle actual restocking)
                logger.info(f"Restock recommendation for {self.product_id}: {opportunity.reasoning}")
                return {'status': 'logged', 'action': 'restock_recommendation', 'opportunity': opportunity.__dict__}
            
            else:
                logger.info(f"Opportunity confidence too low for {self.product_id}: {opportunity.confidence}")
                return {'status': 'skipped', 'reason': 'low_confidence'}
                
        except Exception as e:
            logger.error(f"Error executing opportunity for {self.product_id}: {e}")
            return {'status': 'error', 'error': str(e)}
