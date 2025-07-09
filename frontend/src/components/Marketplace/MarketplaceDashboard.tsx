import React, { useState, useEffect } from 'react';
import { marketplaceAPI, tradeDecisionsAPI } from '../../services/api';
import {
  ShoppingCartIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

interface MarketBid {
  id: string;
  productId: string;
  agentId: string;
  type: string;
  quantity: number;
  pricePerUnit: number;
  fromStoreId?: string;
  toStoreId?: string;
  urgency: string;
  validUntil: string;
  timestamp: string;
  conditions?: any;
  metadata?: {
    profitPotential?: number;
    confidenceLevel?: number;
    aiGenerated?: boolean;
    reasoning?: string;
  };
}

interface MarketMatch {
  id: string;
  buyProductId: string;
  sellProductId: string;
  quantity: number;
  agreedPrice: number;
  status: string;
  createdAt: string;
}

interface TradeDecision {
  _id: string;
  productId: string;
  opportunityData: {
    type: string;
    confidence: number;
    potential_profit: number;
    source_store: string;
    target_store: string;
    quantity: number;
    reasoning: string;
    urgency: string;
  };
  decision: 'approved' | 'rejected';
  bidId?: string;
  createdAt: string;
  metadata?: any;
}

const MarketplaceDashboard: React.FC<{ userRole: 'admin' | 'store'; storeId?: string }> = ({ userRole, storeId }) => {
  const [bids, setBids] = useState<MarketBid[]>([]);
  const [matches, setMatches] = useState<MarketMatch[]>([]);
  const [tradeDecisions, setTradeDecisions] = useState<TradeDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bids' | 'decisions'>('bids');

  useEffect(() => {
    loadMarketplaceData();
    // Refresh every 30 seconds
    const interval = setInterval(loadMarketplaceData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMarketplaceData = async () => {
    try {
      setLoading(true);
      const [bidsResponse, matchesResponse, decisionsResponse] = await Promise.all([
        marketplaceAPI.getBids(),
        marketplaceAPI.getMatches(),
        tradeDecisionsAPI.getAll({ limit: 50 }),
      ]);

      // Debug: Log raw bids for admin
      if (userRole === 'admin') {
        console.log('ADMIN: Raw bids API response:', bidsResponse.data);
      }

      // Debug logging for API responses and props
      console.log('MarketplaceDashboard DEBUG:', {
        userRole,
        storeId,
        bidsRaw: bidsResponse.data,
        matchesRaw: matchesResponse.data,
        tradeDecisionsRaw: decisionsResponse.data,
      });

      setBids((bidsResponse.data as any)?.data?.bids || (bidsResponse.data as any) || []);
      setMatches((matchesResponse.data as any)?.data?.matches || (matchesResponse.data as any) || []);
      setTradeDecisions((decisionsResponse.data as any)?.data?.decisions || (decisionsResponse.data as any) || []);
    } catch (error) {
      console.error('Error loading marketplace data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'matched':
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'expired':
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'pending':
        return 'text-yellow-400 bg-yellow-100';
      case 'matched':
      case 'completed':
        return 'text-green-400 bg-green-100';
      case 'expired':
      case 'cancelled':
        return 'text-red-400 bg-red-100';
      default:
        return 'text-gray-400 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Marketplace</h1>
          <p className="text-gray-400">Monitor and manage marketplace activity</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading marketplace data...</p>
        </div>
      </div>
    );
  }

  // Filter bids and matches for store users
  const filteredBids = userRole === 'admin'
    ? bids
    : bids.filter(
        b =>
          b.fromStoreId === `STORE-${storeId}` ||
          b.toStoreId === `STORE-${storeId}`
      );

  // Debug logging for filtered bids
  console.log('MarketplaceDashboard DEBUG: filteredBids', {
    userRole,
    storeId,
    filteredBids,
    allBids: bids,
  });

  const filteredMatches = userRole === 'admin'
    ? matches
    : matches.filter(
        m =>
          m.buyProductId === `STORE-${storeId}` ||
          m.sellProductId === `STORE-${storeId}`
      );

  // Use filtered data for stats
  const activeBids = filteredBids;
  const completedMatches = filteredMatches.filter(match => match.status === 'completed');
  const totalBidValue = activeBids.reduce((sum, bid) => sum + (bid.quantity * bid.pricePerUnit), 0);
  const totalMatchValue = completedMatches.reduce((sum, match) => sum + (match.quantity * match.agreedPrice), 0);

  // Filter trade decisions based on user role
  const filteredTradeDecisions = userRole === 'admin'
    ? tradeDecisions
    : tradeDecisions.filter(
        d =>
          d.opportunityData?.source_store === `STORE-${storeId}` ||
          d.opportunityData?.target_store === `STORE-${storeId}`
      );

  // Use filteredTradeDecisions for stats if not admin
  const statsTradeDecisions = userRole === 'admin' ? tradeDecisions : filteredTradeDecisions;

  // Completed Matches: total number of trades in trade history
  const completedMatchesCount = filteredTradeDecisions.length;

  // Match Value: sum of all potential_profit in trade history
  const matchValue = filteredTradeDecisions.reduce(
    (sum, d) => sum + (d.opportunityData?.potential_profit || 0),
    0
  );

  // Active Bids: count all filtered bids
  const activeBidsList = filteredBids;
  const activeBidsCount = activeBidsList.length;

  // Bid Value: sum of profitPotential of all filtered bids
  const bidValue = activeBidsList.reduce(
    (sum, bid) => sum + (bid.metadata?.profitPotential || 0),
    0
  );

  // Example: count of filtered trade decisions
  const tradeHistoryCount = statsTradeDecisions.length;

  // Example: total potential profit from filtered trade decisions
  const totalPotentialProfit = statsTradeDecisions.reduce(
    (sum, d) => sum + (d.opportunityData?.potential_profit || 0),
    0
  );

  // You can add more stats as needed, e.g. count of approved, rejected, etc.

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Marketplace</h1>
        <p className="text-gray-400">Monitor and manage marketplace activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center">
            <ShoppingCartIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Active Bids</p>
              <p className="text-2xl font-bold text-white">{activeBidsCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center">
            <UserGroupIcon className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Completed Matches</p>
              <p className="text-2xl font-bold text-white">{completedMatchesCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-8 w-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Bid Value</p>
              <p className="text-2xl font-bold text-white">${bidValue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-8 w-8 text-yellow-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Match Value</p>
              <p className="text-2xl font-bold text-white">${matchValue.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('bids')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'bids'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            Active Bids ({activeBidsCount})
          </button>
          <button
            onClick={() => setActiveTab('decisions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'decisions'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            Trade History ({filteredTradeDecisions.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        {activeTab === 'bids' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Active Marketplace Bids</h3>
            {activeBids.length > 0 ? (
              <div className="space-y-4">
                {activeBids.map((bid) => (
                  <div key={bid.id} className="bg-gray-700 rounded-md p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <ClockIcon className="h-5 w-5 text-yellow-500" />
                          <h4 className="text-white font-medium">{bid.productId}</h4>
                          <span className="px-2 py-1 rounded-full text-xs font-medium text-yellow-400 bg-yellow-100">
                            ACTIVE
                          </span>
                          <span className="text-sm text-gray-400">{bid.urgency} urgency</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-400">Type</p>
                            <p className="text-white">{bid.type}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Quantity</p>
                            <p className="text-white">{bid.quantity} units</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Price per Unit</p>
                            <p className="text-white">${bid.pricePerUnit.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Total Value</p>
                            <p className="text-green-400 font-medium">${(bid.quantity * bid.pricePerUnit).toLocaleString()}</p>
                          </div>
                        </div>
                        {bid.fromStoreId && bid.toStoreId && (
                          <div className="mt-2 text-sm">
                            <p className="text-gray-400">Transfer: <span className="text-white">{bid.fromStoreId} → {bid.toStoreId}</span></p>
                          </div>
                        )}
                      </div>
                      <div className="text-right text-sm text-gray-400">
                        <p>Agent: {bid.agentId}</p>
                        <p>Created: {new Date(bid.timestamp).toLocaleString()}</p>
                        <p>Valid until: {new Date(bid.validUntil).toLocaleString()}</p>
                        {bid.metadata?.profitPotential && (
                          <p className="text-green-400 font-medium">
                            Profit: ${bid.metadata.profitPotential.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ShoppingCartIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No active bids in the marketplace</p>
                <p className="text-gray-500 text-sm">Create trades in the Trading dashboard to see them here</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'decisions' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Trade Decision History</h3>
            {filteredTradeDecisions.length > 0 ? (
              <div className="space-y-4">
                {filteredTradeDecisions.map((decision) => (
                  <div key={decision._id} className="bg-gray-700 rounded-md p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {decision.decision === 'approved' ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 text-red-500" />
                          )}
                          <h4 className="text-white font-medium">{decision.productId}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            decision.decision === 'approved' 
                              ? 'text-green-400 bg-green-100' 
                              : 'text-red-400 bg-red-100'
                          }`}>
                            {decision.decision.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-400">{decision.opportunityData.urgency} urgency</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-2">
                          <div>
                            <p className="text-gray-400">Type</p>
                            <p className="text-white">{decision.opportunityData.type}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Quantity</p>
                            <p className="text-white">{decision.opportunityData.quantity} units</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Potential Profit</p>
                            <p className={`font-medium ${decision.decision === 'approved' ? 'text-green-400' : 'text-gray-400'}`}>
                              ${decision.opportunityData.potential_profit.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">Confidence</p>
                            <p className="text-white">{(decision.opportunityData.confidence * 100).toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="text-sm">
                          <p className="text-gray-400">
                            Transfer: <span className="text-white">{decision.opportunityData.source_store} → {decision.opportunityData.target_store}</span>
                          </p>
                          {decision.bidId && (
                            <p className="text-gray-400">
                              Bid ID: <span className="text-blue-400">{decision.bidId}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-400">
                        <p>Decision: {new Date(decision.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ClockIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No trade decisions yet</p>
                <p className="text-gray-500 text-sm">Approved and rejected trades will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceDashboard;
