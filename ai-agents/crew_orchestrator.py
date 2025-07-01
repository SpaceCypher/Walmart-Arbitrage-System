from crewai import Agent, Task, Crew, Process
from crewai.tools import BaseTool
from typing import List, Dict, Any, Optional
import asyncio
import logging
from datetime import datetime, timedelta
from gemini_agent import GeminiAgent, DatabaseManager, MarketOpportunity
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class ProductAnalysisTool(BaseTool):
    name: str = "Product Analysis Tool"
    description: str = "Analyzes product data and identifies market opportunities using Gemini AI"
    
    def _run(self, product_id: str) -> Dict[str, Any]:
        """Run product analysis for a specific product"""
        try:
            db_manager = DatabaseManager()
            agent = GeminiAgent(product_id, db_manager)
            
            # Get product data
            product_data = db_manager.get_product_data(product_id)
            if not product_data:
                return {"error": f"Product {product_id} not found"}
            
            # Get marketplace data
            marketplace_data = db_manager.get_marketplace_data()
            
            # Analyze and get opportunities
            opportunities = agent.analyze_product(product_data, marketplace_data)
            
            return {
                "product_id": product_id,
                "opportunities_count": len(opportunities),
                "opportunities": [opp.__dict__ for opp in opportunities],
                "analysis_timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error in product analysis tool: {e}")
            return {"error": str(e)}

class MarketplaceTool(BaseTool):
    name: str = "Marketplace Tool"
    description: str = "Executes marketplace actions like creating bids and managing trades"
    
    def _run(self, action: str, product_id: str, **kwargs) -> Dict[str, Any]:
        """Execute marketplace actions"""
        try:
            db_manager = DatabaseManager()
            agent = GeminiAgent(product_id, db_manager)
            
            if action == "execute_opportunity":
                opportunity_data = kwargs.get('opportunity_data')
                if not opportunity_data:
                    return {"error": "No opportunity data provided"}
                
                # Convert dict back to MarketOpportunity object
                opportunity = MarketOpportunity(**opportunity_data)
                result = agent.execute_opportunity(opportunity)
                return result
            
            return {"error": f"Unknown action: {action}"}
        except Exception as e:
            logger.error(f"Error in marketplace tool: {e}")
            return {"error": str(e)}

class AIAgentOrchestrator:
    """CrewAI-based orchestrator for managing multiple product agents"""
    
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.active_products = set()
        self.crews = {}  # Store crews for each product
        
    def create_product_crew(self, product_id: str) -> Crew:
        """Create a CrewAI crew for a specific product"""
        
        # Define agents with specific roles
        inventory_analyst = Agent(
            role='Inventory Analyst',
            goal=f'Monitor and optimize inventory levels for product {product_id}',
            backstory=f"""You are an expert inventory analyst specializing in product {product_id}. 
            Your job is to continuously monitor stock levels across all stores, identify low-stock 
            situations, and recommend optimal inventory distribution.""",
            verbose=True,
            allow_delegation=False,
            tools=[ProductAnalysisTool()]
        )
        
        arbitrage_specialist = Agent(
            role='Arbitrage Specialist',
            goal=f'Find and execute profitable arbitrage opportunities for product {product_id}',
            backstory=f"""You are a skilled arbitrage trader focused on product {product_id}. 
            You excel at identifying price discrepancies and inventory imbalances between stores 
            that can be exploited for profit while maintaining efficient inventory distribution.""",
            verbose=True,
            allow_delegation=False,
            tools=[ProductAnalysisTool(), MarketplaceTool()]
        )
        
        risk_manager = Agent(
            role='Risk Manager',
            goal=f'Assess and mitigate risks in trading decisions for product {product_id}',
            backstory=f"""You are a conservative risk manager for product {product_id}. 
            Your role is to evaluate all proposed trades and arbitrage opportunities, 
            ensuring they meet safety criteria and don't expose the system to unnecessary risks.""",
            verbose=True,
            allow_delegation=False,
            tools=[ProductAnalysisTool()]
        )
        
        # Define tasks
        analysis_task = Task(
            description=f"""
            Analyze the current state of product {product_id}:
            1. Review inventory levels across all stores
            2. Identify potential arbitrage opportunities
            3. Assess market conditions and trends
            4. Generate actionable insights
            
            Use the Product Analysis Tool to gather comprehensive data.
            """,
            agent=inventory_analyst,
            expected_output="Detailed analysis with opportunities and recommendations"
        )
        
        arbitrage_task = Task(
            description=f"""
            Based on the inventory analysis, identify and evaluate arbitrage opportunities for product {product_id}:
            1. Review the analysis results
            2. Calculate potential profits for each opportunity
            3. Prioritize opportunities by profitability and risk
            4. Execute high-confidence, low-risk opportunities
            
            Use both Product Analysis Tool and Marketplace Tool as needed.
            """,
            agent=arbitrage_specialist,
            expected_output="List of executed or recommended arbitrage actions"
        )
        
        risk_assessment_task = Task(
            description=f"""
            Review all proposed actions for product {product_id} and assess risks:
            1. Evaluate the risk level of each proposed action
            2. Check if actions align with risk management policies
            3. Recommend modifications to reduce risk if necessary
            4. Approve or reject high-risk proposals
            
            Focus on protecting against excessive losses and maintaining system stability.
            """,
            agent=risk_manager,
            expected_output="Risk assessment report with recommendations"
        )
        
        # Create crew
        crew = Crew(
            agents=[inventory_analyst, arbitrage_specialist, risk_manager],
            tasks=[analysis_task, arbitrage_task, risk_assessment_task],
            process=Process.sequential,
            verbose=True
        )
        
        return crew
    
    async def manage_product(self, product_id: str) -> Dict[str, Any]:
        """Manage a single product using CrewAI"""
        try:
            # Create or get existing crew for this product
            if product_id not in self.crews:
                self.crews[product_id] = self.create_product_crew(product_id)
            
            crew = self.crews[product_id]
            
            # Execute the crew workflow
            logger.info(f"Starting AI crew workflow for product {product_id}")
            result = crew.kickoff()
            
            logger.info(f"Completed AI crew workflow for product {product_id}")
            
            return {
                "product_id": product_id,
                "status": "completed",
                "result": str(result),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error managing product {product_id}: {e}")
            return {
                "product_id": product_id,
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def manage_all_products(self) -> List[Dict[str, Any]]:
        """Manage all active products concurrently"""
        try:
            # Get list of active products from database
            products = list(self.db_manager.db.products.find(
                {"isActive": True}, 
                {"productId": 1}
            ).limit(int(os.getenv('MAX_AGENTS', 50))))
            
            product_ids = [p['productId'] for p in products]
            logger.info(f"Managing {len(product_ids)} products with AI crews")
            
            # Process products in batches to avoid overwhelming the system
            batch_size = 5
            results = []
            
            for i in range(0, len(product_ids), batch_size):
                batch = product_ids[i:i + batch_size]
                logger.info(f"Processing batch {i//batch_size + 1}: {batch}")
                
                # Process batch concurrently
                batch_tasks = [self.manage_product(pid) for pid in batch]
                batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                
                results.extend(batch_results)
                
                # Small delay between batches
                await asyncio.sleep(2)
            
            return results
            
        except Exception as e:
            logger.error(f"Error in manage_all_products: {e}")
            return [{"error": str(e)}]
    
    def get_agent_status(self) -> Dict[str, Any]:
        """Get status of all AI agents"""
        try:
            total_products = self.db_manager.db.products.count_documents({"isActive": True})
            active_crews = len(self.crews)
            
            # Get recent decisions
            recent_decisions = list(self.db_manager.db.agent_decisions.find(
                {"timestamp": {"$gte": datetime.now() - timedelta(hours=1)}}
            ).sort("timestamp", -1).limit(10))
            
            return {
                "total_products": total_products,
                "active_crews": active_crews,
                "recent_decisions": len(recent_decisions),
                "system_health": "healthy" if active_crews > 0 else "inactive",
                "last_updated": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting agent status: {e}")
            return {"error": str(e)}

# Main execution functions
async def run_agent_cycle():
    """Run a complete agent cycle for all products"""
    orchestrator = AIAgentOrchestrator()
    results = await orchestrator.manage_all_products()
    
    logger.info(f"Completed agent cycle. Processed {len(results)} products")
    return results

def run_continuous_agents():
    """Run agents continuously with specified intervals"""
    async def agent_loop():
        orchestrator = AIAgentOrchestrator()
        
        while True:
            try:
                logger.info("Starting new agent management cycle...")
                results = await orchestrator.manage_all_products()
                
                successful = len([r for r in results if r.get('status') == 'completed'])
                failed = len([r for r in results if r.get('status') == 'error'])
                
                logger.info(f"Cycle completed. Successful: {successful}, Failed: {failed}")
                
                # Wait for next cycle
                interval = int(os.getenv('AGENT_DECISION_INTERVAL', 60))
                logger.info(f"Waiting {interval} seconds until next cycle...")
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"Error in agent loop: {e}")
                await asyncio.sleep(30)  # Wait 30 seconds before retrying
    
    # Run the async loop
    asyncio.run(agent_loop())

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "continuous":
        logger.info("Starting continuous AI agent management...")
        run_continuous_agents()
    else:
        logger.info("Running single AI agent cycle...")
        results = asyncio.run(run_agent_cycle())
        print(f"Processed {len(results)} products")
        for result in results[:5]:  # Show first 5 results
            print(f"- {result.get('product_id', 'Unknown')}: {result.get('status', 'Unknown')}")
