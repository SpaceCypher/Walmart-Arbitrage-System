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
        try:
            self.mongo_client = MongoClient(os.getenv('MONGODB_URI'))
            self.db = self.mongo_client.arbitrage_db
            self.redis_client = redis.from_url(os.getenv('KEYDB_URL'))
            logger.info("Database connections established")
        except Exception as e:
            logger.error(f"Failed to connect to databases: {e}")
            raise
        
    def get_product_data(self, product_id: str) -> Optional[ProductData]:
        """Fetch comprehensive product data from database"""
        try:
            # Get product info
            product = self.db.products.find_one({'productId': product_id})
            if not product:
                return None
                
            # Get inventory levels
            inventory = list(self.db.inventory.find({'productId': product_id}))
            
            return ProductData(
                product_id=product_id,
                name=product.get('name', ''),
                category=product.get('category', ''),
                brand=product.get('brand', ''),
                pricing=product.get('pricing', {}),
                inventory_levels=inventory,
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

class SimpleAIAgent:
    """Simplified AI agent powered by Gemini for product management"""
    
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
        
        self.system_prompt = f"""You are an AI agent managing product {product_id} in an arbitrage trading system.

Your responsibilities:
1. INVENTORY ANALYSIS: Monitor stock levels across stores - look for imbalances
2. ARBITRAGE DETECTION: Find profitable transfer opportunities between stores
3. MARKET OPTIMIZATION: Suggest pricing and stocking strategies
4. RISK ASSESSMENT: Evaluate trading risks

OPPORTUNITY TYPES TO LOOK FOR:
- ARBITRAGE: When one store has high stock and another has low stock of same product
- RESTOCK: When stores have very low inventory (under reorder point)
- PRICE_OPTIMIZATION: When current pricing doesn't match margin targets

DECISION CRITERIA:
- Generate opportunities when inventory imbalances exist (difference > 100 units)
- Consider transport costs and profit margins in calculations
- Prioritize high-value, high-turnover products
- Account for demand forecasts and seasonality
- ALWAYS specify both source_store and target_store for actionable opportunities
- Calculate realistic profit based on retail price - cost - transport costs

For ARBITRAGE opportunities:
- Source store: High inventory (>200 units above average)
- Target store: Low inventory (<50% of reorder point)
- Profit = (quantity * retail_price * 0.15) - transport_costs
- Transport costs = $5-20 per unit depending on distance

For RESTOCK opportunities:
- Source store: Highest inventory store for the product
- Target store: Store below reorder point
- Profit = (quantity * margin_per_unit) - transport_costs

Always respond with JSON in this format:
{{
    "analysis": "brief summary of current situation with specific numbers",
    "opportunities": [
        {{
            "type": "arbitrage|restock|price_optimization",
            "confidence": 0.0-1.0,
            "potential_profit": estimated_amount,
            "source_store": "store_id_or_null",
            "target_store": "store_id_or_null",
            "quantity": recommended_quantity,
            "reasoning": "explanation",
            "urgency": "low|medium|high|critical"
        }}
    ],
    "recommendations": ["list", "of", "actions"],
    "risk_level": "low|medium|high",
    "confidence_score": 0.0-1.0
}}"""

    def analyze_product(self, product_data: ProductData, marketplace_data: Dict[str, Any]) -> List[MarketOpportunity]:
        """Analyze product data and identify opportunities"""
        
        try:
            # Prepare context for Gemini
            context = self._prepare_analysis_context(product_data, marketplace_data)
            
            prompt = f"""{self.system_prompt}

CURRENT PRODUCT DATA:
{json.dumps(context, indent=2, default=str)}

Please analyze this data and provide your assessment and recommendations."""

            response = self.model.generate_content(prompt)
            
            # Debug: Log the raw response
            logger.info(f"Gemini response for {self.product_id}: {response.text}")
            
            # Parse Gemini response
            try:
                # Clean the response text to extract JSON
                response_text = response.text.strip()
                if '```json' in response_text:
                    response_text = response_text.split('```json')[1].split('```')[0]
                elif '```' in response_text:
                    response_text = response_text.split('```')[1].split('```')[0]
                
                result = json.loads(response_text)
                opportunities = []
                
                for opp in result.get('opportunities', []):
                    opportunities.append(MarketOpportunity(
                        type=opp.get('type', 'unknown'),
                        confidence=float(opp.get('confidence', 0)),
                        potential_profit=float(opp.get('potential_profit', 0)),
                        source_store=opp.get('source_store') or '',
                        target_store=opp.get('target_store') or '',
                        quantity=int(opp.get('quantity', 0)),
                        reasoning=opp.get('reasoning', ''),
                        urgency=opp.get('urgency', 'low')
                    ))
                
                # Store the decision
                self.db_manager.update_agent_decision(self.product_id, {
                    'analysis_result': result,
                    'opportunities_found': len(opportunities),
                    'confidence': result.get('confidence_score', 0),
                    'analysis': result.get('analysis', ''),
                    'risk_level': result.get('risk_level', 'medium')
                })
                
                logger.info(f"AI analysis complete for {self.product_id}: {len(opportunities)} opportunities found")
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
        avg_price = product_data.pricing.get('standardRetail', product_data.pricing.get('baseCost', 0))
        
        # Identify high/low stock stores with more details
        high_stock_stores = [inv for inv in product_data.inventory_levels if inv.get('quantity', 0) > 200]
        low_stock_stores = [inv for inv in product_data.inventory_levels if inv.get('quantity', 0) < inv.get('reorderPoint', 50)]
        critical_low_stores = [inv for inv in product_data.inventory_levels if inv.get('quantity', 0) < (inv.get('reorderPoint', 50) * 0.5)]
        
        # Calculate potential arbitrage pairs
        arbitrage_opportunities = []
        for low_store in critical_low_stores:
            for high_store in high_stock_stores:
                if high_store['storeId'] != low_store['storeId']:
                    quantity_diff = high_store.get('quantity', 0) - low_store.get('quantity', 0)
                    if quantity_diff > 100:
                        arbitrage_opportunities.append({
                            'source_store': high_store['storeId'],
                            'target_store': low_store['storeId'],
                            'source_quantity': high_store.get('quantity', 0),
                            'target_quantity': low_store.get('quantity', 0),
                            'quantity_diff': quantity_diff,
                            'target_reorder_point': low_store.get('reorderPoint', 50),
                            'source_retail_price': high_store.get('retailPrice', avg_price),
                            'target_retail_price': low_store.get('retailPrice', avg_price),
                        })
        
        return {
            'product_info': {
                'id': product_data.product_id,
                'name': product_data.name,
                'category': product_data.category,
                'brand': product_data.brand,
                'standard_retail_price': avg_price,
                'base_cost': product_data.pricing.get('baseCost', 0),
                'margin_targets': product_data.pricing.get('marginTargets', {})
            },
            'inventory_summary': {
                'total_units': total_inventory,
                'stores_count': len(product_data.inventory_levels),
                'high_stock_stores': len(high_stock_stores),
                'low_stock_stores': len(low_stock_stores),
                'critical_low_stores': len(critical_low_stores),
                'average_stock_per_store': total_inventory / max(1, len(product_data.inventory_levels))
            },
            'inventory_details': product_data.inventory_levels[:15],  # More details for analysis
            'arbitrage_opportunities': arbitrage_opportunities[:10],  # Top 10 potential arbitrage pairs
            'marketplace_state': marketplace_data,
            'analysis_timestamp': product_data.last_updated.isoformat()
        }
    
    def execute_opportunity(self, opportunity: MarketOpportunity) -> Dict[str, Any]:
        """Execute an identified opportunity by calling backend APIs"""
        
        try:
            if opportunity.type == 'arbitrage' and opportunity.confidence > 0.6:
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
                    json=bid_data,
                    timeout=10
                )
                
                if response.status_code == 201:
                    logger.info(f"Successfully created arbitrage bid for {self.product_id}")
                    return {'status': 'success', 'action': 'bid_created', 'data': bid_data}
                else:
                    logger.error(f"Failed to create bid: {response.text}")
                    return {'status': 'failed', 'error': response.text}
            
            elif opportunity.type == 'restock' and opportunity.confidence > 0.5:
                # Log restock recommendation (backend would handle actual restocking)
                logger.info(f"Restock recommendation for {self.product_id}: {opportunity.reasoning}")
                return {'status': 'logged', 'action': 'restock_recommendation', 'opportunity': opportunity.__dict__}
            
            else:
                logger.info(f"Opportunity confidence too low for {self.product_id}: {opportunity.confidence}")
                return {'status': 'skipped', 'reason': 'low_confidence'}
                
        except Exception as e:
            logger.error(f"Error executing opportunity for {self.product_id}: {e}")
            return {'status': 'error', 'error': str(e)}

# Main agent runner
class AgentRunner:
    def __init__(self):
        self.db_manager = DatabaseManager()
        
    def run_agent_for_product(self, product_id: str) -> Dict[str, Any]:
        """Run AI agent analysis for a specific product"""
        try:
            # Create agent
            agent = SimpleAIAgent(product_id, self.db_manager)
            
            # Get product data
            product_data = self.db_manager.get_product_data(product_id)
            if not product_data:
                return {"error": f"Product {product_id} not found"}
            
            # Get marketplace data
            marketplace_data = self.db_manager.get_marketplace_data()
            
            # Analyze and get opportunities
            opportunities = agent.analyze_product(product_data, marketplace_data)
            
            # Execute high-confidence opportunities
            executed_actions = []
            for opportunity in opportunities:
                if opportunity.confidence > 0.7:
                    result = agent.execute_opportunity(opportunity)
                    executed_actions.append(result)
            
            return {
                "product_id": product_id,
                "opportunities_found": len(opportunities),
                "opportunities": [opp.__dict__ for opp in opportunities],
                "actions_executed": len(executed_actions),
                "executed_actions": executed_actions,
                "analysis_timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error running agent for {product_id}: {e}")
            return {"error": str(e)}
    
    def run_agents_for_all_products(self, limit=10) -> List[Dict[str, Any]]:
        """Run AI agents for multiple products"""
        try:
            # Get list of active products
            products = list(self.db_manager.db.products.find(
                {"isActive": True}, 
                {"productId": 1}
            ).limit(limit))
            
            product_ids = [p['productId'] for p in products]
            logger.info(f"Running AI agents for {len(product_ids)} products")
            
            results = []
            for product_id in product_ids:
                result = self.run_agent_for_product(product_id)
                results.append(result)
                
                # Small delay between products
                import time
                time.sleep(1)
            
            return results
            
        except Exception as e:
            logger.error(f"Error running agents for all products: {e}")
            return [{"error": str(e)}]

if __name__ == "__main__":
    import sys
    
    runner = AgentRunner()
    
    if len(sys.argv) > 1:
        product_id = sys.argv[1]
        result = runner.run_agent_for_product(product_id)
        print(json.dumps(result, indent=2, default=str))
    else:
        results = runner.run_agents_for_all_products(5)  # Test with 5 products
        print(f"Analyzed {len(results)} products")
        for result in results:
            if 'error' not in result:
                print(f"- {result['product_id']}: {result['opportunities_found']} opportunities")
            else:
                print(f"- Error: {result['error']}")
