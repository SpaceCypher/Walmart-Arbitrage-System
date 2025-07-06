import React, { useState, useEffect } from 'react';
import { agentProductsAPI, marketplaceAPI, analyticsAPI, aiAgentsAPI } from '../../services/api';
import webSocketService from '../../services/websocket';
import StatCard from './StatCard';
import RecentActivity from './RecentActivity';
import QuickActions from './QuickActions';
import SystemOverview from './SystemOverview';
import {
  CpuChipIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface DashboardStats {
  totalAgents: number;
  activeAgents: number;
  totalBids: number;
  totalMatches: number;
  totalRevenue: number;
  profitMargin: number;
  aiAgentHealth: string;
  aiProductsMonitored: number;
}

const Dashboard: React.FC = () => {
  // Get storeId from localStorage auth (same as App.tsx/Header.tsx)
  const auth = (() => {
    const stored = localStorage.getItem('auth');
    return stored ? JSON.parse(stored) : { role: null };
  })();
  const storeId = auth.role === 'store' && auth.storeId ? auth.storeId : undefined;

  const [stats, setStats] = useState<DashboardStats>({
    totalAgents: 0,
    activeAgents: 0,
    totalBids: 0,
    totalMatches: 0,
    totalRevenue: 0,
    profitMargin: 0,
    aiAgentHealth: 'unknown',
    aiProductsMonitored: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [aiOpportunities, setAiOpportunities] = useState<any[]>([]);
  const [allAiOpportunities, setAllAiOpportunities] = useState<any[]>([]); // Store all for admin

  useEffect(() => {
    loadDashboardData();
    // Subscribe to real-time updates
    webSocketService.subscribe({
      onAgentUpdate: (data) => {
        console.log('Agent update received:', data);
        loadDashboardData(); // Refresh stats
      },
      onMarketUpdate: (data) => {
        console.log('Market update received:', data);
        loadDashboardData(); // Refresh stats
      },
      onBidPlaced: (data) => {
        console.log('New bid placed:', data);
        setRecentActivity(prev => [
          { type: 'bid', message: `New bid placed: ${data.productId}`, timestamp: new Date() },
          ...prev.slice(0, 9)
        ]);
      },
      onMatchFound: (data) => {
        console.log('Match found:', data);
        setRecentActivity(prev => [
          { type: 'match', message: `Match found: ${data.buyProductId} ↔ ${data.sellProductId}`, timestamp: new Date() },
          ...prev.slice(0, 9)
        ]);
      },
    });
    return () => {
      webSocketService.unsubscribe();
    };
  }, []);

  const filterOpportunitiesForStore = (opps: any[], auth: any) => {
    if (auth.role === 'store' && auth.storeId) {
      const storeIdLower = String(auth.storeId).toLowerCase();
      return opps.filter((opp: any) => {
        const src = String(opp.opportunity?.source_store || opp.source_store || '').toLowerCase();
        const tgt = String(opp.opportunity?.target_store || opp.target_store || '').toLowerCase();
        return src.includes(storeIdLower) || tgt.includes(storeIdLower);
      });
    }
    return opps;
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [agentsResponse, bidsResponse, matchesResponse, overviewResponse, aiHealthResponse, aiStatusResponse, aiOpportunitiesResponse] = await Promise.all([
        agentProductsAPI.getAll(),
        marketplaceAPI.getBids(),
        marketplaceAPI.getMatches(),
        analyticsAPI.getOverview(),
        aiAgentsAPI.getHealth().catch(() => ({ data: { data: { aiAgentHealth: { status: 'unavailable' } } } })),
        aiAgentsAPI.getStatus().catch(() => ({ data: { data: { aiAgentSystem: { total_products: 0 } } } })),
        aiAgentsAPI.getOpportunities(20).catch(() => ({ data: { data: { opportunities: [] } } })), // fetch more for admin
      ]);
      // Extract agents from nested response structure
      const agents = (agentsResponse.data as any)?.data?.products || (agentsResponse.data as any) || [];
      const bids = (bidsResponse.data as any)?.data?.bids || (bidsResponse.data as any) || [];
      const matches = (matchesResponse.data as any)?.data?.matches || (matchesResponse.data as any) || [];
      const overview = (overviewResponse.data as any)?.data || (overviewResponse.data as any) || {};
      const aiHealth = (aiHealthResponse.data as any)?.data?.aiAgentHealth || (aiHealthResponse.data as any) || {};
      const aiStatus = (aiStatusResponse.data as any)?.data?.aiAgentSystem || (aiStatusResponse.data as any) || {};
      const opportunities = (aiOpportunitiesResponse.data as any)?.data?.opportunities || (aiOpportunitiesResponse.data as any) || [];
      setAllAiOpportunities(opportunities); // Save all for admin
      const filteredOpportunities = filterOpportunitiesForStore(opportunities, auth);
      setAiOpportunities(filteredOpportunities);

      // Calculate possible revenue from the same set as the alert (top 5 for store, all for admin)
      let possibleRevenue = 0;
      if (!(overview.totalRevenue > 0)) {
        if (auth.role === 'admin') {
          possibleRevenue = (allAiOpportunities as any[]).reduce((sum: number, opp: any) => sum + (opp.opportunity?.potential_profit || opp.potential_profit || 0), 0);
        } else {
          possibleRevenue = (aiOpportunities as any[]).reduce((sum: number, opp: any) => sum + (opp.opportunity?.potential_profit || opp.potential_profit || 0), 0);
        }
      }
      setStats({
        totalAgents: agents.length,
        activeAgents: agents.filter((a: any) => a.agentStatus?.status === 'active').length,
        totalBids: bids.length,
        totalMatches: matches.length,
        totalRevenue: overview.totalRevenue > 0 ? overview.totalRevenue : possibleRevenue,
        profitMargin: overview.profitMargin || 0,
        aiAgentHealth: aiHealth.status || 'unavailable',
        aiProductsMonitored: aiStatus.total_products || 0,
      });

      // Set initial recent activity
      const activities = [
        ...bids.slice(0, 3).map((bid: any) => ({
          type: 'bid',
          message: `Bid placed: ${bid.productId || 'Unknown Product'}`,
          timestamp: new Date(bid.timestamp || Date.now()),
        })),
        ...matches.slice(0, 3).map((match: any) => ({
          type: 'match',
          message: `Match: ${match.buyProductId || 'Buy'} ↔ ${match.sellProductId || 'Sell'}`,
          timestamp: new Date(match.timestamp || Date.now()),
        })),
      ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);

      setRecentActivity(activities);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Set fallback data on error
      setStats({
        totalAgents: 0,
        activeAgents: 0,
        totalBids: 0,
        totalMatches: 0,
        totalRevenue: 0,
        profitMargin: 0,
        aiAgentHealth: 'unavailable',
        aiProductsMonitored: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-2 md:px-0">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400">Overview of your AI Arbitrage Network</p>
      </div>

      {/* AI Trading Alert */}
      {(auth.role === 'admin' ? allAiOpportunities.length > 0 : aiOpportunities.length > 0) && (
        <div className="bg-gradient-to-r from-emerald-600 to-blue-600 rounded-xl p-6 border border-emerald-500 shadow-lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <SparklesIcon className="h-8 w-8 text-white" />
              <div>
                <h3 className="text-xl font-bold text-white">🚀 AI Trading Opportunities Available!</h3>
                <p className="text-emerald-100">
                  {auth.role === 'admin'
                    ? `${allAiOpportunities.length} profitable trades identified with potential profit of $${allAiOpportunities.reduce((sum, opp) => sum + (opp.opportunity?.potential_profit || opp.potential_profit || 0), 0).toLocaleString()}`
                    : `${aiOpportunities.length} profitable trades identified with potential profit of $${aiOpportunities.reduce((sum, opp) => sum + (opp.opportunity?.potential_profit || opp.potential_profit || 0), 0).toLocaleString()}`
                  }
                </p>
              </div>
            </div>
            <a 
              href="/trading" 
              className="bg-white text-emerald-600 hover:text-emerald-700 px-6 py-3 rounded-lg font-semibold transition-colors shadow"
            >
              Review & Approve Trades →
            </a>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Total Agents"
          value={stats.totalAgents}
          subtitle={`${stats.activeAgents} active`}
          icon={CpuChipIcon}
          color="blue"
        />
        <StatCard
          title="Active Bids"
          value={stats.totalBids}
          subtitle="In marketplace"
          icon={ShoppingCartIcon}
          color="green"
        />
        <StatCard
          title="Total Matches"
          value={stats.totalMatches}
          subtitle="All time"
          icon={ChartBarIcon}
          color="purple"
        />
        <StatCard
          title="Possible Revenue"
          value={`$${(auth.role === 'admin'
            ? allAiOpportunities.reduce((sum: number, opp: any) => sum + (opp.opportunity?.potential_profit || opp.potential_profit || 0), 0)
            : aiOpportunities.reduce((sum: number, opp: any) => sum + (opp.opportunity?.potential_profit || opp.potential_profit || 0), 0)
          ).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={CurrencyDollarIcon}
          color="yellow"
        />
        <StatCard
          title="AI Agents"
          value={stats.aiAgentHealth.toUpperCase()}
          subtitle={`${stats.aiProductsMonitored} products`}
          icon={SparklesIcon}
          color={stats.aiAgentHealth === 'healthy' ? 'green' : stats.aiAgentHealth === 'unhealthy' ? 'red' : 'yellow'}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Overview */}
        <div className="lg:col-span-2">
          <SystemOverview storeId={storeId} />
        </div>

        {/* Recent Activity */}
        <div>
          <RecentActivity activities={recentActivity} />
        </div>
      </div>

      {/* AI Opportunities Section */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h3 className="text-xl font-semibold text-white">Latest AI Opportunities</h3>
          <a 
            href="/ai-insights" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm shadow"
          >
            View All AI Insights
          </a>
        </div>
        {aiOpportunities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aiOpportunities.map((opportunity, index) => (
              <div key={index} className="bg-gray-700 rounded-lg p-6 flex flex-col justify-between min-h-[170px] shadow">
                <div className="flex justify-between items-start mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {opportunity.opportunity?.type || opportunity.type || 'Opportunity'}
                  </span>
                  <span className="text-sm text-gray-400">
                    {opportunity.opportunity?.urgency || opportunity.urgency || 'medium'}
                  </span>
                </div>
                <p className="text-white font-semibold text-lg mb-1">
                  +${(opportunity.opportunity?.potential_profit || opportunity.potential_profit || 0).toLocaleString()} profit
                </p>
                <p className="text-gray-400 text-sm mb-2">
                  {(opportunity.opportunity?.source_store || opportunity.source_store) || 'N/A'} → {(opportunity.opportunity?.target_store || opportunity.target_store) || 'N/A'}
                </p>
                <p className="text-gray-400 text-xs">
                  {(opportunity.opportunity?.confidence || opportunity.confidence) ? `${((opportunity.opportunity?.confidence || opportunity.confidence) * 100).toFixed(0)}% confidence` : ''}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <SparklesIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No AI opportunities found yet</p>
            <p className="text-gray-500 text-sm">AI agents are analyzing market data...</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <QuickActions />
    </div>
  );
};

export default Dashboard;
