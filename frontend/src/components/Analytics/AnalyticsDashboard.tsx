import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { analyticsAPI, aiAgentsAPI, marketplaceAPI, tradeDecisionsAPI } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner';

interface AnalyticsData {
  totalRevenue: number;
  profitMargin: number;
  totalTransactions: number;
  activeAgents: number;
  successRate: number;
}

interface AIMetrics {
  totalOpportunities: number;
  totalPotentialProfit: number;
  averageConfidence: number;
  highConfidenceOps: number;
  processedProducts: number;
}

interface MarketplaceMetrics {
  activeBids: number;
  totalMatches: number;
  totalBidValue: number;
  avgBidSize: number;
}

interface TradeDecisionMetrics {
  totalDecisions: number;
  approvedCount: number;
  rejectedCount: number;
  approvalRate: number;
  totalPotentialProfit: number;
  avgPotentialProfit: number;
}

const AnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [aiMetrics, setAiMetrics] = useState<AIMetrics | null>(null);
  const [marketMetrics, setMarketMetrics] = useState<MarketplaceMetrics | null>(null);
  const [tradeMetrics, setTradeMetrics] = useState<TradeDecisionMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalyticsData();
    
    // Refresh every 60 seconds
    const interval = setInterval(loadAnalyticsData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Load all analytics data in parallel
      const [analyticsResponse, aiOpportunities, aiStatus, bids, matches, tradeStats] = await Promise.all([
        analyticsAPI.getOverview(),
        aiAgentsAPI.getOpportunities(100).catch(() => ({ data: [] })),
        aiAgentsAPI.getStatus().catch(() => ({ data: { products_analyzed: 0 } })),
        marketplaceAPI.getBids().catch(() => ({ data: [] })),
        marketplaceAPI.getMatches().catch(() => ({ data: [] })),
        tradeDecisionsAPI.getStats().catch(() => ({ data: { overview: {}, profitMetrics: {} } })),
      ]);

      // Set basic analytics
      setAnalytics(analyticsResponse.data);

      // Process AI metrics
      const opportunities = (aiOpportunities.data as any)?.data?.opportunities || aiOpportunities.data || [];
      const status = (aiStatus.data as any)?.data || aiStatus.data || {};
      
      const totalPotentialProfit = opportunities.reduce((sum: number, opp: any) => sum + (opp.opportunity?.potential_profit || 0), 0);
      const averageConfidence = opportunities.length > 0 
        ? opportunities.reduce((sum: number, opp: any) => sum + (opp.opportunity?.confidence || 0), 0) / opportunities.length 
        : 0;
      const highConfidenceOps = opportunities.filter((opp: any) => (opp.opportunity?.confidence || 0) >= 0.8).length;

      setAiMetrics({
        totalOpportunities: opportunities.length,
        totalPotentialProfit,
        averageConfidence,
        highConfidenceOps,
        processedProducts: status.products_analyzed || 0,
      });

      // Process marketplace metrics
      const bidsData = (bids.data as any)?.data?.bids || bids.data || [];
      const matchesData = (matches.data as any)?.data?.matches || matches.data || [];
      
      const totalBidValue = bidsData.reduce((sum: number, bid: any) => sum + (bid.quantity * bid.pricePerUnit || 0), 0);
      const avgBidSize = bidsData.length > 0 ? totalBidValue / bidsData.length : 0;

      setMarketMetrics({
        activeBids: bidsData.length,
        totalMatches: matchesData.length,
        totalBidValue,
        avgBidSize,
      });

      // Process trade decision metrics
      const tradeStatsData = (tradeStats.data as any)?.data || {};
      const overview = tradeStatsData.overview || {};
      const profitMetrics = tradeStatsData.profitMetrics || {};

      setTradeMetrics({
        totalDecisions: overview.totalDecisions || 0,
        approvedCount: overview.approvedCount || 0,
        rejectedCount: overview.rejectedCount || 0,
        approvalRate: overview.approvalRate || 0,
        totalPotentialProfit: profitMetrics.totalPotentialProfit || 0,
        avgPotentialProfit: profitMetrics.avgPotentialProfit || 0,
      });

    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400">Comprehensive performance metrics and business intelligence</p>
      </div>

      {/* System Overview Cards */}
      {/* Removed: Total Revenue, Profit Margin, Total Transactions, Active Agents, Success Rate stat cards */}

      {/* AI Performance Section */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center mb-6">
          <SparklesIcon className="h-6 w-6 text-blue-500 mr-2" />
          <h2 className="text-xl font-bold text-white">AI Agent Performance</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">AI Opportunities</p>
            <p className="text-2xl font-bold text-white">
              {aiMetrics?.totalOpportunities || 0}
            </p>
            <p className="text-xs text-gray-500">Active trades identified</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Potential Profit</p>
            <p className="text-2xl font-bold text-green-400">
              ${(aiMetrics?.totalPotentialProfit || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">From all opportunities</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Avg Confidence</p>
            <p className="text-2xl font-bold text-blue-400">
              {((aiMetrics?.averageConfidence || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500">AI decision confidence</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">High Confidence</p>
            <p className="text-2xl font-bold text-purple-400">
              {aiMetrics?.highConfidenceOps || 0}
            </p>
            <p className="text-xs text-gray-500">≥80% confidence ops</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Products Analyzed</p>
            <p className="text-2xl font-bold text-yellow-400">
              {aiMetrics?.processedProducts || 0}
            </p>
            <p className="text-xs text-gray-500">By AI system</p>
          </div>
        </div>
      </div>

      {/* Trade Decision Tracking Section */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center mb-6">
          <CheckCircleIcon className="h-6 w-6 text-green-500 mr-2" />
          <h2 className="text-xl font-bold text-white">Trade Decisions</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Total Decisions</p>
            <p className="text-2xl font-bold text-white">
              {tradeMetrics?.totalDecisions || 0}
            </p>
            <p className="text-xs text-gray-500">All approved/rejected</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Approved</p>
            <p className="text-2xl font-bold text-green-400">
              {tradeMetrics?.approvedCount || 0}
            </p>
            <p className="text-xs text-gray-500">Executed trades</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Rejected</p>
            <p className="text-2xl font-bold text-red-400">
              {tradeMetrics?.rejectedCount || 0}
            </p>
            <p className="text-xs text-gray-500">Declined opportunities</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Approval Rate</p>
            <p className="text-2xl font-bold text-blue-400">
              {((tradeMetrics?.approvalRate || 0) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500">Success percentage</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Total Profit (Approved)</p>
            <p className="text-2xl font-bold text-green-400">
              ${(tradeMetrics?.totalPotentialProfit || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">From approved trades</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Avg Trade Value</p>
            <p className="text-2xl font-bold text-purple-400">
              ${(tradeMetrics?.avgPotentialProfit || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Per approved trade</p>
          </div>
        </div>
      </div>

      {/* Marketplace Activity Section */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center mb-6">
          <ChartBarIcon className="h-6 w-6 text-green-500 mr-2" />
          <h2 className="text-xl font-bold text-white">Marketplace Activity</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Active Bids</p>
            <p className="text-2xl font-bold text-white">
              {marketMetrics?.activeBids || 0}
            </p>
            <p className="text-xs text-gray-500">Currently in marketplace</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Total Matches</p>
            <p className="text-2xl font-bold text-green-400">
              {marketMetrics?.totalMatches || 0}
            </p>
            <p className="text-xs text-gray-500">Successful bid matches</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Total Bid Value</p>
            <p className="text-2xl font-bold text-blue-400">
              ${(marketMetrics?.totalBidValue || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Value of all active bids</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">Avg Bid Size</p>
            <p className="text-2xl font-bold text-purple-400">
              ${(marketMetrics?.avgBidSize || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Average value per bid</p>
          </div>
        </div>
      </div>

      {/* System Health & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trends */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Performance Trends</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Revenue Growth</span>
              <span className="text-green-400 font-medium">+24.5% this month</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">AI Accuracy</span>
              <span className="text-blue-400 font-medium">
                {((aiMetrics?.averageConfidence || 0) * 100).toFixed(1)}% avg confidence
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Transaction Volume</span>
              <span className="text-purple-400 font-medium">+18.2% vs last week</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Opportunity Hit Rate</span>
              <span className="text-yellow-400 font-medium">
                {aiMetrics?.totalOpportunities ? Math.round((aiMetrics.highConfidenceOps / aiMetrics.totalOpportunities) * 100) : 0}% high confidence
              </span>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">System Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-gray-300">AI Agent Service</span>
              </div>
              <span className="text-green-400 text-sm">Operational</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-gray-300">Marketplace API</span>
              </div>
              <span className="text-green-400 text-sm">Operational</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-gray-300">Database</span>
              </div>
              <span className="text-green-400 text-sm">Operational</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ClockIcon className="h-5 w-5 text-blue-500 mr-2" />
                <span className="text-gray-300">Analytics Processing</span>
              </div>
              <span className="text-blue-400 text-sm">Running</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
