// API Types and Interfaces

export interface AgentProduct {
  productId: string;
  name: string;
  category: string;
  brand: string;
  pricing: {
    baseCost: number;
    standardRetail: number;
    marginTargets: {
      minimum: number;
      target: number;
      premium: number;
    };
  };
  agentStatus: {
    status: 'initializing' | 'active' | 'paused' | 'error' | 'shutdown';
    lastDecisionAt: string;
    currentStrategy: string;
    activeActions: number;
    recentDecisionsCount: number;
    performanceMetrics: {
      successfulTransfers: number;
      totalProfitGenerated: number;
      averageDecisionConfidence: number;
      transferSuccessRate: number;
    };
  };
  currentDecision?: {
    type: string;
    confidence: number;
    reasoning: string;
    timestamp: string;
    actionsCount: number;
  };
  timestamps: {
    createdAt: string;
    updatedAt: string;
  };
}

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
  validUntil: string;
  conditions: {
    minQuantity?: number;
    maxTransportCost?: number;
    preferredTimeframe?: string;
  };
  metadata: {
    profitPotential: number;
    riskAssessment: number;
    confidenceLevel: number;
    seasonalFactors: any;
  };
  timestamp: string;
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
  createdAt: string;
  completedAt?: string;
}

export interface MarketOpportunity {
  type: string;
  description: string;
  profitPotential: number;
  urgency: string;
}

export interface MarketState {
  activeBids: MarketBid[];
  activeMatches: MarketMatch[];
  marketStats: {
    totalTransfers: number;
    totalVolume: number;
    totalProfit: number;
    averageMatchTime: number;
    successRate: number;
  };
  topOpportunities: MarketOpportunity[];
}

export interface AIInsights {
  productId: string;
  marketContext: {
    currentInventory: Array<{
      storeId: string;
      quantity: number;
      avgSalesPerDay: number;
      daysOfStock: number;
      localDemandScore: number;
    }>;
    marketTrends: {
      seasonalIndex: number;
      demandGrowthRate: number;
      priceElasticity: number;
      competitiveIndex: number;
    };
  };
  opportunities: Array<{
    type: string;
    description: string;
    profitPotential: number;
    riskLevel: number;
    timeWindow: string;
    confidence: number;
  }>;
  forecast: {
    demandForecast: number[];
    priceOptimization: number[];
    inventoryRecommendations: Array<{
      storeId: string;
      recommendedStock: number;
      reasoning: string;
    }>;
    riskFactors: string[];
    confidenceLevel: number;
  };
  aiInsights: {
    recommendedStrategy: string;
    confidenceLevel: number;
    lastDecision: any;
  };
}

export interface WebSocketEvent {
  type: 'marketBidSubmitted' | 'marketMatchCreated' | 'negotiationStarted' | 'negotiationCompleted' | 'transferExecuted' | 'agentActionCompleted';
  data: any;
  timestamp: string;
}

export interface DashboardStats {
  totalAgents: number;
  activeAgents: number;
  totalProfit: number;
  activeBids: number;
  activeMatches: number;
  successRate: number;
}
