import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { keydb } from '../config/keydb';

// Interfaces for AI decision making
export interface MarketContext {
  productId: string;
  currentInventory: Array<{
    storeId: string;
    quantity: number;
    avgSalesPerDay: number;
    daysOfStock: number;
    localDemandScore: number;
    competitorPricing: number[];
  }>;
  marketTrends: {
    seasonalIndex: number;
    demandGrowthRate: number;
    priceElasticity: number;
    competitiveIndex: number;
  };
  historicalPerformance: {
    avgProfitPerTransfer: number;
    successRate: number;
    optimalTransferSize: number;
    bestPerformingRoutes: string[];
  };
  externalFactors: {
    weatherImpact?: number;
    economicIndicators?: number;
    localEvents?: string[];
    supplyChainDisruptions?: boolean;
  };
}

export interface AIDecisionOutput {
  confidence: number;
  reasoning: string;
  strategy: 'aggressive_arbitrage' | 'conservative_rebalancing' | 'hold_position' | 'emergency_liquidation';
  actions: Array<{
    type: 'propose_transfer' | 'adjust_pricing' | 'send_alert' | 'request_restock' | 'negotiate_trade';
    priority: number;
    parameters: any;
    expectedOutcome: {
      profitPotential: number;
      riskLevel: number;
      timeHorizon: string;
    };
  }>;
  marketPredictions: {
    demandForecast: number[];
    priceOptimization: number;
    inventoryNeed: number;
  };
}

export interface LearningUpdate {
  decisionId: string;
  actualOutcome: {
    profitGenerated: number;
    transferSuccess: boolean;
    timeToComplete: number;
    unexpectedEvents: string[];
  };
  lessons: {
    patternReinforced: string[];
    newInsights: string[];
    adjustments: any;
  };
}

export class AgentBrain {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private productId: string;
  private learningHistory: Map<string, any> = new Map();
  
  constructor(productId: string) {
    this.productId = productId;
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Load existing learning data
    this.loadLearningHistory();
  }

  /**
   * Core AI decision making method - analyzes market context and makes strategic decisions
   */
  async makeStrategicDecision(context: MarketContext): Promise<AIDecisionOutput> {
    try {
      // Get recent learning patterns
      const learningContext = await this.getLearningContext();
      
      // Prepare comprehensive prompt for AI
      const prompt = this.buildDecisionPrompt(context, learningContext);
      
      // Get AI decision
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      // Parse and validate AI response
      const decision = this.parseAIResponse(response, context);
      
      // Store decision for learning
      await this.storeDecisionForLearning(decision, context);
      
      // Update real-time patterns
      await this.updateMarketPatterns(context, decision);
      
      logger.info(`AgentBrain for ${this.productId} made strategic decision`, {
        strategy: decision.strategy,
        confidence: decision.confidence,
        actionsCount: decision.actions.length
      });
      
      return decision;
      
    } catch (error) {
      logger.error(`AgentBrain decision error for ${this.productId}:`, error);
      
      // Fallback to rule-based decision
      return this.fallbackDecision(context);
    }
  }

  /**
   * Learn from decision outcomes to improve future performance
   */
  async learnFromOutcome(update: LearningUpdate): Promise<void> {
    try {
      // Store outcome in learning history
      this.learningHistory.set(update.decisionId, {
        timestamp: new Date(),
        outcome: update.actualOutcome,
        lessons: update.lessons
      });
      
      // Update pattern recognition
      await this.updatePatternRecognition(update);
      
      // Adjust strategy weights based on performance
      await this.adjustStrategyWeights(update);
      
      // Persist learning data
      await this.persistLearningHistory();
      
      logger.debug(`AgentBrain for ${this.productId} learned from outcome`, {
        decisionId: update.decisionId,
        profitGenerated: update.actualOutcome.profitGenerated,
        newInsights: update.lessons.newInsights.length
      });
      
    } catch (error) {
      logger.error(`AgentBrain learning error for ${this.productId}:`, error);
    }
  }

  /**
   * Analyze current market opportunities in real-time
   */
  async analyzeMarketOpportunities(context: MarketContext): Promise<Array<{
    type: string;
    description: string;
    profitPotential: number;
    riskLevel: number;
    timeWindow: string;
    confidence: number;
  }>> {
    try {
      const opportunities = [];
      
      // Arbitrage opportunities
      const arbitrageOpps = this.identifyArbitrageOpportunities(context);
      opportunities.push(...arbitrageOpps);
      
      // Seasonal positioning opportunities
      const seasonalOpps = this.identifySeasonalOpportunities(context);
      opportunities.push(...seasonalOpps);
      
      // Competitive pricing opportunities
      const pricingOpps = this.identifyPricingOpportunities(context);
      opportunities.push(...pricingOpps);
      
      // Supply chain optimization opportunities
      const supplyOpps = this.identifySupplyChainOpportunities(context);
      opportunities.push(...supplyOpps);
      
      // Sort by profit potential and confidence
      return opportunities.sort((a, b) => 
        (b.profitPotential * b.confidence) - (a.profitPotential * a.confidence)
      );
      
    } catch (error) {
      logger.error(`Market opportunity analysis error for ${this.productId}:`, error);
      return [];
    }
  }

  /**
   * Generate comprehensive market forecast
   */
  async generateMarketForecast(days: number = 30): Promise<{
    demandForecast: number[];
    priceOptimization: number[];
    inventoryRecommendations: Array<{
      storeId: string;
      recommendedStock: number;
      reasoning: string;
    }>;
    riskFactors: string[];
    confidenceLevel: number;
  }> {
    try {
      // Get historical data for forecasting
      const historicalData = await this.getHistoricalMarketData(days * 2);
      
      // Use AI to generate sophisticated forecast
      const forecastPrompt = this.buildForecastPrompt(historicalData, days);
      const result = await this.model.generateContent(forecastPrompt);
      const forecast = this.parseForecastResponse(result.response.text());
      
      // Apply learning adjustments
      const adjustedForecast = this.applyLearningAdjustments(forecast);
      
      logger.debug(`Generated market forecast for ${this.productId}`, {
        days,
        confidenceLevel: adjustedForecast.confidenceLevel
      });
      
      return adjustedForecast;
      
    } catch (error) {
      logger.error(`Market forecast error for ${this.productId}:`, error);
      
      // Return conservative fallback forecast
      return this.generateFallbackForecast(days);
    }
  }

  // Private helper methods

  private buildDecisionPrompt(context: MarketContext, learningContext: any): string {
    return `
You are an advanced AI agent managing inventory for product ${this.productId} in Walmart's autonomous arbitrage network. 

CURRENT MARKET CONTEXT:
${JSON.stringify(context, null, 2)}

LEARNING HISTORY:
${JSON.stringify(learningContext, null, 2)}

YOUR MISSION:
Maximize profit through intelligent inventory arbitrage while minimizing risk. You can propose transfers, adjust pricing, send alerts, or negotiate trades.

ANALYZE AND DECIDE:
1. Current market inefficiencies and arbitrage opportunities
2. Demand patterns and seasonal factors
3. Optimal inventory positioning across stores
4. Risk factors and mitigation strategies
5. Expected profit and ROI for each potential action

PROVIDE YOUR RESPONSE AS JSON:
{
  "confidence": 0.0-1.0,
  "reasoning": "detailed analysis of market conditions and decision rationale",
  "strategy": "aggressive_arbitrage|conservative_rebalancing|hold_position|emergency_liquidation",
  "actions": [
    {
      "type": "propose_transfer|adjust_pricing|send_alert|request_restock|negotiate_trade",
      "priority": 1-10,
      "parameters": {},
      "expectedOutcome": {
        "profitPotential": 0.0,
        "riskLevel": 0.0-1.0,
        "timeHorizon": "immediate|short_term|medium_term|long_term"
      }
    }
  ],
  "marketPredictions": {
    "demandForecast": [daily forecasts for next 7 days],
    "priceOptimization": optimal_price,
    "inventoryNeed": total_units_needed
  }
}
    `;
  }

  private buildForecastPrompt(historicalData: any, days: number): string {
    return `
As an advanced AI forecasting agent for product ${this.productId}, analyze the historical data and generate a comprehensive ${days}-day forecast.

HISTORICAL DATA:
${JSON.stringify(historicalData, null, 2)}

GENERATE FORECAST JSON:
{
  "demandForecast": [daily demand for ${days} days],
  "priceOptimization": [optimal prices for ${days} days],
  "inventoryRecommendations": [
    {
      "storeId": "store_id",
      "recommendedStock": number,
      "reasoning": "explanation"
    }
  ],
  "riskFactors": ["list of potential risks"],
  "confidenceLevel": 0.0-1.0
}
    `;
  }

  private parseAIResponse(response: string, context: MarketContext): AIDecisionOutput {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      const decision = JSON.parse(jsonMatch[0]);
      
      // Validate and sanitize the decision
      return {
        confidence: Math.max(0, Math.min(1, decision.confidence || 0.5)),
        reasoning: decision.reasoning || 'AI provided decision without detailed reasoning',
        strategy: this.validateStrategy(decision.strategy),
        actions: this.validateActions(decision.actions || []),
        marketPredictions: {
          demandForecast: decision.marketPredictions?.demandForecast || [0, 0, 0, 0, 0, 0, 0],
          priceOptimization: decision.marketPredictions?.priceOptimization || context.currentInventory[0]?.competitorPricing[0] || 0,
          inventoryNeed: decision.marketPredictions?.inventoryNeed || 100
        }
      };
      
    } catch (error) {
      logger.warn(`Failed to parse AI response for ${this.productId}, using fallback`);
      return this.fallbackDecision(context);
    }
  }

  private validateStrategy(strategy: string): AIDecisionOutput['strategy'] {
    const validStrategies = ['aggressive_arbitrage', 'conservative_rebalancing', 'hold_position', 'emergency_liquidation'];
    return validStrategies.includes(strategy) ? strategy as AIDecisionOutput['strategy'] : 'conservative_rebalancing';
  }

  private validateActions(actions: any[]): AIDecisionOutput['actions'] {
    const validActionTypes = ['propose_transfer', 'adjust_pricing', 'send_alert', 'request_restock', 'negotiate_trade'];
    
    return actions
      .filter(action => validActionTypes.includes(action.type))
      .map(action => ({
        type: action.type,
        priority: Math.max(1, Math.min(10, action.priority || 5)),
        parameters: action.parameters || {},
        expectedOutcome: {
          profitPotential: Math.max(0, action.expectedOutcome?.profitPotential || 0),
          riskLevel: Math.max(0, Math.min(1, action.expectedOutcome?.riskLevel || 0.5)),
          timeHorizon: action.expectedOutcome?.timeHorizon || 'medium_term'
        }
      }))
      .slice(0, 5); // Limit to 5 actions
  }

  private fallbackDecision(context: MarketContext): AIDecisionOutput {
    // Simple rule-based fallback when AI fails
    return {
      confidence: 0.3,
      reasoning: 'Fallback decision due to AI processing error - using conservative rule-based approach',
      strategy: 'conservative_rebalancing',
      actions: [{
        type: 'send_alert',
        priority: 5,
        parameters: { message: 'AI decision system requires attention' },
        expectedOutcome: {
          profitPotential: 0,
          riskLevel: 0.1,
          timeHorizon: 'immediate'
        }
      }],
      marketPredictions: {
        demandForecast: [50, 50, 50, 50, 50, 50, 50],
        priceOptimization: context.currentInventory[0]?.competitorPricing[0] || 0,
        inventoryNeed: 100
      }
    };
  }

  private identifyArbitrageOpportunities(context: MarketContext): Array<{
    type: string;
    description: string;
    profitPotential: number;
    riskLevel: number;
    timeWindow: string;
    confidence: number;
  }> {
    const opportunities: Array<{
      type: string;
      description: string;
      profitPotential: number;
      riskLevel: number;
      timeWindow: string;
      confidence: number;
    }> = [];
    
    // Find stores with high stock and low sales vs stores with low stock and high sales
    const lowStockHighDemand = context.currentInventory.filter(inv => 
      inv.daysOfStock < 7 && inv.localDemandScore > 0.7
    );
    const highStockLowDemand = context.currentInventory.filter(inv => 
      inv.daysOfStock > 30 && inv.localDemandScore < 0.3
    );
    
    for (const source of highStockLowDemand) {
      for (const target of lowStockHighDemand) {
        const transferAmount = Math.min(source.quantity * 0.3, target.avgSalesPerDay * 7);
        const profitPotential = transferAmount * (target.competitorPricing[0] - source.competitorPricing[0]) * 0.8;
        
        if (profitPotential > 100) {
          opportunities.push({
            type: 'arbitrage_transfer',
            description: `Transfer ${transferAmount} units from ${source.storeId} to ${target.storeId}`,
            profitPotential,
            riskLevel: 0.2,
            timeWindow: '2-3 days',
            confidence: 0.8
          });
        }
      }
    }
    
    return opportunities;
  }

  private identifySeasonalOpportunities(context: MarketContext): Array<{
    type: string;
    description: string;
    profitPotential: number;
    riskLevel: number;
    timeWindow: string;
    confidence: number;
  }> {
    const opportunities: Array<{
      type: string;
      description: string;
      profitPotential: number;
      riskLevel: number;
      timeWindow: string;
      confidence: number;
    }> = [];
    
    if (context.marketTrends.seasonalIndex > 1.2) {
      opportunities.push({
        type: 'seasonal_positioning',
        description: 'High seasonal demand period - increase inventory in key locations',
        profitPotential: context.currentInventory.reduce((sum, inv) => sum + inv.quantity, 0) * 0.2,
        riskLevel: 0.3,
        timeWindow: '1-2 weeks',
        confidence: 0.7
      });
    }
    
    return opportunities;
  }

  private identifyPricingOpportunities(context: MarketContext): Array<{
    type: string;
    description: string;
    profitPotential: number;
    riskLevel: number;
    timeWindow: string;
    confidence: number;
  }> {
    const opportunities: Array<{
      type: string;
      description: string;
      profitPotential: number;
      riskLevel: number;
      timeWindow: string;
      confidence: number;
    }> = [];
    
    // Check if we can increase prices based on competitor analysis
    context.currentInventory.forEach(inv => {
      const avgCompetitorPrice = inv.competitorPricing.reduce((a, b) => a + b, 0) / inv.competitorPricing.length;
      const currentPrice = avgCompetitorPrice * 0.95; // Assume we're 5% below avg
      
      if (inv.localDemandScore > 0.8 && currentPrice < avgCompetitorPrice * 0.98) {
        opportunities.push({
          type: 'price_optimization',
          description: `Increase price at ${inv.storeId} due to high demand and competitive positioning`,
          profitPotential: inv.quantity * (avgCompetitorPrice * 0.98 - currentPrice),
          riskLevel: 0.4,
          timeWindow: 'immediate',
          confidence: 0.6
        });
      }
    });
    
    return opportunities;
  }

  private identifySupplyChainOpportunities(context: MarketContext): Array<{
    type: string;
    description: string;
    profitPotential: number;
    riskLevel: number;
    timeWindow: string;
    confidence: number;
  }> {
    const opportunities: Array<{
      type: string;
      description: string;
      profitPotential: number;
      riskLevel: number;
      timeWindow: string;
      confidence: number;
    }> = [];
    
    // Identify stores that need restocking
    const needRestock = context.currentInventory.filter(inv => inv.daysOfStock < 3);
    
    if (needRestock.length > 0) {
      opportunities.push({
        type: 'emergency_restock',
        description: `Emergency restocking needed for ${needRestock.length} locations`,
        profitPotential: needRestock.reduce((sum, inv) => sum + inv.avgSalesPerDay * 50, 0), // 50 profit per unit
        riskLevel: 0.8,
        timeWindow: 'immediate',
        confidence: 0.9
      });
    }
    
    return opportunities;
  }

  private async getLearningContext(): Promise<any> {
    // Return recent learning patterns
    const recentLearning = Array.from(this.learningHistory.values())
      .slice(-10)
      .map(entry => ({
        profitGenerated: entry.outcome.profitGenerated,
        lessons: entry.lessons.newInsights
      }));
    
    return {
      recentDecisions: recentLearning,
      averageProfit: recentLearning.reduce((sum, l) => sum + l.profitGenerated, 0) / Math.max(1, recentLearning.length),
      keyLessons: recentLearning.flatMap(l => l.lessons).slice(-5)
    };
  }

  private async storeDecisionForLearning(decision: AIDecisionOutput, context: MarketContext): Promise<void> {
    // Store decision context for future learning
    const decisionId = `${this.productId}_${Date.now()}`;
    
    await keydb.getClient().setex(
      `agent_decision:${decisionId}`,
      86400, // 24 hours
      JSON.stringify({
        decision,
        context,
        timestamp: new Date()
      })
    );
  }

  private async updateMarketPatterns(context: MarketContext, decision: AIDecisionOutput): Promise<void> {
    // Update real-time market pattern recognition
    const patternKey = `market_patterns:${this.productId}`;
    
    try {
      const patterns = await keydb.getClient().hgetall(patternKey) || {};
      
      // Update patterns based on current context
      patterns.avgSeasonalIndex = String(
        (parseFloat(patterns.avgSeasonalIndex || '1') * 0.9) + (context.marketTrends.seasonalIndex * 0.1)
      );
      patterns.avgDemandScore = String(
        (parseFloat(patterns.avgDemandScore || '0.5') * 0.9) + 
        (context.currentInventory.reduce((sum, inv) => sum + inv.localDemandScore, 0) / context.currentInventory.length * 0.1)
      );
      patterns.lastDecisionStrategy = decision.strategy;
      patterns.lastDecisionConfidence = String(decision.confidence);
      
      await keydb.getClient().hmset(patternKey, patterns);
      await keydb.getClient().expire(patternKey, 604800); // 1 week
      
    } catch (error) {
      logger.error(`Failed to update market patterns for ${this.productId}:`, error);
    }
  }

  private async updatePatternRecognition(update: LearningUpdate): Promise<void> {
    // Update pattern recognition based on actual outcomes
    for (const pattern of update.lessons.patternReinforced) {
      // Strengthen successful patterns
      const patternKey = `pattern:${this.productId}:${pattern}`;
      const currentWeight = parseFloat(await keydb.getClient().get(patternKey) || '0.5');
      const newWeight = Math.min(1.0, currentWeight + 0.1);
      await keydb.getClient().setex(patternKey, 604800, String(newWeight));
    }
  }

  private async adjustStrategyWeights(update: LearningUpdate): Promise<void> {
    // Adjust strategy preferences based on performance
    const strategyKey = `strategy_weights:${this.productId}`;
    const weights = await keydb.getClient().hgetall(strategyKey) || {};
    
    // Increase weight for successful strategies
    if (update.actualOutcome.profitGenerated > 0) {
      const currentWeight = parseFloat(weights.successful_strategy || '0.5');
      weights.successful_strategy = String(Math.min(1.0, currentWeight + 0.05));
    }
    
    await keydb.getClient().hmset(strategyKey, weights);
    await keydb.getClient().expire(strategyKey, 604800);
  }

  private async loadLearningHistory(): Promise<void> {
    try {
      const historyKey = `learning_history:${this.productId}`;
      const historyData = await keydb.getClient().get(historyKey);
      
      if (historyData) {
        const parsed = JSON.parse(historyData);
        this.learningHistory = new Map(Object.entries(parsed));
      }
    } catch (error) {
      logger.debug(`No existing learning history for ${this.productId}`);
    }
  }

  private async persistLearningHistory(): Promise<void> {
    try {
      const historyKey = `learning_history:${this.productId}`;
      const historyData = Object.fromEntries(this.learningHistory);
      
      await keydb.getClient().setex(historyKey, 2592000, JSON.stringify(historyData)); // 30 days
    } catch (error) {
      logger.error(`Failed to persist learning history for ${this.productId}:`, error);
    }
  }

  private parseForecastResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : this.generateFallbackForecast(30);
    } catch {
      return this.generateFallbackForecast(30);
    }
  }

  private applyLearningAdjustments(forecast: any): any {
    // Apply learning-based adjustments to the forecast
    return forecast; // For now, return as-is - can add sophisticated adjustments
  }

  private generateFallbackForecast(days: number): any {
    return {
      demandForecast: Array(days).fill(50),
      priceOptimization: Array(days).fill(0),
      inventoryRecommendations: [],
      riskFactors: ['AI forecasting unavailable'],
      confidenceLevel: 0.3
    };
  }

  private async getHistoricalMarketData(days: number): Promise<any> {
    // Placeholder for historical data retrieval
    return {
      sales: Array(days).fill(0).map(() => Math.random() * 100),
      prices: Array(days).fill(0).map(() => 10 + Math.random() * 5),
      inventory: Array(days).fill(0).map(() => Math.random() * 200)
    };
  }
}
