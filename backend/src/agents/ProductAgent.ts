import { BaseAgent, AgentConfig, AgentDecision, AgentMessage, AgentAction } from './BaseAgent';
import { Inventory } from '../models/Inventory';
import { Product } from '../models/Product';
import { Store } from '../models/Store';
import { Trade } from '../models/Trade';
import { keydb } from '../config/keydb';
import { logger } from '../utils/logger';

export interface ProductAgentConfig extends AgentConfig {
  productId: string;
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
}

export interface InventoryState {
  storeId: string;
  quantity: number;
  reservedQuantity: number;
  cost: number;
  retailPrice: number;
  lastUpdated: Date;
  demandForecast: Array<{
    period: string;
    predictedDemand: number;
    confidence: number;
  }>;
}

export interface ArbitrageOpportunity {
  sourceStoreId: string;
  targetStoreId: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  transportCost: number;
  estimatedProfit: number;
  profitMargin: number;
  confidence: number;
  urgency: number;
}

export class ProductAgent extends BaseAgent {
  private productConfig: ProductAgentConfig;
  private productData: any;
  private inventoryStates: Map<string, InventoryState> = new Map();
  private lastAnalysis: Date = new Date(0);

  constructor(config: ProductAgentConfig) {
    super(config);
    this.productConfig = config;
  }

  async initialize(): Promise<void> {
    try {
      // Load product data
      this.productData = await Product.findOne({ productId: this.productConfig.productId });
      if (!this.productData) {
        throw new Error(`Product ${this.productConfig.productId} not found`);
      }

      // Load initial inventory states
      await this.updateInventoryStates();

      // Subscribe to real-time inventory updates
      await this.subscribeToInventoryUpdates();

      logger.info(`ProductAgent initialized for ${this.productConfig.productId}`, {
        productId: this.productConfig.productId,
        inventoryLocations: this.inventoryStates.size
      });

    } catch (error) {
      logger.error(`Failed to initialize ProductAgent for ${this.productConfig.productId}:`, error);
      throw error;
    }
  }

  async makeDecision(): Promise<AgentDecision | null> {
    try {
      const now = new Date();
      const timeSinceLastAnalysis = now.getTime() - this.lastAnalysis.getTime();
      
      // Only analyze if enough time has passed or if there are critical conditions
      if (timeSinceLastAnalysis < this.productConfig.forecastingConfig.updateInterval && !this.hasCriticalConditions()) {
        return null;
      }

      this.lastAnalysis = now;

      // Analyze current inventory distribution
      const analysis = await this.analyzeInventoryDistribution();
      
      // Find arbitrage opportunities
      const opportunities = await this.findArbitrageOpportunities();
      
      // Generate actions based on analysis
      const actions = await this.generateActions(analysis, opportunities);

      if (actions.length === 0) {
        return null;
      }

      const decision: AgentDecision = {
        id: this.generateId(),
        agentId: this.config.id,
        type: 'inventory_optimization',
        confidence: this.calculateDecisionConfidence(analysis, opportunities),
        reasoning: this.generateReasoning(analysis, opportunities),
        actions,
        timestamp: now
      };

      return decision;

    } catch (error) {
      logger.error(`Error in makeDecision for ProductAgent ${this.config.id}:`, error);
      return null;
    }
  }

  async processMessage(message: AgentMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'inventory_update':
          await this.handleInventoryUpdate(message.payload);
          break;
        case 'demand_spike':
          await this.handleDemandSpike(message.payload);
          break;
        case 'trade_proposal':
          await this.handleTradeProposal(message.payload);
          break;
        case 'market_condition_change':
          await this.handleMarketConditionChange(message.payload);
          break;
        default:
          logger.warn(`Unknown message type ${message.type} for ProductAgent ${this.config.id}`);
      }
    } catch (error) {
      logger.error(`Error processing message ${message.id}:`, error);
    }
  }

  protected async executeAction(action: AgentAction): Promise<void> {
    switch (action.type) {
      case 'propose_transfer':
        await this.proposeTransfer(action.parameters);
        break;
      case 'adjust_pricing':
        await this.adjustPricing(action.parameters);
        break;
      case 'reorder_inventory':
        await this.reorderInventory(action.parameters);
        break;
      case 'send_alert':
        await this.sendAlert(action.parameters);
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async cleanup(): Promise<void> {
    // Unsubscribe from real-time updates
    const client = keydb.getClient();
    await client.unsubscribe(`inventory:${this.productConfig.productId}:*`);
  }

  // Private methods
  private async updateInventoryStates(): Promise<void> {
    const inventoryItems = await Inventory.find({ 
      productId: this.productConfig.productId 
    }).lean();

    this.inventoryStates.clear();
    
    for (const item of inventoryItems) {
      this.inventoryStates.set(item.storeId, {
        storeId: item.storeId,
        quantity: item.quantity,
        reservedQuantity: item.reservedQuantity,
        cost: item.cost,
        retailPrice: item.retailPrice,
        lastUpdated: item.lastUpdated,
        demandForecast: item.demandForecast || []
      });
    }
  }

  private async subscribeToInventoryUpdates(): Promise<void> {
    const subscriber = keydb.getSubscriber();
    const channel = `inventory:${this.productConfig.productId}:*`;
    
    await subscriber.psubscribe(channel);
    
    subscriber.on('pmessage', async (pattern, channel, message) => {
      try {
        const update = JSON.parse(message);
        await this.handleInventoryUpdate(update);
      } catch (error) {
        logger.error(`Error processing inventory update:`, error);
      }
    });
  }

  private hasCriticalConditions(): boolean {
    for (const state of this.inventoryStates.values()) {
      if (state.quantity <= this.productConfig.thresholds.lowStockThreshold) {
        return true;
      }
      if (state.quantity >= this.productConfig.thresholds.highStockThreshold) {
        return true;
      }
    }
    return false;
  }

  private async analyzeInventoryDistribution(): Promise<any> {
    const states = Array.from(this.inventoryStates.values());
    
    const totalQuantity = states.reduce((sum, state) => sum + state.quantity, 0);
    const averageQuantity = totalQuantity / states.length;
    
    const lowStockStores = states.filter(state => 
      state.quantity <= this.productConfig.thresholds.lowStockThreshold
    );
    
    const overstockStores = states.filter(state => 
      state.quantity >= this.productConfig.thresholds.highStockThreshold
    );

    return {
      totalQuantity,
      averageQuantity,
      lowStockStores,
      overstockStores,
      distributionVariance: this.calculateVariance(states.map(s => s.quantity))
    };
  }

  private async findArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const states = Array.from(this.inventoryStates.values());

    for (let i = 0; i < states.length; i++) {
      for (let j = 0; j < states.length; j++) {
        if (i === j) continue;

        const source = states[i];
        const target = states[j];

        // Check if source has excess and target has demand
        if (source.quantity > this.productConfig.thresholds.highStockThreshold &&
            target.quantity < this.productConfig.thresholds.lowStockThreshold) {
          
          const opportunity = await this.calculateArbitrageOpportunity(source, target);
          if (opportunity && opportunity.profitMargin >= this.productConfig.thresholds.minProfitMargin) {
            opportunities.push(opportunity);
          }
        }
      }
    }

    return opportunities.sort((a, b) => b.profitMargin - a.profitMargin);
  }

  private async calculateArbitrageOpportunity(
    source: InventoryState, 
    target: InventoryState
  ): Promise<ArbitrageOpportunity | null> {
    try {
      // Calculate transport cost (simplified - would use actual logistics API)
      const transportCost = await this.estimateTransportCost(source.storeId, target.storeId);
      
      const maxTransportCost = source.cost * this.productConfig.thresholds.maxTransportCostRatio;
      if (transportCost > maxTransportCost) {
        return null;
      }

      const quantity = Math.min(
        source.quantity - this.productConfig.thresholds.lowStockThreshold,
        this.productConfig.thresholds.highStockThreshold - target.quantity
      );

      if (quantity <= 0) {
        return null;
      }

      const totalCost = (source.cost * quantity) + transportCost;
      const revenue = target.retailPrice * quantity;
      const estimatedProfit = revenue - totalCost;
      const profitMargin = (estimatedProfit / totalCost) * 100;

      return {
        sourceStoreId: source.storeId,
        targetStoreId: target.storeId,
        quantity,
        buyPrice: source.cost,
        sellPrice: target.retailPrice,
        transportCost,
        estimatedProfit,
        profitMargin,
        confidence: this.calculateOpportunityConfidence(source, target),
        urgency: this.calculateUrgency(source, target)
      };

    } catch (error) {
      logger.error(`Error calculating arbitrage opportunity:`, error);
      return null;
    }
  }

  private async generateActions(analysis: any, opportunities: ArbitrageOpportunity[]): Promise<AgentAction[]> {
    const actions: AgentAction[] = [];

    // Generate transfer proposals for profitable opportunities
    for (const opportunity of opportunities.slice(0, 3)) { // Top 3 opportunities
      if (opportunity.profitMargin >= this.productConfig.thresholds.minProfitMargin) {
        actions.push({
          id: this.generateId(),
          type: 'propose_transfer',
          parameters: opportunity,
          expectedOutcome: {
            profit: opportunity.estimatedProfit,
            margin: opportunity.profitMargin
          },
          status: 'pending'
        });
      }
    }

    // Generate alerts for critical conditions
    if (analysis.lowStockStores.length > 0) {
      actions.push({
        id: this.generateId(),
        type: 'send_alert',
        parameters: {
          type: 'low_stock',
          stores: analysis.lowStockStores.map((s: InventoryState) => s.storeId),
          urgency: 'high'
        },
        expectedOutcome: { alertSent: true },
        status: 'pending'
      });
    }

    return actions;
  }

  private async proposeTransfer(opportunity: ArbitrageOpportunity): Promise<void> {
    try {
      const trade = new Trade({
        tradeId: this.generateId(),
        fromStoreId: opportunity.sourceStoreId,
        toStoreId: opportunity.targetStoreId,
        productId: this.productConfig.productId,
        sku: `${this.productConfig.productId}-${opportunity.sourceStoreId}`,
        quantity: opportunity.quantity,
        transportCost: opportunity.transportCost,
        estimatedProfit: opportunity.estimatedProfit,
        urgencyScore: opportunity.urgency,
        proposedBy: this.config.id,
        reasoning: `AI-identified arbitrage opportunity with ${opportunity.profitMargin.toFixed(1)}% profit margin`,
        constraints: {
          minQuantity: Math.floor(opportunity.quantity * 0.5),
          maxQuantity: opportunity.quantity,
          deliveryDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          minProfitMargin: this.productConfig.thresholds.minProfitMargin,
          maxTransportCost: opportunity.transportCost * 1.2
        }
      });

      await trade.save();

      // Notify other agents
      await this.sendMessage({
        type: 'trade_proposed',
        to: 'all',
        payload: {
          tradeId: trade.tradeId,
          productId: this.productConfig.productId,
          opportunity
        },
        priority: 'medium'
      });

      logger.info(`ProductAgent ${this.config.id} proposed transfer`, {
        tradeId: trade.tradeId,
        profit: opportunity.estimatedProfit,
        margin: opportunity.profitMargin
      });

    } catch (error) {
      logger.error(`Error proposing transfer:`, error);
      throw error;
    }
  }

  private async sendAlert(parameters: any): Promise<void> {
    // Send alert through message system
    await this.sendMessage({
      type: 'inventory_alert',
      to: 'operations_team',
      payload: parameters,
      priority: parameters.urgency === 'high' ? 'high' : 'medium'
    });

    logger.warn(`ProductAgent ${this.config.id} sent alert`, parameters);
  }

  // Utility methods
  private async estimateTransportCost(fromStoreId: string, toStoreId: string): Promise<number> {
    // Simplified transport cost calculation
    // In production, this would integrate with actual logistics APIs
    const baseTransportCost = 25.0;
    const distanceMultiplier = Math.random() * 2 + 0.5; // Simulate distance
    return baseTransportCost * distanceMultiplier;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  private calculateDecisionConfidence(analysis: any, opportunities: ArbitrageOpportunity[]): number {
    const baseConfidence = 0.7;
    const opportunityBonus = Math.min(opportunities.length * 0.1, 0.3);
    return Math.min(baseConfidence + opportunityBonus, 1.0);
  }

  private calculateOpportunityConfidence(source: InventoryState, target: InventoryState): number {
    // Base confidence on demand forecast quality and inventory age
    let confidence = 0.8;
    
    if (target.demandForecast.length > 0) {
      const avgConfidence = target.demandForecast.reduce((sum, f) => sum + f.confidence, 0) / target.demandForecast.length;
      confidence = (confidence + avgConfidence) / 2;
    }

    return confidence;
  }

  private calculateUrgency(source: InventoryState, target: InventoryState): number {
    let urgency = 5.0; // Base urgency

    // Increase urgency for very low stock
    if (target.quantity <= this.productConfig.thresholds.lowStockThreshold * 0.5) {
      urgency += 3.0;
    }

    // Increase urgency for very high stock at source
    if (source.quantity >= this.productConfig.thresholds.highStockThreshold * 1.5) {
      urgency += 2.0;
    }

    return Math.min(urgency, 10.0);
  }

  private generateReasoning(analysis: any, opportunities: ArbitrageOpportunity[]): string {
    const parts = [];

    if (analysis.lowStockStores.length > 0) {
      parts.push(`${analysis.lowStockStores.length} store(s) with low stock`);
    }

    if (analysis.overstockStores.length > 0) {
      parts.push(`${analysis.overstockStores.length} store(s) with overstock`);
    }

    if (opportunities.length > 0) {
      const bestOpportunity = opportunities[0];
      parts.push(`Best opportunity: ${bestOpportunity.profitMargin.toFixed(1)}% profit margin`);
    }

    return parts.join('; ') || 'Routine inventory analysis';
  }

  // Handler methods
  private async handleInventoryUpdate(payload: any): Promise<void> {
    if (payload.productId === this.productConfig.productId) {
      await this.updateInventoryStates();
    }
  }

  private async handleDemandSpike(payload: any): Promise<void> {
    // Handle demand spike notifications
    logger.info(`ProductAgent ${this.config.id} handling demand spike`, payload);
  }

  private async handleTradeProposal(payload: any): Promise<void> {
    // Evaluate incoming trade proposals
    logger.info(`ProductAgent ${this.config.id} received trade proposal`, payload);
  }

  private async handleMarketConditionChange(payload: any): Promise<void> {
    // Adjust strategy based on market conditions
    logger.info(`ProductAgent ${this.config.id} handling market condition change`, payload);
  }

  private async adjustPricing(parameters: any): Promise<void> {
    // Implement dynamic pricing logic
    logger.info(`ProductAgent ${this.config.id} adjusting pricing`, parameters);
  }

  private async reorderInventory(parameters: any): Promise<void> {
    // Implement reorder logic
    logger.info(`ProductAgent ${this.config.id} reordering inventory`, parameters);
  }
}
