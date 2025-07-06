import axios from 'axios';
import { AgentProduct, MarketBid, MarketMatch, MarketState, AIInsights } from '../types/api';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth (if needed in future)
api.interceptors.request.use(
  (config: any) => {
    // Add auth headers here if needed
    return config;
  },
  (error: any) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: any) => response,
  (error: any) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Agent Products API
export const agentProductsAPI = {
  // Get all agent products (fetch more than default pagination)
  getAll: () => api.get<AgentProduct[]>('/api/v1/products?limit=200'),
  
  // Get active agents only
  getActiveAgents: () => api.get('/api/v1/agents'),
  
  // Get agent product by ID
  getById: (id: string) => api.get<AgentProduct>(`/api/v1/products/${id}`),
  
  // Update agent product
  update: (id: string, data: Partial<AgentProduct>) => 
    api.put<AgentProduct>(`/api/v1/products/${id}`, data),
  
  // Start agent
  start: (id: string) => api.post(`/api/v1/agents/${id}/start`),
  
  // Stop agent
  stop: (id: string) => api.post(`/api/v1/agents/${id}/stop`),
  
  // Get agent metrics
  getMetrics: (id: string) => api.get(`/api/v1/agents/${id}/metrics`),
};

// Marketplace API
export const marketplaceAPI = {
  // Get marketplace state (using overview endpoint)
  getState: () => api.get<MarketState>('/api/v1/marketplace/overview'),
  
  // Get active bids
  getBids: () => api.get<MarketBid[]>('/api/v1/marketplace/bids'),
  
  // Get matches
  getMatches: () => api.get<MarketMatch[]>('/api/v1/marketplace/matches'),
  
  // Get opportunities
  getOpportunities: () => api.get('/api/v1/marketplace/opportunities'),
  
  // Place bid
  placeBid: (bid: Omit<MarketBid, 'id' | 'timestamp'>) => 
    api.post<MarketBid>('/api/v1/marketplace/bids', bid),
  
  // Accept match
  acceptMatch: (matchId: string) => api.post(`/api/v1/marketplace/matches/${matchId}/accept`),
  
  // Reject match
  rejectMatch: (matchId: string) => api.post(`/api/v1/marketplace/matches/${matchId}/reject`),
};

// AI Insights API
export const aiInsightsAPI = {
  // Get AI insights
  getInsights: () => api.get<AIInsights>('/api/v1/ai/insights'),
  
  // Get price predictions
  getPredictions: (productId?: string) => {
    const params = productId ? { productId } : {};
    return api.get('/api/v1/ai/predictions', { params });
  },
  
  // Get market analysis
  getMarketAnalysis: () => api.get('/api/v1/ai/market-analysis'),
  
  // Get recommendations
  getRecommendations: () => api.get('/api/v1/ai/recommendations'),
};

// AI Agent System API
export const aiAgentsAPI = {
  // Get AI agent system status
  getStatus: () => api.get('/api/v1/ai-agents/status'),
  
  // Get AI agent health
  getHealth: () => api.get('/api/v1/ai-agents/health'),
  
  // Trigger AI analysis for specific products
  analyzeProducts: (productIds: string[], forceAnalysis = false) => 
    api.post('/api/v1/ai-agents/analyze', { 
      product_ids: productIds, 
      force_analysis: forceAnalysis 
    }),
  
  // Run complete AI agent cycle
  runCycle: () => api.post('/api/v1/ai-agents/cycle'),
  
  // Get recent opportunities identified by AI
  getOpportunities: (limit = 20, storeId?: string) => {
    let url = `/api/v1/ai-agents/opportunities?limit=${limit}`;
    if (storeId) {
      url += `&storeId=${encodeURIComponent(storeId)}`;
    }
    return api.get(url);
  },
  
  // Get AI analysis for specific product
  getProductAnalysis: (productId: string) => 
    api.get(`/api/v1/ai-agents/products/${productId}`),
  
  // Trigger AI analysis for specific product
  analyzeProduct: (productId: string) => 
    api.post(`/api/v1/ai-agents/products/${productId}/analyze`),
};

// Analytics API
export const analyticsAPI = {
  // Get dashboard overview (fallback to mock data if endpoint doesn't exist)
  getOverview: async () => {
    try {
      return await api.get('/api/v1/analytics/overview');
    } catch (error) {
      // Fallback mock data if endpoint doesn't exist
      return {
        data: {
          totalRevenue: 12450.67,
          profitMargin: 0.28,
          totalTransactions: 342,
          activeAgents: 50,
          successRate: 0.94
        }
      };
    }
  },
  
  // Get performance metrics
  getPerformanceMetrics: async (timeRange?: string) => {
    try {
      const params = timeRange ? { timeRange } : {};
      return await api.get('/api/v1/analytics/performance', { params });
    } catch (error) {
      // Fallback mock data
      return {
        data: {
          revenue: Array.from({ length: 24 }, (_, i) => ({
            time: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
            value: Math.random() * 1000 + 500
          })),
          profit: Array.from({ length: 24 }, (_, i) => ({
            time: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
            value: Math.random() * 200 + 100
          }))
        }
      };
    }
  },
  
  // Get revenue data
  getRevenueData: async (timeRange?: string) => {
    try {
      const params = timeRange ? { timeRange } : {};
      return await api.get('/api/v1/analytics/revenue', { params });
    } catch (error) {
      // Fallback mock data
      return {
        data: {
          daily: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString(),
            revenue: Math.random() * 5000 + 2000
          }))
        }
      };
    }
  },
  
  // Get inventory trends
  getInventoryTrends: async () => {
    try {
      return await api.get('/api/v1/analytics/inventory-trends');
    } catch (error) {
      // Fallback mock data
      return {
        data: {
          trends: [
            { category: 'Electronics', growth: 0.15 },
            { category: 'Clothing', growth: 0.08 },
            { category: 'Books', growth: -0.02 },
            { category: 'Sports', growth: 0.12 }
          ]
        }
      };
    }
  },
};

// Trade Decisions API
export const tradeDecisionsAPI = {
  // Get all trade decisions with filtering
  getAll: (params?: {
    decision?: 'approved' | 'rejected';
    productId?: string;
    limit?: number;
    offset?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.decision) searchParams.append('decision', params.decision);
    if (params?.productId) searchParams.append('productId', params.productId);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    
    return api.get(`/api/v1/trade-decisions?${searchParams.toString()}`);
  },

  // Get trade decision by ID
  getById: (id: string) => api.get(`/api/v1/trade-decisions/${id}`),

  // Create a new trade decision
  create: (data: {
    productId: string;
    tradeId?: string;
    opportunityData: any;
    decision: 'approved' | 'rejected';
    bidId?: string;
    metadata?: any;
  }) => api.post('/api/v1/trade-decisions', data),

  // Get trade decision statistics
  getStats: () => api.get('/api/v1/trade-decisions/stats/overview'),
};

export default api;
