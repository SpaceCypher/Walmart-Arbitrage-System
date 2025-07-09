import React, { useState, useEffect, useRef } from 'react';
import { aiAgentsAPI, tradeDecisionsAPI } from '../../services/api';
import {
  CheckCircleIcon,
  XCircleIcon,
  CurrencyDollarIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ClockIcon,
  FireIcon,
  TagIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import { 
  STORE_LOCATIONS, 
  PRODUCT_CATALOG, 
  calculateRealDistance, 
  calculateEnhancedTransportCost 
} from '../../utils/storeData';
import { useLocation, useNavigate } from 'react-router-dom';
import CardPopup from '../Common/CardPopup';

interface TradeOpportunity {
  id: string;
  product_id: string;
  product_name?: string;
  opportunity: {
    type: string;
    confidence: number;
    potential_profit: number;
    source_store: string;
    target_store: string;
    quantity: number;
    reasoning: string;
    urgency: string;
    transport_cost?: number;
    distance_km?: number;
    profit_margin?: number;
    source_inventory?: number;
    target_inventory?: number;
  };
  timestamp: string;
  analysis: string;
  status?: 'pending' | 'approved' | 'rejected' | 'executed';
}

// Add missing TradingDashboardProps interface
type TradingDashboardProps = {
  userRole: 'admin' | 'store';
  storeId?: string;
};

const TradingDashboard: React.FC<TradingDashboardProps> = ({ userRole, storeId }) => {
  const [opportunities, setOpportunities] = useState<TradeOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high-profit' | 'urgent'>('all');
  const [executingTrades, setExecutingTrades] = useState<Set<string>>(new Set());
  const [storeFilter, setStoreFilter] = useState(storeId || '');
  const [storeDetails, setStoreDetails] = useState<Record<string, any>>({});

  // Helper function to get store details (prefer backend, fallback to static, merge fields)
  const getStoreDetails = (storeId: string) => {
    const backend = storeDetails[storeId] || {};
    const staticData = STORE_LOCATIONS[storeId as keyof typeof STORE_LOCATIONS] || {};
    return {
      name: backend.name || staticData.name || `Store ${storeId}`,
      location: backend.location || staticData.location || 'Unknown Location',
      address: backend.address || staticData.address || null,
      type: backend.type || staticData.type || 'retail',
      capacity: backend.capacity || staticData.capacity || 1000,
      specialties: backend.specialties || staticData.specialties || [],
      ...backend, // include any extra backend fields
    };
  };

  // Helper function to get product details
  const getProductDetails = (productId: string) => {
    return PRODUCT_CATALOG[productId as keyof typeof PRODUCT_CATALOG] || {
      name: `Product ${productId}`,
      category: 'Unknown',
      brand: 'Unknown',
      weight: 1,
      dimensions: { length: 20, width: 15, height: 10 },
      fragile: false,
      temperature_controlled: false,
      value_per_unit: 100
    };
  };

  // Helper function to get store type info
  const getStoreTypeInfo = (type: string) => {
    switch (type) {
      case 'flagship':
        return { icon: '🏢', color: 'text-purple-400', label: 'Flagship Store' };
      case 'warehouse':
        return { icon: '🏭', color: 'text-blue-400', label: 'Warehouse' };
      case 'distribution':
        return { icon: '📦', color: 'text-green-400', label: 'Distribution Center' };
      case 'outlet':
        return { icon: '🏪', color: 'text-orange-400', label: 'Outlet Store' };
      default:
        return { icon: '🏬', color: 'text-gray-400', label: 'Retail Store' };
    }
  };

  // Helper function to calculate estimated delivery time
  const calculateDeliveryTime = (distance: number, isUrgent: boolean): string => {
    let hours = Math.max(2, Math.ceil(distance / 50));
    hours += isUrgent ? 1 : 2;
    if (hours <= 24) {
      return `${hours} hours`;
    } else {
      const days = Math.ceil(hours / 24);
      return `${days} ${days === 1 ? 'day' : 'days'}`;
    }
  };

  // Helper function to get type icon
  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'arbitrage':
        return <CurrencyDollarIcon className="h-6 w-6 text-green-400" />;
      case 'restock':
        return <CubeIcon className="h-6 w-6 text-blue-400" />;
      default:
        return <SparklesIcon className="h-6 w-6 text-purple-400" />;
    }
  };

  // Helper function to get urgency color
  const getUrgencyColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to calculate distance between stores
  const calculateDistance = (sourceStore: string, targetStore: string): number => {
    return calculateRealDistance(sourceStore, targetStore);
  };

  // Helper function to calculate transport cost
  const calculateTransportCost = (productId: string, quantity: number, distance: number): { totalCost: number, breakdown: any } => {
    return calculateEnhancedTransportCost(productId, quantity, distance);
  };

  // Helper function to get product name from product ID
  const getProductName = (productId: string): string => {
    const product = PRODUCT_CATALOG[productId as keyof typeof PRODUCT_CATALOG];
    return product?.name || `Product ${productId}`;
  };

  // Helper function to get store details from backend (with cache)
  const storeDetailsCache: Record<string, any> = {};
  async function fetchStoreDetails(storeId: string): Promise<any> {
    if (storeDetailsCache[storeId]) return storeDetailsCache[storeId];
    try {
      const res = await fetch(`/api/v1/stores/${storeId}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      storeDetailsCache[storeId] = data.data || data.store || data;
      return storeDetailsCache[storeId];
    } catch {
      return null;
    }
  }

  const location = useLocation();
  const navigate = useNavigate();
  const selectedRef = useRef<HTMLDivElement | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ type: 'success' | 'error' | 'reject', message: string } | null>(null);

  // If logged in as store, lock the filter and prevent editing
  const isStoreUser = userRole === 'store';

  useEffect(() => {
    loadOpportunities();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadOpportunities, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Get tradeId from query param
    const params = new URLSearchParams(location.search);
    const tradeId = params.get('tradeId');
    setSelectedTradeId(tradeId);
  }, [location.search]);

  useEffect(() => {
    if (selectedRef.current && selectedTradeId) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Remove tradeId from URL after focusing, but keep highlight for 1s
      const params = new URLSearchParams(location.search);
      if (params.has('tradeId')) {
        params.delete('tradeId');
        navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
        setTimeout(() => setSelectedTradeId(null), 1000); // Keep highlight for 1s
      }
    }
  }, [selectedTradeId, loading]);

  const loadOpportunities = async () => {
    try {
      setLoading(true);
      const response = await aiAgentsAPI.getOpportunities(50);
      
      // Transform opportunities and filter out those with actionable trades
      const transformedOpportunities = (response.data?.data?.opportunities || [])
        .map((opp: any, index: number) => ({
          id: opp.id || `${opp.product_id}-${index}`, // Use the AI-generated ID if available
          ...opp,
          status: opp.status || 'pending',
        }))
        .filter((opp: any) => 
          opp.opportunity?.source_store && 
          opp.opportunity?.target_store && 
          opp.opportunity?.potential_profit >= 0 &&
          opp.opportunity?.source_store !== 'null' &&
          opp.opportunity?.target_store !== 'null'
        );
      
      setOpportunities(transformedOpportunities);
    } catch (error) {
      console.error('Error loading opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  function getStoreNameSafe(storeId: string): string {
    if (storeId in STORE_LOCATIONS) {
      return STORE_LOCATIONS[storeId as keyof typeof STORE_LOCATIONS].name.toLowerCase();
    }
    return '';
  }

  const filteredOpportunities = opportunities.filter(opp => {
    const storeFilterValue = storeFilter.trim().toLowerCase();

    // Get store IDs/codes
    const sourceStoreId = (opp.opportunity.source_store || '').toLowerCase();
    const targetStoreId = (opp.opportunity.target_store || '').toLowerCase();

    // Get store names safely
    const sourceStoreName = getStoreNameSafe(opp.opportunity.source_store);
    const targetStoreName = getStoreNameSafe(opp.opportunity.target_store);

    const storeMatch =
      !storeFilterValue ||
      sourceStoreId.includes(storeFilterValue) ||
      targetStoreId.includes(storeFilterValue) ||
      sourceStoreName.includes(storeFilterValue) ||
      targetStoreName.includes(storeFilterValue);

    if (!storeMatch) return false;
    if (filter === 'high-profit') return opp.opportunity.potential_profit > 10000;
    if (filter === 'urgent') return opp.opportunity.urgency === 'critical' || opp.opportunity.urgency === 'high';
    return true;
  });

  const handleApprove = async (opportunity: TradeOpportunity) => {
    // Prevent multiple clicks on the same opportunity
    if (executingTrades.has(opportunity.id)) {
      return;
    }

    try {
      setExecutingTrades(prev => new Set(prev).add(opportunity.id));
      
      // Immediately remove from UI to prevent duplicate clicks
      setOpportunities(prev => 
        prev.filter(opp => opp.id !== opportunity.id)
      );
      
      // First, create a trade record to get a tradeId
      const tradeData = {
        fromStoreId: opportunity.opportunity.source_store,
        toStoreId: opportunity.opportunity.target_store,
        productId: opportunity.product_id,
        sku: `${opportunity.product_id}-${opportunity.opportunity.source_store}`,
        quantity: opportunity.opportunity.quantity,
        estimatedProfit: opportunity.opportunity.potential_profit,
        transportCost: 0, // This would be calculated by the transport cost function
        urgencyScore: 75, // Convert urgency to score
        proposedBy: 'user',
        reasoning: opportunity.opportunity.reasoning,
        constraints: {
          maxTransportCost: opportunity.opportunity.potential_profit * 0.2,
          minProfitMargin: 5,
          deliveryDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          minQuantity: Math.floor(opportunity.opportunity.quantity * 0.5),
          maxQuantity: opportunity.opportunity.quantity,
        }
      };

      // Create the trade record
      const tradeResponse = await fetch('/api/v1/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tradeData),
      });

      if (!tradeResponse.ok) {
        const tradeError = await tradeResponse.json();
        throw new Error(tradeError.error || 'Failed to create trade');
      }

      const tradeResult = await tradeResponse.json();
      const tradeId = tradeResult.data.tradeId;

      // Create marketplace bid
      const bidData = {
        agentId: `ai_agent_${opportunity.product_id}`,
        productId: opportunity.product_id,
        type: opportunity.opportunity.type === 'arbitrage' ? 'transfer' : 'restock',
        quantity: opportunity.opportunity.quantity,
        pricePerUnit: opportunity.opportunity.potential_profit / opportunity.opportunity.quantity,
        fromStoreId: opportunity.opportunity.source_store,
        toStoreId: opportunity.opportunity.target_store,
        urgency: opportunity.opportunity.urgency,
        validHours: 24,
        metadata: {
          profitPotential: opportunity.opportunity.potential_profit,
          confidenceLevel: opportunity.opportunity.confidence,
          aiGenerated: true,
          reasoning: opportunity.opportunity.reasoning,
          tradeId: tradeId,
        }
      };

      // Call the marketplace API to create the bid
      const response = await fetch('/api/v1/marketplace/bids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bidData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create bid');
      }

      const result = await response.json();
      const bidId = result.data.bidId;
      
      // Save trade decision to backend
      await tradeDecisionsAPI.create({
        productId: opportunity.product_id,
        tradeId: tradeId,
        opportunityData: opportunity.opportunity,
        decision: 'approved',
        bidId,
        metadata: bidData.metadata
      });

      // Mark the opportunity as processed in the AI system
      try {
        await fetch(`/api/v1/ai-agents/opportunities/${opportunity.id}/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            decision: 'approved',
            tradeId: tradeId,
            bidId: bidId
          }),
        });
      } catch (error) {
        console.warn('Could not mark opportunity as processed in AI system:', error);
      }
      
      setPopup({
        type: 'success',
        message: `✅ Trade approved! Trade ${tradeId} and Bid ${bidId} created for ${opportunity.opportunity.quantity} units with potential profit of $${opportunity.opportunity.potential_profit.toLocaleString()}`
      });
    } catch (error) {
      console.error('Error approving trade:', error);
      
      // Re-add the opportunity back to the list if there was an error
      setOpportunities(prev => [opportunity, ...prev]);
      
      setPopup({
        type: 'error',
        message: `❌ Failed to approve trade: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setExecutingTrades(prev => {
        const newSet = new Set(prev);
        newSet.delete(opportunity.id);
        return newSet;
      });
    }
  };

  const handleReject = async (opportunity: TradeOpportunity) => {
    try {
      // Immediately remove from UI
      setOpportunities(prev => 
        prev.filter(opp => opp.id !== opportunity.id)
      );
      
      // Save trade decision to backend
      await tradeDecisionsAPI.create({
        productId: opportunity.product_id,
        opportunityData: opportunity.opportunity,
        decision: 'rejected'
      });

      // Mark the opportunity as processed in the AI system
      try {
        await fetch(`/api/v1/ai-agents/opportunities/${opportunity.id}/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            decision: 'rejected'
          }),
        });
      } catch (error) {
        console.warn('Could not mark opportunity as processed in AI system:', error);
      }
      
      setPopup({
        type: 'reject',
        message: `❌ Trade rejected for ${opportunity.product_id}`
      });
    } catch (error) {
      console.error('Error rejecting trade:', error);
      
      // Re-add the opportunity back to the list if there was an error
      setOpportunities(prev => [opportunity, ...prev]);
      
      setPopup({
        type: 'error',
        message: `❌ Failed to reject trade: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  // Fetch store details for all unique store IDs in opportunities
  useEffect(() => {
    const uniqueStoreIds = Array.from(new Set(
      opportunities.flatMap(opp => [opp.opportunity.source_store, opp.opportunity.target_store])
    ));
    uniqueStoreIds.forEach(async (id) => {
      if (!storeDetails[id]) {
        const details = await fetchStoreDetails(id);
        if (details) setStoreDetails(prev => ({ ...prev, [id]: details }));
      }
    });
  }, [opportunities]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Trading Dashboard</h1>
          <p className="text-gray-400">Review and execute AI-generated trading opportunities</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading trading opportunities...</p>
        </div>
      </div>
    );
  }

  const totalProfitPotential = filteredOpportunities
    .filter(opp => opp.status === 'pending')
    .reduce((sum, opp) => sum + opp.opportunity.potential_profit, 0);

  return (
    <div className="space-y-6">
      {popup && (
        <CardPopup type={popup.type} message={popup.message} onClose={() => setPopup(null)} />
      )}
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Trading Dashboard</h1>
        <p className="text-gray-400">Review and execute AI-generated trading opportunities</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center">
            <SparklesIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Total Opportunities</p>
              <p className="text-2xl font-bold text-white">{filteredOpportunities.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Profit Potential</p>
              <p className="text-2xl font-bold text-green-400">${totalProfitPotential.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Urgent Trades</p>
              <p className="text-2xl font-bold text-red-400">
                {filteredOpportunities.filter(opp => 
                  (opp.opportunity.urgency === 'critical' || opp.opportunity.urgency === 'high') && 
                  opp.status === 'pending'
                ).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center">
            <CheckCircleIcon className="h-8 w-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Executed Today</p>
              <p className="text-2xl font-bold text-purple-400">
                {opportunities.filter(opp => opp.status === 'approved').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Store Filter Input */}
      <div className="flex items-center space-x-4 mb-4">
        <input
          type="text"
          placeholder="Filter by Store ID..."
          value={storeFilter}
          onChange={e => !isStoreUser && setStoreFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 w-64"
          disabled={isStoreUser}
        />
        <span className="text-gray-400 text-sm">
          Showing trades for store ID: <span className="font-semibold text-blue-400">{storeFilter || 'All'}</span>
        </span>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          All Opportunities
        </button>
        <button
          onClick={() => setFilter('high-profit')}
          className={`px-4 py-2 rounded-md ${
            filter === 'high-profit' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          High Profit ($10K+)
        </button>
        <button
          onClick={() => setFilter('urgent')}
          className={`px-4 py-2 rounded-md ${
            filter === 'urgent' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Urgent
        </button>
      </div>

      {/* Trading Opportunities */}
      <div className="space-y-4">
        {filteredOpportunities.length > 0 ? (
          filteredOpportunities.map((opportunity) => {
            const distance = calculateDistance(opportunity.opportunity.source_store, opportunity.opportunity.target_store);
            const transportResult = calculateTransportCost(opportunity.product_id, opportunity.opportunity.quantity, distance);
            const transportCost = transportResult.totalCost;
            const netProfit = opportunity.opportunity.potential_profit - transportCost;
            const profitMargin = ((netProfit / (opportunity.opportunity.potential_profit || 1)) * 100);
            const productName = getProductName(opportunity.product_id);
            const sourceStore = getStoreDetails(opportunity.opportunity.source_store);
            const targetStore = getStoreDetails(opportunity.opportunity.target_store);
            const productDetails = getProductDetails(opportunity.product_id);
            const sourceStoreType = getStoreTypeInfo(sourceStore.type);
            const targetStoreType = getStoreTypeInfo(targetStore.type);
            const estimatedDelivery = calculateDeliveryTime(distance, opportunity.opportunity.urgency === 'high' || opportunity.opportunity.urgency === 'critical');
            const isSelected = selectedTradeId === opportunity.id;
            return (
              <div
                key={opportunity.id}
                ref={isSelected ? selectedRef : undefined}
                className={`bg-gray-800 rounded-lg border p-6 ${
                  isSelected ? 'border-yellow-400 ring-2 ring-yellow-300 shadow-yellow-400/30' :
                  opportunity.status === 'pending' ? 'border-gray-700 shadow-lg' :
                  opportunity.status === 'approved' ? 'border-green-500 shadow-green-500/20' :
                  'border-red-500 shadow-red-500/20'
                } transition-all duration-200 hover:shadow-xl`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {/* Enhanced Header with Product Details */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {getTypeIcon(opportunity.opportunity.type)}
                        <div>
                          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                            <span>{productName}</span>
                            {productDetails.fragile && <span className="text-orange-400 text-sm">🔸</span>}
                            {productDetails.temperature_controlled && <span className="text-blue-400 text-sm">❄️</span>}
                          </h3>
                          <div className="flex items-center space-x-3 mt-1">
                            <p className="text-sm text-gray-400">{opportunity.product_id}</p>
                            <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                              <TagIcon className="h-3 w-3 inline mr-1" />
                              {productDetails.category}
                            </span>
                            <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                              {productDetails.brand}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getUrgencyColor(opportunity.opportunity.urgency)}`}>
                          {opportunity.opportunity.urgency === 'high' && <FireIcon className="h-3 w-3" />}
                          <span>{opportunity.opportunity.urgency.toUpperCase()}</span>
                        </span>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">AI Confidence</p>
                          <p className="text-lg font-bold text-blue-400">
                            {(opportunity.opportunity.confidence * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Store Transfer Details */}
                    <div className="bg-gray-700 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-300">📍 Store Transfer Route</h4>
                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                          <ClockIcon className="h-4 w-4" />
                          <span>Est. delivery: {estimatedDelivery}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-400">FROM</p>
                          <p className="text-white font-medium flex items-center space-x-2">
                            <span>{sourceStoreType.icon}</span>
                            <span>{sourceStore.name}</span>
                          </p>
                          <p className="text-xs text-gray-500">{opportunity.opportunity.source_store}</p>
                          {sourceStore.address && (
                            <p className="text-xs text-gray-400">
                              {sourceStore.address.street}, {sourceStore.address.city}, {sourceStore.address.state} {sourceStore.address.zipCode}, {sourceStore.address.country}
                            </p>
                          )}
                          <span className={`text-xs ${sourceStoreType.color} mt-1 inline-block`}>
                            {sourceStoreType.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-center">
                          <div className="flex flex-col items-center space-y-1">
                            <div className="flex items-center space-x-2">
                              <TruckIcon className="h-5 w-5 text-blue-400" />
                              <span className="text-sm text-gray-300">{distance.toFixed(1)} km</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {productDetails.fragile && <span className="text-orange-400">Handle with care</span>}
                              {productDetails.temperature_controlled && <span className="text-blue-400">Climate controlled</span>}
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">TO</p>
                          <p className="text-white font-medium flex items-center space-x-2">
                            <span>{targetStoreType.icon}</span>
                            <span>{targetStore.name}</span>
                          </p>
                          <p className="text-xs text-gray-500">{opportunity.opportunity.target_store}</p>
                          {targetStore.address && (
                            <p className="text-xs text-gray-400">
                              {targetStore.address.street}, {targetStore.address.city}, {targetStore.address.state} {targetStore.address.zipCode}, {targetStore.address.country}
                            </p>
                          )}
                          <span className={`text-xs ${targetStoreType.color} mt-1 inline-block`}>
                            {targetStoreType.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Financial Breakdown */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div className="bg-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-400 flex items-center">
                          <CubeIcon className="h-3 w-3 mr-1" />
                          Quantity
                        </p>
                        <p className="text-lg font-bold text-white">{opportunity.opportunity.quantity}</p>
                        <p className="text-xs text-gray-500">units ({(productDetails.weight * opportunity.opportunity.quantity).toFixed(1)} kg)</p>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-400">Unit Value</p>
                        <p className="text-lg font-bold text-blue-400">
                          ${productDetails.value_per_unit.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">per unit</p>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-400">Gross Profit</p>
                        <p className="text-lg font-bold text-green-400">
                          ${opportunity.opportunity.potential_profit.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">before transport</p>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-400 flex items-center">
                          <TruckIcon className="h-3 w-3 mr-1" />
                          Transport Cost
                        </p>
                        <p className="text-lg font-bold text-orange-400">
                          ${transportCost.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">${(transportCost/opportunity.opportunity.quantity).toFixed(2)}/unit</p>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-400 flex items-center">
                          <CurrencyDollarIcon className="h-3 w-3 mr-1" />
                          Net Profit
                        </p>
                        <p className={`text-lg font-bold ${netProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${netProfit.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">{profitMargin.toFixed(1)}% margin</p>
                      </div>
                    </div>

                    {/* Product & Transport Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-700 rounded-lg p-3">
                        <h5 className="text-sm font-medium text-gray-300 mb-2">📦 Product Details</h5>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Weight:</span>
                            <span className="text-white">{productDetails.weight} kg/unit</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Dimensions:</span>
                            <span className="text-white">{productDetails.dimensions.length}×{productDetails.dimensions.width}×{productDetails.dimensions.height} cm</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Special Handling:</span>
                            <span className="text-white">
                              {productDetails.fragile && productDetails.temperature_controlled ? 'Fragile + Climate' :
                               productDetails.fragile ? 'Fragile' :
                               productDetails.temperature_controlled ? 'Climate Controlled' : 'Standard'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-3">
                        <h5 className="text-sm font-medium text-gray-300 mb-2">🚛 Transport Breakdown</h5>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Distance Cost:</span>
                            <span className="text-white">${transportResult.breakdown.distanceCost?.toFixed(2) || '0.00'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Weight/Volume:</span>
                            <span className="text-white">${((transportResult.breakdown.weightCost || 0) + (transportResult.breakdown.volumeCost || 0)).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Special Handling:</span>
                            <span className="text-white">${transportResult.breakdown.specialHandling?.toFixed(2) || '0.00'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Trade Type and Risk Assessment */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center space-x-3">
                        <span className={`px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2 ${
                          opportunity.opportunity.type === 'arbitrage' 
                            ? 'bg-purple-900 bg-opacity-50 text-purple-300 border border-purple-600' 
                            : 'bg-blue-900 bg-opacity-50 text-blue-300 border border-blue-600'
                        }`}>
                          <span>{opportunity.opportunity.type === 'arbitrage' ? '💰' : '📦'}</span>
                          <span>{opportunity.opportunity.type === 'arbitrage' ? 'Arbitrage Trade' : 'Restock Operation'}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-end space-x-2">
                        <span className="text-xs text-gray-400">
                          Risk Level:
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          netProfit < 0 ? 'bg-red-900 text-red-300' :
                          profitMargin < 10 ? 'bg-yellow-900 text-yellow-300' :
                          'bg-green-900 text-green-300'
                        }`}>
                          {netProfit < 0 ? 'High Risk' : profitMargin < 10 ? 'Medium Risk' : 'Low Risk'}
                        </span>
                      </div>
                    </div>

                    {/* AI Analysis */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-2">🤖 AI Analysis</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{opportunity.opportunity.reasoning}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="ml-6 flex flex-col space-y-3">
                    {opportunity.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(opportunity)}
                          disabled={executingTrades.has(opportunity.id)}
                          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-md font-medium min-w-[140px] justify-center"
                        >
                          <CheckCircleIcon className="h-5 w-5" />
                          <span>{executingTrades.has(opportunity.id) ? 'Executing...' : 'Approve Trade'}</span>
                        </button>
                        <button
                          onClick={() => handleReject(opportunity)}
                          className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-md font-medium min-w-[140px] justify-center"
                        >
                          <XCircleIcon className="h-5 w-5" />
                          <span>Reject</span>
                        </button>
                        
                        {/* Enhanced Quick Stats */}
                        <div className="mt-4 p-3 bg-gray-900 rounded-lg border border-gray-800">
                          <p className="text-xs text-gray-400 mb-2 flex items-center">
                            <SparklesIcon className="h-3 w-3 mr-1" />
                            Quick Overview
                          </p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Distance:</span>
                              <span className="text-white">{distance.toFixed(0)} km</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Delivery:</span>
                              <span className="text-white">{estimatedDelivery}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Transport:</span>
                              <span className="text-orange-300">${(transportCost/opportunity.opportunity.quantity).toFixed(2)}/unit</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Total Weight:</span>
                              <span className="text-white">{(productDetails.weight * opportunity.opportunity.quantity).toFixed(1)} kg</span>
                            </div>
                            <hr className="border-gray-700 my-1" />
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-gray-400">Net Profit:</span>
                              <span className={netProfit > 0 ? 'text-green-400' : 'text-red-400'}>
                                ${netProfit.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {opportunity.status === 'approved' && (
                      <div className="flex flex-col items-center space-y-2">
                        <div className="flex items-center space-x-2 text-green-400">
                          <CheckCircleIcon className="h-6 w-6" />
                          <span className="font-medium">Approved</span>
                        </div>
                        <div className="text-center p-3 bg-green-900 bg-opacity-20 rounded-lg">
                          <p className="text-xs text-green-400">Trade Executed</p>
                          <p className="text-sm text-green-300 font-medium">
                            ${netProfit.toLocaleString()} profit
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {opportunity.status === 'rejected' && (
                      <div className="flex flex-col items-center space-y-2">
                        <div className="flex items-center space-x-2 text-red-400">
                          <XCircleIcon className="h-6 w-6" />
                          <span className="font-medium">Rejected</span>
                        </div>
                        <div className="text-center p-3 bg-red-900 bg-opacity-20 rounded-lg">
                          <p className="text-xs text-red-400">Trade Declined</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
            <SparklesIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Trading Opportunities</h3>
            <p className="text-gray-400">
              {filter === 'all' 
                ? 'No actionable trading opportunities found. AI agents are analyzing market data...'
                : `No opportunities matching the "${filter}" filter. Try adjusting your filters.`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingDashboard;
