import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { keydb } from '../config/keydb';
import { AgentProduct } from '../models/AgentProduct';

// Market bid/ask interfaces
export interface MarketBid {
  id: string;
  agentId: string;
  productId: string;
  type: 'buy' | 'sell';
  quantity: number;
  pricePerUnit: number;
  fromStoreId?: string;
  toStoreId?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  validUntil: Date;
  conditions: {
    minQuantity?: number;
    maxTransportCost?: number;
    preferredTimeframe?: string;
    qualityRequirements?: string[];
  };
  metadata: {
    profitPotential: number;
    riskAssessment: number;
    confidenceLevel: number;
    seasonalFactors: any;
  };
  timestamp: Date;
}

export interface MarketMatch {
  id: string;
  buyBid: MarketBid;
  sellBid: MarketBid;
  agreedQuantity: number;
  agreedPrice: number;
  estimatedProfit: number;
  transportCost: number;
  status: 'pending' | 'confirmed' | 'executing' | 'completed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
}

export interface TransferNegotiation {
  id: string;
  participants: string[]; // Agent IDs
  subject: {
    productId: string;
    quantity: number;
    fromStore: string;
    toStore: string;
  };
  offers: Array<{
    agentId: string;
    priceOffer: number;
    conditions: any;
    timestamp: Date;
  }>;
  status: 'negotiating' | 'agreed' | 'rejected' | 'expired';
  agreedTerms?: any;
  deadline: Date;
}

export class InternalMarketplace extends EventEmitter {
  private activeBids: Map<string, MarketBid> = new Map();
  private activeMatches: Map<string, MarketMatch> = new Map();
  private negotiations: Map<string, TransferNegotiation> = new Map();
  private marketStats = {
    totalTransfers: 0,
    totalVolume: 0,
    totalProfit: 0,
    averageMatchTime: 0,
    successRate: 0
  };

  constructor() {
    super();
    this.initializeMarket();
  }

  /**
   * Submit a bid to the internal marketplace
   */
  async submitBid(bid: Omit<MarketBid, 'id' | 'timestamp'>): Promise<string> {
    try {
      const bidId = this.generateId();
      const fullBid: MarketBid = {
        ...bid,
        id: bidId,
        timestamp: new Date()
      };

      // Validate bid
      if (!this.validateBid(fullBid)) {
        throw new Error('Invalid bid parameters');
      }

      // Store bid
      this.activeBids.set(bidId, fullBid);
      await this.persistBid(fullBid);

      logger.info('Market bid submitted', {
        bidId,
        agentId: bid.agentId,
        productId: bid.productId,
        type: bid.type,
        quantity: bid.quantity,
        pricePerUnit: bid.pricePerUnit
      });

      // Emit bid event
      this.emit('bidSubmitted', fullBid);

      // Try to find matches immediately
      await this.findMatches(fullBid);

      return bidId;

    } catch (error) {
      logger.error('Failed to submit bid:', error);
      throw error;
    }
  }

  /**
   * Find and create matches for a bid
   */
  async findMatches(newBid: MarketBid): Promise<MarketMatch[]> {
    try {
      const matches: MarketMatch[] = [];
      const oppositeType = newBid.type === 'buy' ? 'sell' : 'buy';

      // Find compatible bids
      for (const [bidId, existingBid] of this.activeBids) {
        if (
          existingBid.type === oppositeType &&
          existingBid.productId === newBid.productId &&
          this.areCompatible(newBid, existingBid)
        ) {
          const match = await this.createMatch(newBid, existingBid);
          if (match) {
            matches.push(match);
            
            // Remove matched bids
            this.activeBids.delete(newBid.id);
            this.activeBids.delete(bidId);
            
            // Store match
            this.activeMatches.set(match.id, match);
            await this.persistMatch(match);
            
            // Emit match event
            this.emit('matchCreated', match);
            
            logger.info('Market match created', {
              matchId: match.id,
              productId: newBid.productId,
              quantity: match.agreedQuantity,
              price: match.agreedPrice,
              profit: match.estimatedProfit
            });
          }
        }
      }

      return matches;

    } catch (error) {
      logger.error('Error finding matches:', error);
      return [];
    }
  }

  /**
   * Start a negotiation between agents
   */
  async startNegotiation(params: {
    initiatorId: string;
    targetId: string;
    productId: string;
    quantity: number;
    fromStore: string;
    toStore: string;
    initialOffer: number;
  }): Promise<string> {
    try {
      const negotiationId = this.generateId();
      
      const negotiation: TransferNegotiation = {
        id: negotiationId,
        participants: [params.initiatorId, params.targetId],
        subject: {
          productId: params.productId,
          quantity: params.quantity,
          fromStore: params.fromStore,
          toStore: params.toStore
        },
        offers: [{
          agentId: params.initiatorId,
          priceOffer: params.initialOffer,
          conditions: {},
          timestamp: new Date()
        }],
        status: 'negotiating',
        deadline: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      };

      this.negotiations.set(negotiationId, negotiation);
      await this.persistNegotiation(negotiation);

      // Notify target agent
      this.emit('negotiationStarted', {
        negotiationId,
        initiator: params.initiatorId,
        target: params.targetId,
        subject: negotiation.subject,
        initialOffer: params.initialOffer
      });

      logger.info('Negotiation started', {
        negotiationId,
        initiator: params.initiatorId,
        target: params.targetId,
        productId: params.productId
      });

      return negotiationId;

    } catch (error) {
      logger.error('Failed to start negotiation:', error);
      throw error;
    }
  }

  /**
   * Submit a counter-offer in a negotiation
   */
  async submitCounterOffer(
    negotiationId: string,
    agentId: string,
    offer: { priceOffer: number; conditions: any }
  ): Promise<boolean> {
    try {
      const negotiation = this.negotiations.get(negotiationId);
      
      if (!negotiation || negotiation.status !== 'negotiating') {
        throw new Error('Invalid or inactive negotiation');
      }

      if (!negotiation.participants.includes(agentId)) {
        throw new Error('Agent not part of this negotiation');
      }

      // Add offer
      negotiation.offers.push({
        agentId,
        priceOffer: offer.priceOffer,
        conditions: offer.conditions,
        timestamp: new Date()
      });

      await this.persistNegotiation(negotiation);

      // Check if offer is acceptable (simple logic)
      const lastOffer = negotiation.offers[negotiation.offers.length - 2];
      const priceDifference = Math.abs(offer.priceOffer - lastOffer.priceOffer);
      
      if (priceDifference < 0.05 * lastOffer.priceOffer) { // Within 5%
        // Accept the deal
        negotiation.status = 'agreed';
        negotiation.agreedTerms = {
          finalPrice: (offer.priceOffer + lastOffer.priceOffer) / 2,
          conditions: { ...lastOffer.conditions, ...offer.conditions }
        };

        await this.executeAgreedTransfer(negotiation);
        
        this.emit('negotiationCompleted', {
          negotiationId,
          agreedTerms: negotiation.agreedTerms
        });

        logger.info('Negotiation completed', {
          negotiationId,
          finalPrice: negotiation.agreedTerms.finalPrice,
          participants: negotiation.participants
        });

        return true;
      }

      // Continue negotiating
      this.emit('counterOfferReceived', {
        negotiationId,
        agentId,
        offer: offer.priceOffer
      });

      return false;

    } catch (error) {
      logger.error('Failed to submit counter-offer:', error);
      throw error;
    }
  }

  /**
   * Get current market state and opportunities
   */
  async getMarketState(): Promise<{
    activeBids: MarketBid[];
    activeMatches: MarketMatch[];
    marketStats: any;
    topOpportunities: Array<{
      type: string;
      description: string;
      profitPotential: number;
      urgency: string;
    }>;
  }> {
    try {
      const activeBids = Array.from(this.activeBids.values());
      const activeMatches = Array.from(this.activeMatches.values());
      
      // Calculate top opportunities
      const opportunities = await this.calculateTopOpportunities(activeBids);

      return {
        activeBids,
        activeMatches,
        marketStats: this.marketStats,
        topOpportunities: opportunities
      };

    } catch (error) {
      logger.error('Failed to get market state:', error);
      throw error;
    }
  }

  /**
   * Execute market clearing operations
   */
  async clearMarket(): Promise<void> {
    try {
      logger.info('Starting market clearing operations');

      // Remove expired bids
      const now = new Date();
      for (const [bidId, bid] of this.activeBids) {
        if (bid.validUntil < now) {
          this.activeBids.delete(bidId);
          await this.removeBid(bidId);
          
          this.emit('bidExpired', { bidId, agentId: bid.agentId });
        }
      }

      // Check expired negotiations
      for (const [negId, negotiation] of this.negotiations) {
        if (negotiation.deadline < now && negotiation.status === 'negotiating') {
          negotiation.status = 'expired';
          await this.persistNegotiation(negotiation);
          
          this.emit('negotiationExpired', { negotiationId: negId });
        }
      }

      // Update market statistics
      await this.updateMarketStats();

      logger.debug('Market clearing completed', {
        activeBids: this.activeBids.size,
        activeMatches: this.activeMatches.size,
        activeNegotiations: this.negotiations.size
      });

    } catch (error) {
      logger.error('Market clearing failed:', error);
    }
  }

  // Private helper methods

  private initializeMarket(): void {
    // Set up periodic market clearing
    setInterval(() => {
      this.clearMarket().catch(error => {
        logger.error('Scheduled market clearing failed:', error);
      });
    }, 60000); // Every minute

    logger.info('Internal marketplace initialized');
  }

  private validateBid(bid: MarketBid): boolean {
    return !!(
      bid.quantity > 0 &&
      bid.pricePerUnit > 0 &&
      bid.validUntil > new Date() &&
      bid.agentId &&
      bid.productId
    );
  }

  private areCompatible(bid1: MarketBid, bid2: MarketBid): boolean {
    // Check price compatibility
    if (bid1.type === 'buy' && bid2.type === 'sell') {
      return bid1.pricePerUnit >= bid2.pricePerUnit;
    }
    if (bid1.type === 'sell' && bid2.type === 'buy') {
      return bid2.pricePerUnit >= bid1.pricePerUnit;
    }
    
    // Check quantity compatibility
    const minQuantity = Math.max(
      bid1.conditions.minQuantity || 0,
      bid2.conditions.minQuantity || 0
    );
    const availableQuantity = Math.min(bid1.quantity, bid2.quantity);
    
    return availableQuantity >= minQuantity;
  }

  private async createMatch(buyBid: MarketBid, sellBid: MarketBid): Promise<MarketMatch | null> {
    try {
      const matchId = this.generateId();
      const agreedQuantity = Math.min(buyBid.quantity, sellBid.quantity);
      const agreedPrice = (buyBid.pricePerUnit + sellBid.pricePerUnit) / 2;
      
      // Calculate transport cost
      const transportCost = await this.calculateTransportCost(
        buyBid.fromStoreId || sellBid.fromStoreId || '',
        buyBid.toStoreId || sellBid.toStoreId || '',
        agreedQuantity
      );

      const estimatedProfit = (agreedPrice * agreedQuantity) - transportCost;

      const match: MarketMatch = {
        id: matchId,
        buyBid,
        sellBid,
        agreedQuantity,
        agreedPrice,
        estimatedProfit,
        transportCost,
        status: 'pending',
        createdAt: new Date()
      };

      return match;

    } catch (error) {
      logger.error('Failed to create match:', error);
      return null;
    }
  }

  private async executeAgreedTransfer(negotiation: TransferNegotiation): Promise<void> {
    try {
      // Create a transfer record
      const transferId = this.generateId();
      
      // In a real implementation, this would trigger actual inventory transfer
      logger.info('Executing agreed transfer', {
        transferId,
        negotiationId: negotiation.id,
        productId: negotiation.subject.productId,
        quantity: negotiation.subject.quantity,
        price: negotiation.agreedTerms?.finalPrice
      });

      // Update market statistics
      this.marketStats.totalTransfers += 1;
      this.marketStats.totalVolume += negotiation.subject.quantity;
      this.marketStats.totalProfit += negotiation.agreedTerms?.finalPrice || 0;

      // Emit transfer execution event
      this.emit('transferExecuted', {
        transferId,
        negotiationId: negotiation.id,
        subject: negotiation.subject,
        terms: negotiation.agreedTerms
      });

    } catch (error) {
      logger.error('Failed to execute agreed transfer:', error);
      throw error;
    }
  }

  private async calculateTopOpportunities(bids: MarketBid[]): Promise<Array<{
    type: string;
    description: string;
    profitPotential: number;
    urgency: string;
  }>> {
    const opportunities = [];

    // Analyze bid patterns for opportunities
    const buyBids = bids.filter(b => b.type === 'buy');
    const sellBids = bids.filter(b => b.type === 'sell');

    // Look for arbitrage opportunities
    for (const buyBid of buyBids) {
      for (const sellBid of sellBids) {
        if (buyBid.productId === sellBid.productId && buyBid.pricePerUnit > sellBid.pricePerUnit) {
          const profit = (buyBid.pricePerUnit - sellBid.pricePerUnit) * Math.min(buyBid.quantity, sellBid.quantity);
          
          opportunities.push({
            type: 'arbitrage',
            description: `Price arbitrage for ${buyBid.productId}`,
            profitPotential: profit,
            urgency: buyBid.urgency
          });
        }
      }
    }

    // Sort by profit potential
    return opportunities
      .sort((a, b) => b.profitPotential - a.profitPotential)
      .slice(0, 10);
  }

  private async calculateTransportCost(fromStore: string, toStore: string, quantity: number): Promise<number> {
    // Mock transport cost calculation
    const baseDistance = Math.random() * 500; // 0-500 km
    const costPerKm = 0.5; // $0.50 per km
    const baseCost = 25; // $25 base cost
    const costPerUnit = 0.1; // $0.10 per unit
    
    return baseCost + (baseDistance * costPerKm) + (quantity * costPerUnit);
  }

  private async updateMarketStats(): Promise<void> {
    // Update running averages and statistics
    const completedMatches = Array.from(this.activeMatches.values())
      .filter(m => m.status === 'completed');

    if (completedMatches.length > 0) {
      const totalMatchTime = completedMatches.reduce((sum, match) => {
        return sum + (match.completedAt!.getTime() - match.createdAt.getTime());
      }, 0);

      this.marketStats.averageMatchTime = totalMatchTime / completedMatches.length;
      this.marketStats.successRate = completedMatches.length / this.marketStats.totalTransfers;
    }
  }

  private generateId(): string {
    return `MKT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async persistBid(bid: MarketBid): Promise<void> {
    try {
      await keydb.getClient().setex(
        `market_bid:${bid.id}`,
        Math.floor((bid.validUntil.getTime() - Date.now()) / 1000),
        JSON.stringify(bid)
      );
    } catch (error) {
      logger.error('Failed to persist bid:', error);
    }
  }

  private async persistMatch(match: MarketMatch): Promise<void> {
    try {
      await keydb.getClient().setex(
        `market_match:${match.id}`,
        86400, // 24 hours
        JSON.stringify(match)
      );
    } catch (error) {
      logger.error('Failed to persist match:', error);
    }
  }

  private async persistNegotiation(negotiation: TransferNegotiation): Promise<void> {
    try {
      await keydb.getClient().setex(
        `negotiation:${negotiation.id}`,
        Math.floor((negotiation.deadline.getTime() - Date.now()) / 1000),
        JSON.stringify(negotiation)
      );
    } catch (error) {
      logger.error('Failed to persist negotiation:', error);
    }
  }

  private async removeBid(bidId: string): Promise<void> {
    try {
      await keydb.getClient().del(`market_bid:${bidId}`);
    } catch (error) {
      logger.error('Failed to remove bid:', error);
    }
  }
}

// Export singleton instance
export const internalMarketplace = new InternalMarketplace();
