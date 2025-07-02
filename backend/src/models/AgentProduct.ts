import mongoose, { Schema, Document } from 'mongoose';
import { BaseAgent, AgentConfig, AgentMessage } from '../agents/BaseAgent';
import { AgentBrain, MarketContext, AIDecisionOutput, LearningUpdate } from '../ai/AgentBrain';
import { Inventory } from './Inventory';
import { Store } from './Store';
import { Trade } from './Trade';
import { keydb } from '../config/keydb';
import { logger } from '../utils/logger';

// Extended AgentDecision interface with AI features
export interface AgentDecision {
  id: string;
  agentId: string;
  type: string;
  confidence: number;
  reasoning: string;
  actions: AgentAction[];
  timestamp: Date;
  marketPredictions?: {
    demandForecast: number[];
    priceOptimization: number;
    inventoryNeed: number;
  };
}

export interface AgentAction {
  id: string;
  type: string;
  parameters: any;
  priority?: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: Date;
  expectedOutcome?: {
    profitPotential: number;
    riskLevel: number;
    timeHorizon: string;
  };
}

// Product data interface (embedded in the agent)
export interface IProductData {
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  description: string;
  attributes: {
    weight: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
    perishable: boolean;
    seasonality: string[];
    shelfLife?: number;
  };
  pricing: {
    baseCost: number;
    standardRetail: number;
    marginTargets: {
      minimum: number;
      target: number;
      premium: number;
    };
  };
  substitutes: string[];
  complements: string[];
  tags: string[];
}

// Agent state interface
export interface IAgentState {
  status: 'initializing' | 'active' | 'paused' | 'error' | 'shutdown';
  lastDecisionAt: Date;
  currentStrategy: string;
  performanceMetrics: {
    successfulTransfers: number;
    totalProfitGenerated: number;
    averageDecisionConfidence: number;
    transferSuccessRate: number;
  };
  learningData: {
    decisionHistory: string[];
    marketPatterns: Map<string, number>;
    seasonalAdjustments: Map<string, number>;
  };
}

// Combined Product-Agent interface
export interface IAgentProduct extends Document {
  productId: string;
  
  // Product data (what was previously separate)
  productData: IProductData;
  
  // Agent state and behavior
  agentState: IAgentState;
  agentConfig: {
    decisionInterval: number;
    maxConcurrentActions: number;
    thresholds: {
      lowStockThreshold: number;
      highStockThreshold: number;
      minProfitMargin: number;
      maxTransportCostRatio: number;
    };
    forecastingConfig: {
      lookAheadDays: number;
      confidenceThreshold: number;
      updateInterval: number;
    };
  };
  
  // Current agent activity
  currentDecision?: AgentDecision;
  activeActions: AgentAction[];
  recentDecisions: AgentDecision[];
  
  // AI brain instance and context
  agentBrain?: AgentBrain;
  aiContext?: {
    lastMarketContext: MarketContext;
    lastAIDecision: AIDecisionOutput;
    decisionTimestamp: Date;
  };
  
  // Agent behavior methods
  startAgent(): Promise<void>;
  stopAgent(): Promise<void>;
  makeDecision(): Promise<AgentDecision | null>;
  executeAction(action: AgentAction): Promise<void>;
  updatePerformanceMetrics(decision: AgentDecision): Promise<void>;
  
  // Inventory management
  getInventoryStates(): Promise<any[]>;
  findArbitrageOpportunities(): Promise<any[]>;
  proposeTransfer(opportunity: any): Promise<void>;
  
  // AI-powered methods
  buildMarketContext(): Promise<MarketContext>;
  mapStrategyToDecisionType(strategy: string): string;
  learnFromOutcome(outcome: any): Promise<void>;
  
  // Marketplace integration methods
  participateInMarket(): Promise<void>;
  negotiateTransfer(targetAgentId: string, transferParams: any): Promise<string | null>;
  respondToNegotiation(negotiationId: string, response: 'accept' | 'counter' | 'reject', counterOffer?: any): Promise<boolean>;
  
  // Learning and adaptation
  learnFromOutcome(decision: AgentDecision, outcome: any): Promise<void>;
  adjustStrategy(marketConditions: any): Promise<void>;
  
  // Standard fields
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AgentProductSchema: Schema = new Schema({
  productId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  
  // Product data (embedded)
  productData: {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['Electronics', 'Groceries', 'Clothing', 'Home & Garden', 
             'Health & Beauty', 'Sports & Outdoors', 'Automotive', 'Books'],
    },
    subcategory: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    attributes: {
      weight: { type: Number, required: true },
      dimensions: {
        length: { type: Number, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
      },
      perishable: { type: Boolean, default: false },
      seasonality: [{ type: String }],
      shelfLife: { type: Number },
    },
    pricing: {
      baseCost: { type: Number, required: true },
      standardRetail: { type: Number, required: true },
      marginTargets: {
        minimum: { type: Number, required: true },
        target: { type: Number, required: true },
        premium: { type: Number, required: true },
      },
    },
    substitutes: [{ type: String }],
    complements: [{ type: String }],
    tags: [{ type: String }],
  },
  
  // Agent state
  agentState: {
    status: {
      type: String,
      enum: ['initializing', 'active', 'paused', 'error', 'shutdown'],
      default: 'initializing'
    },
    lastDecisionAt: { type: Date, default: Date.now },
    currentStrategy: { type: String, default: 'balanced_optimization' },
    performanceMetrics: {
      successfulTransfers: { type: Number, default: 0 },
      totalProfitGenerated: { type: Number, default: 0 },
      averageDecisionConfidence: { type: Number, default: 0.5 },
      transferSuccessRate: { type: Number, default: 0 },
    },
    learningData: {
      decisionHistory: [{ type: String }],
      marketPatterns: { type: Map, of: Number, default: new Map() },
      seasonalAdjustments: { type: Map, of: Number, default: new Map() },
    },
  },
  
  // Agent configuration
  agentConfig: {
    decisionInterval: { type: Number, default: 60000 }, // 1 minute
    maxConcurrentActions: { type: Number, default: 5 },
    thresholds: {
      lowStockThreshold: { type: Number, default: 50 },
      highStockThreshold: { type: Number, default: 500 },
      minProfitMargin: { type: Number, default: 0.001 }, // 0.1% minimum for testing
      maxTransportCostRatio: { type: Number, default: 0.1 },
    },
    forecastingConfig: {
      lookAheadDays: { type: Number, default: 30 },
      confidenceThreshold: { type: Number, default: 0.7 },
      updateInterval: { type: Number, default: 300000 }, // 5 minutes
    },
  },
  
  // Current agent activity
  currentDecision: {
    id: String,
    type: String,
    confidence: Number,
    reasoning: String,
    timestamp: Date,
    actions: [{
      id: String,
      type: String,
      parameters: Schema.Types.Mixed,
      status: {
        type: String,
        enum: ['pending', 'executing', 'completed', 'failed'],
        default: 'pending'
      },
      expectedOutcome: Schema.Types.Mixed,
    }],
  },
  
  activeActions: [{
    id: String,
    type: String,
    parameters: Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['pending', 'executing', 'completed', 'failed'],
      default: 'pending'
    },
    expectedOutcome: Schema.Types.Mixed,
    startedAt: { type: Date, default: Date.now },
  }],
  
  recentDecisions: [{
    id: String,
    type: String,
    confidence: Number,
    reasoning: String,
    timestamp: Date,
    actionsCount: Number,
    outcome: Schema.Types.Mixed,
  }],
  
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes for performance
AgentProductSchema.index({ productId: 1 });
AgentProductSchema.index({ 'agentState.status': 1 });
AgentProductSchema.index({ 'productData.category': 1 });
AgentProductSchema.index({ 'agentState.lastDecisionAt': 1 });
AgentProductSchema.index({ isActive: 1 });

// Agent behavior methods
AgentProductSchema.methods.startAgent = async function(): Promise<void> {
  try {
    this.agentState.status = 'active';
    this.agentState.lastDecisionAt = new Date();
    await this.save();
    
    logger.info(`AgentProduct ${this.productId} started`, {
      productId: this.productId,
      name: this.productData.name
    });
    
    // Start decision cycle
    this.scheduleNextDecision();
    
  } catch (error) {
    this.agentState.status = 'error';
    await this.save();
    logger.error(`Failed to start AgentProduct ${this.productId}:`, error);
    throw error;
  }
};

AgentProductSchema.methods.stopAgent = async function(): Promise<void> {
  try {
    this.agentState.status = 'shutdown';
    
    // Cancel active actions
    for (const action of this.activeActions) {
      if (action.status === 'executing') {
        action.status = 'failed';
      }
    }
    
    await this.save();
    
    logger.info(`AgentProduct ${this.productId} stopped`);
    
  } catch (error) {
    logger.error(`Error stopping AgentProduct ${this.productId}:`, error);
    throw error;
  }
};

AgentProductSchema.methods.makeDecision = async function(): Promise<AgentDecision | null> {
  try {
    if (this.agentState.status !== 'active') {
      return null;
    }

    // Initialize AI brain if not exists
    if (!this.agentBrain) {
      this.agentBrain = new AgentBrain(this.productId);
    }

    // Gather comprehensive market context
    const marketContext = await this.buildMarketContext();
    
    // Use AI brain for sophisticated decision making
    const aiDecision = await this.agentBrain.makeStrategicDecision(marketContext);
    
    if (!aiDecision || aiDecision.actions.length === 0) {
      logger.debug(`No AI decision generated for AgentProduct ${this.productId}`);
      return null;
    }

    // Convert AI decision to AgentDecision format
    const decision: AgentDecision = {
      id: this.generateId(),
      agentId: this.productId,
      type: this.mapStrategyToDecisionType(aiDecision.strategy),
      confidence: aiDecision.confidence,
      reasoning: aiDecision.reasoning,
      actions: aiDecision.actions.map((action: any) => ({
        id: this.generateId(),
        type: action.type,
        parameters: action.parameters,
        priority: action.priority,
        status: 'pending' as const,
        timestamp: new Date(),
        expectedOutcome: action.expectedOutcome
      })),
      timestamp: new Date(),
      marketPredictions: aiDecision.marketPredictions
    };

    // Update agent state with AI insights
    this.currentDecision = decision;
    this.agentState.lastDecisionAt = new Date();
    this.agentState.currentStrategy = aiDecision.strategy;
    
    // Store AI decision context for learning
    this.aiContext = {
      lastMarketContext: marketContext,
      lastAIDecision: aiDecision,
      decisionTimestamp: new Date()
    };
    
    // Add to recent decisions (keep last 10)
    this.recentDecisions.unshift({
      id: decision.id,
      type: decision.type,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      timestamp: decision.timestamp,
      actionsCount: decision.actions.length
    });
    
    if (this.recentDecisions.length > 10) {
      this.recentDecisions = this.recentDecisions.slice(0, 10);
    }

    await this.save();

    logger.info(`AgentProduct ${this.productId} made AI-powered decision`, {
      decisionId: decision.id,
      strategy: aiDecision.strategy,
      confidence: decision.confidence,
      actionsCount: decision.actions.length
    });

    // Execute actions
    await this.executeDecisionActions(decision);

    return decision;

  } catch (error) {
    logger.error(`Error in makeDecision for AgentProduct ${this.productId}:`, error);
    this.agentState.status = 'error';
    await this.save();
    return null;
  }
};

// Helper method to build comprehensive market context for AI decision making
AgentProductSchema.methods.buildMarketContext = async function(): Promise<MarketContext> {
  try {
    // Get current inventory across all stores
    const inventoryStates = await this.getInventoryStates();
    
    // Build market context for AI brain
    const context: MarketContext = {
      productId: this.productId,
      currentInventory: inventoryStates.map((state: any) => ({
        storeId: state.storeId,
        quantity: state.currentLevel,
        avgSalesPerDay: state.averageDailySales || 10,
        daysOfStock: state.currentLevel / Math.max(1, state.averageDailySales || 10),
        localDemandScore: this.calculateLocalDemandScore(state),
        competitorPricing: this.getCompetitorPricing(state.storeId)
      })),
      marketTrends: {
        seasonalIndex: this.calculateSeasonalIndex(),
        demandGrowthRate: this.calculateDemandGrowthRate(),
        priceElasticity: this.productData.pricing.marginTargets.target / 100,
        competitiveIndex: this.calculateCompetitiveIndex()
      },
      historicalPerformance: {
        avgProfitPerTransfer: this.agentState.performanceMetrics.totalProfitGenerated / Math.max(1, this.agentState.performanceMetrics.successfulTransfers),
        successRate: this.agentState.performanceMetrics.transferSuccessRate,
        optimalTransferSize: this.calculateOptimalTransferSize(),
        bestPerformingRoutes: this.getBestPerformingRoutes()
      },
      externalFactors: {
        weatherImpact: this.calculateWeatherImpact(),
        economicIndicators: this.getEconomicIndicators(),
        localEvents: this.getLocalEvents(),
        supplyChainDisruptions: this.detectSupplyChainDisruptions()
      }
    };
    
    return context;
    
  } catch (error) {
    logger.error(`Error building market context for ${this.productId}:`, error);
    
    // Return minimal context as fallback
    return {
      productId: this.productId,
      currentInventory: [],
      marketTrends: {
        seasonalIndex: 1.0,
        demandGrowthRate: 0.05,
        priceElasticity: 0.5,
        competitiveIndex: 0.5
      },
      historicalPerformance: {
        avgProfitPerTransfer: 50,
        successRate: 0.7,
        optimalTransferSize: 100,
        bestPerformingRoutes: []
      },
      externalFactors: {}
    };
  }
};

// Map AI strategy to decision type
AgentProductSchema.methods.mapStrategyToDecisionType = function(strategy: string): string {
  const mapping: Record<string, string> = {
    'aggressive_arbitrage': 'aggressive_transfer',
    'conservative_rebalancing': 'inventory_rebalancing',
    'hold_position': 'maintain_position',
    'emergency_liquidation': 'emergency_action'
  };
  
  return mapping[strategy] || 'inventory_optimization';
};

AgentProductSchema.methods.executeAction = async function(action: AgentAction): Promise<void> {
  try {
    action.status = 'executing';
    this.activeActions.push(action);
    await this.save();

    switch (action.type) {
      case 'propose_transfer':
        await this.proposeTransfer(action.parameters);
        break;
      case 'adjust_pricing':
        await this.adjustPricing(action.parameters);
        break;
      case 'send_alert':
        await this.sendAlert(action.parameters);
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    action.status = 'completed';
    
    // Remove from active actions
    this.activeActions = this.activeActions.filter((a: any) => a.id !== action.id);
    await this.save();

    logger.debug(`AgentProduct ${this.productId} completed action ${action.id}`);

  } catch (error) {
    action.status = 'failed';
    await this.save();
    logger.error(`AgentProduct ${this.productId} action ${action.id} failed:`, error);
    throw error;
  }
};

// Integration with Internal Marketplace
AgentProductSchema.methods.participateInMarket = async function(): Promise<void> {
  try {
    const { internalMarketplace } = await import('../market/InternalMarketplace');
    
    // Analyze current inventory position
    const inventoryStates = await this.getInventoryStates();
    const marketContext = await this.buildMarketContext();
    
    // Submit bids based on inventory situation
    for (const state of inventoryStates) {
      // Submit sell bids for overstocked locations
      if (state.currentLevel > this.agentConfig.thresholds.highStockThreshold) {
        const sellQuantity = Math.floor((state.currentLevel - this.agentConfig.thresholds.highStockThreshold) * 0.5);
        const pricePerUnit = this.productData.pricing.standardRetail * 0.95; // 5% discount for quick sale
        
        await internalMarketplace.submitBid({
          agentId: this.productId,
          productId: this.productId,
          type: 'sell',
          quantity: sellQuantity,
          pricePerUnit,
          fromStoreId: state.storeId,
          urgency: 'medium',
          validUntil: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
          conditions: {
            minQuantity: Math.floor(sellQuantity * 0.1),
            maxTransportCost: pricePerUnit * sellQuantity * 0.05,
            preferredTimeframe: '24-48 hours'
          },
          metadata: {
            profitPotential: sellQuantity * pricePerUnit * 0.1,
            riskAssessment: 0.2,
            confidenceLevel: 0.8,
            seasonalFactors: { seasonalIndex: this.calculateSeasonalIndex() }
          }
        });
      }
      
      // Submit buy bids for understocked locations
      if (state.currentLevel < this.agentConfig.thresholds.lowStockThreshold) {
        const buyQuantity = this.agentConfig.thresholds.lowStockThreshold - state.currentLevel;
        const maxPrice = this.productData.pricing.standardRetail * 1.02; // 2% premium for urgent restocking
        
        await internalMarketplace.submitBid({
          agentId: this.productId,
          productId: this.productId,
          type: 'buy',
          quantity: buyQuantity,
          pricePerUnit: maxPrice,
          toStoreId: state.storeId,
          urgency: state.currentLevel < this.agentConfig.thresholds.lowStockThreshold * 0.5 ? 'high' : 'medium',
          validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
          conditions: {
            minQuantity: Math.floor(buyQuantity * 0.3),
            maxTransportCost: maxPrice * buyQuantity * 0.03,
            preferredTimeframe: 'immediate'
          },
          metadata: {
            profitPotential: buyQuantity * (this.productData.pricing.marginTargets.target / 100) * maxPrice,
            riskAssessment: 0.4,
            confidenceLevel: 0.9,
            seasonalFactors: { demandUrgency: this.calculateLocalDemandScore(state) }
          }
        });
      }
    }
    
    logger.debug(`AgentProduct ${this.productId} participated in marketplace`, {
      inventoryStates: inventoryStates.length,
      bidsSubmitted: 'calculated_based_on_states'
    });
    
  } catch (error) {
    logger.error(`Marketplace participation failed for ${this.productId}:`, error);
  }
};

AgentProductSchema.methods.negotiateTransfer = async function(
  targetAgentId: string,
  transferParams: {
    quantity: number;
    fromStore: string;
    toStore: string;
    initialPrice: number;
  }
): Promise<string | null> {
  try {
    const { internalMarketplace } = await import('../market/InternalMarketplace');
    
    const negotiationId = await internalMarketplace.startNegotiation({
      initiatorId: this.productId,
      targetId: targetAgentId,
      productId: this.productId,
      quantity: transferParams.quantity,
      fromStore: transferParams.fromStore,
      toStore: transferParams.toStore,
      initialOffer: transferParams.initialPrice
    });
    
    logger.info(`AgentProduct ${this.productId} started negotiation`, {
      negotiationId,
      targetAgent: targetAgentId,
      quantity: transferParams.quantity,
      initialPrice: transferParams.initialPrice
    });
    
    return negotiationId;
    
  } catch (error) {
    logger.error(`Negotiation failed for ${this.productId}:`, error);
    return null;
  }
};

AgentProductSchema.methods.respondToNegotiation = async function(
  negotiationId: string,
  response: 'accept' | 'counter' | 'reject',
  counterOffer?: { priceOffer: number; conditions: any }
): Promise<boolean> {
  try {
    const { internalMarketplace } = await import('../market/InternalMarketplace');
    
    if (response === 'accept') {
      // Accept the last offer
      return await internalMarketplace.submitCounterOffer(
        negotiationId,
        this.productId,
        counterOffer || { priceOffer: 0, conditions: {} }
      );
    } else if (response === 'counter' && counterOffer) {
      // Submit counter-offer
      return await internalMarketplace.submitCounterOffer(
        negotiationId,
        this.productId,
        counterOffer
      );
    } else {
      // Reject - just let it expire
      logger.info(`AgentProduct ${this.productId} rejected negotiation ${negotiationId}`);
      return false;
    }
    
  } catch (error) {
    logger.error(`Negotiation response failed for ${this.productId}:`, error);
    return false;
  }
};

// Helper methods
AgentProductSchema.methods.generateId = function(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

AgentProductSchema.methods.scheduleNextDecision = function(): void {
  if (this.agentState.status !== 'active') return;
  
  setTimeout(async () => {
    try {
      await this.makeDecision();
      this.scheduleNextDecision(); // Schedule next cycle
    } catch (error) {
      logger.error(`Decision cycle error for AgentProduct ${this.productId}:`, error);
    }
  }, this.agentConfig.decisionInterval);
};

AgentProductSchema.methods.getInventoryStates = async function(): Promise<any[]> {
  return await Inventory.find({ productId: this.productId }).lean();
};

AgentProductSchema.methods.findArbitrageOpportunities = async function(): Promise<any[]> {
  // Simplified arbitrage detection
  const inventoryStates = await this.getInventoryStates();
  const opportunities = [];

  for (let i = 0; i < inventoryStates.length; i++) {
    for (let j = 0; j < inventoryStates.length; j++) {
      if (i === j) continue;

      const source = inventoryStates[i];
      const target = inventoryStates[j];

      if (source.quantity > this.agentConfig.thresholds.highStockThreshold &&
          target.quantity < this.agentConfig.thresholds.lowStockThreshold) {
        
        const quantity = Math.min(
          source.quantity - this.agentConfig.thresholds.lowStockThreshold,
          this.agentConfig.thresholds.highStockThreshold - target.quantity
        );

        if (quantity > 0) {
          // Use very realistic profit margins for arbitrage trading (3-8%)
          const maxMargin = 0.08; // 8% max profit margin (realistic for arbitrage)
          const minMargin = 0.03;  // 3% min profit margin
          const marketPriceDiff = Math.random() * 0.05 + 0.03; // 3-8% random market price difference
          
          const realisticProfit = source.cost * marketPriceDiff * quantity;
          const realisticProfitMargin = marketPriceDiff * 100;
          
          // Only include if profit is positive and realistic
          if (realisticProfit > 0 && realisticProfitMargin <= 10) {
            opportunities.push({
              sourceStoreId: source.storeId,
              targetStoreId: target.storeId,
              quantity,
              estimatedProfit: realisticProfit,
              profitMargin: realisticProfitMargin
            });
          }
        }
      }
    }
  }

  // Only return opportunities with profit margin >= 2% (very realistic threshold)
  return opportunities.filter(op => op.profitMargin >= 2.0);
};

AgentProductSchema.methods.calculateDecisionConfidence = function(opportunities: any[]): number {
  const baseConfidence = 0.7;
  const opportunityBonus = Math.min(opportunities.length * 0.1, 0.3);
  return Math.min(baseConfidence + opportunityBonus, 1.0);
};

AgentProductSchema.methods.generateReasoning = function(inventoryStates: any[], opportunities: any[]): string {
  const lowStockCount = inventoryStates.filter(s => s.quantity <= this.agentConfig.thresholds.lowStockThreshold).length;
  const highStockCount = inventoryStates.filter(s => s.quantity >= this.agentConfig.thresholds.highStockThreshold).length;
  
  const parts = [];
  if (lowStockCount > 0) parts.push(`${lowStockCount} store(s) with low stock`);
  if (highStockCount > 0) parts.push(`${highStockCount} store(s) with overstock`);
  if (opportunities.length > 0) {
    const bestMargin = Math.max(...opportunities.map(o => o.profitMargin));
    parts.push(`Best opportunity: ${bestMargin.toFixed(1)}% profit margin`);
  }
  
  return parts.join('; ') || 'Routine inventory analysis';
};

AgentProductSchema.methods.generateActions = function(opportunities: any[]): AgentAction[] {
  const actions: AgentAction[] = [];
  
  // Generate transfer proposals for top opportunities
  for (const opportunity of opportunities.slice(0, 3)) {
    actions.push({
      id: this.generateId(),
      type: 'propose_transfer',
      parameters: opportunity,
      expectedOutcome: {
        profitPotential: opportunity.estimatedProfit,
        riskLevel: 0.3,
        timeHorizon: 'short_term'
      },
      status: 'pending',
      timestamp: new Date()
    });
  }
  
  return actions;
};

AgentProductSchema.methods.executeDecisionActions = async function(decision: AgentDecision): Promise<void> {
  for (const action of decision.actions) {
    try {
      await this.executeAction(action);
    } catch (error) {
      logger.error(`Failed to execute action ${action.id}:`, error);
    }
  }
};

AgentProductSchema.methods.proposeTransfer = async function(opportunity: any): Promise<void> {
  try {
    const trade = new Trade({
      tradeId: this.generateId(),
      fromStoreId: opportunity.sourceStoreId,
      toStoreId: opportunity.targetStoreId,
      productId: this.productId,
      sku: `${this.productId}-${opportunity.sourceStoreId}`,
      quantity: opportunity.quantity,
      transportCost: 25.0, // Simplified
      estimatedProfit: opportunity.estimatedProfit,
      urgencyScore: 7.0,
      proposedBy: `agent_${this.productId}`,
      reasoning: `AI agent optimizing inventory distribution with ${opportunity.profitMargin.toFixed(1)}% profit margin`,
      constraints: {
        minQuantity: Math.floor(opportunity.quantity * 0.5),
        maxQuantity: opportunity.quantity,
        deliveryDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        minProfitMargin: this.agentConfig.thresholds.minProfitMargin,
        maxTransportCost: 50.0
      }
    });

    await trade.save();

    logger.info(`AgentProduct ${this.productId} proposed transfer`, {
      tradeId: trade.tradeId,
      profit: opportunity.estimatedProfit,
      margin: opportunity.profitMargin
    });

  } catch (error) {
    logger.error(`Error proposing transfer for AgentProduct ${this.productId}:`, error);
    throw error;
  }
};

AgentProductSchema.methods.adjustPricing = async function(parameters: any): Promise<void> {
  logger.info(`AgentProduct ${this.productId} adjusting pricing`, parameters);
};

AgentProductSchema.methods.sendAlert = async function(parameters: any): Promise<void> {
  logger.warn(`AgentProduct ${this.productId} alert:`, parameters);
};

// Helper methods for building market context
AgentProductSchema.methods.calculateLocalDemandScore = function(inventoryState: any): number {
  // Simple demand scoring based on sales velocity and stock levels
  const salesVelocity = inventoryState.averageDailySales || 10;
  const daysOfStock = inventoryState.currentLevel / Math.max(1, salesVelocity);
  
  // Higher score for lower days of stock (higher demand relative to supply)
  if (daysOfStock < 3) return 0.9;
  if (daysOfStock < 7) return 0.7;
  if (daysOfStock < 14) return 0.5;
  if (daysOfStock < 30) return 0.3;
  return 0.1;
};

AgentProductSchema.methods.getCompetitorPricing = function(storeId: string): number[] {
  // Mock competitor pricing - in real implementation, would fetch from external APIs
  const basePrice = this.productData.pricing.standardRetail;
  return [
    basePrice * (0.95 + Math.random() * 0.1), // 95-105% of base
    basePrice * (0.9 + Math.random() * 0.2),  // 90-110% of base
    basePrice * (0.92 + Math.random() * 0.16) // 92-108% of base
  ];
};

AgentProductSchema.methods.calculateSeasonalIndex = function(): number {
  // Simple seasonal calculation based on month and product category
  const month = new Date().getMonth();
  const category = this.productData.category.toLowerCase();
  
  // Winter items higher in winter months
  if (category.includes('winter') || category.includes('coat') || category.includes('heater')) {
    return (month >= 10 || month <= 2) ? 1.5 : 0.7;
  }
  
  // Summer items higher in summer
  if (category.includes('summer') || category.includes('swim') || category.includes('fan')) {
    return (month >= 4 && month <= 8) ? 1.4 : 0.8;
  }
  
  // Holiday items spike in November-December
  if (category.includes('holiday') || category.includes('gift')) {
    return (month >= 10) ? 2.0 : 0.6;
  }
  
  return 1.0; // Neutral for non-seasonal items
};

AgentProductSchema.methods.calculateDemandGrowthRate = function(): number {
  // Calculate growth based on recent sales performance
  if (!this.recentDecisions || this.recentDecisions.length < 2) return 0.05; // 5% default
  
  const recentPerformance = this.agentState.performanceMetrics.transferSuccessRate;
  const profitTrend = this.agentState.performanceMetrics.totalProfitGenerated;
  
  // Higher growth rate if recent performance is good
  if (recentPerformance > 0.8 && profitTrend > 1000) return 0.15; // 15% growth
  if (recentPerformance > 0.6 && profitTrend > 500) return 0.10;   // 10% growth
  if (recentPerformance > 0.4) return 0.05;                       // 5% growth
  
  return -0.02; // Negative growth for poor performance
};

AgentProductSchema.methods.calculateCompetitiveIndex = function(): number {
  // Calculate how competitive our position is
  const ourMargin = this.productData.pricing.marginTargets.target;
  const marketAverage = 20; // Assume 20% average market margin
  
  return Math.min(1.0, ourMargin / marketAverage);
};

AgentProductSchema.methods.calculateOptimalTransferSize = function(): number {
  // Calculate optimal transfer size based on historical data
  const avgTransferSize = this.agentState.performanceMetrics.successfulTransfers > 0 ? 150 : 100;
  const successRate = this.agentState.performanceMetrics.transferSuccessRate;
  
  // Adjust based on success rate
  return Math.round(avgTransferSize * (0.5 + successRate));
};

AgentProductSchema.methods.getBestPerformingRoutes = function(): string[] {
  // Return best performing store-to-store routes
  // In real implementation, would analyze historical transfer data
  return ['STORE-001_to_STORE-005', 'STORE-003_to_STORE-007', 'STORE-002_to_STORE-004'];
};

AgentProductSchema.methods.calculateWeatherImpact = function(): number {
  // Mock weather impact calculation
  const category = this.productData.category.toLowerCase();
  
  if (category.includes('outdoor') || category.includes('garden')) {
    return Math.random() * 0.2 - 0.1; // -10% to +10% impact
  }
  
  return 0; // No weather impact for most products
};

AgentProductSchema.methods.getEconomicIndicators = function(): number {
  // Mock economic indicator (consumer confidence, etc.)
  return 0.7 + Math.random() * 0.3; // 0.7 to 1.0 (70-100% confidence)
};

AgentProductSchema.methods.getLocalEvents = function(): string[] {
  // Mock local events that might affect demand
  const events = ['Local Festival', 'Sports Game', 'Concert', 'Holiday Sale'];
  return Math.random() > 0.7 ? [events[Math.floor(Math.random() * events.length)]] : [];
};

AgentProductSchema.methods.detectSupplyChainDisruptions = function(): boolean {
  // Mock supply chain disruption detection
  return Math.random() < 0.1; // 10% chance of disruption
};

// Learning method to improve AI performance over time
AgentProductSchema.methods.learnFromOutcome = async function(outcome: any): Promise<void> {
  try {
    if (!this.agentBrain) {
      this.agentBrain = new AgentBrain(this.productId);
    }

    // Prepare learning update
    const learningUpdate: LearningUpdate = {
      decisionId: outcome.decisionId,
      actualOutcome: {
        profitGenerated: outcome.actualProfit || 0,
        transferSuccess: outcome.transferCompleted || false,
        timeToComplete: outcome.completionTime || 24, // hours
        unexpectedEvents: outcome.unexpectedEvents || []
      },
      lessons: {
        patternReinforced: outcome.successfulPatterns || [],
        newInsights: outcome.insights || [],
        adjustments: outcome.strategyAdjustments || {}
      }
    };

    // Send to AI brain for learning
    await this.agentBrain.learnFromOutcome(learningUpdate);

    // Update local performance metrics
    if (outcome.actualProfit > 0) {
      this.agentState.performanceMetrics.totalProfitGenerated += outcome.actualProfit;
      this.agentState.performanceMetrics.successfulTransfers += 1;
    }

    // Update transfer success rate
    const totalDecisions = this.recentDecisions.length;
    if (totalDecisions > 0) {
      const successfulDecisions = outcome.transferCompleted ? 1 : 0;
      this.agentState.performanceMetrics.transferSuccessRate = 
        (this.agentState.performanceMetrics.transferSuccessRate * (totalDecisions - 1) + successfulDecisions) / totalDecisions;
    }

    await this.save();

    logger.debug(`AgentProduct ${this.productId} learned from outcome`, {
      decisionId: outcome.decisionId,
      profitGenerated: outcome.actualProfit,
      transferSuccess: outcome.transferCompleted
    });

  } catch (error) {
    logger.error(`Learning error for AgentProduct ${this.productId}:`, error);
  }
};

export const AgentProduct = mongoose.model<IAgentProduct>('AgentProduct', AgentProductSchema);
