import React, { useState, useEffect } from 'react';
import { SparklesIcon, HeartIcon, ExclamationTriangleIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import { aiAgentsAPI } from '../../services/api';

interface AIAgentStatus {
  total_products: number;
  system_health: string;
  last_updated: string;
  ai_agent_available: boolean;
}

interface AIAgentHealth {
  status: string;
  components: {
    database: string;
    redis: string;
    gemini_api: string;
    ai_agents: string;
  };
}

const AIInsightsDashboard: React.FC = () => {
  const [status, setStatus] = useState<AIAgentStatus | null>(null);
  const [health, setHealth] = useState<AIAgentHealth | null>(null);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAIData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadAIData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAIData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [statusResponse, healthResponse, opportunitiesResponse] = await Promise.all([
        aiAgentsAPI.getStatus(),
        aiAgentsAPI.getHealth(),
        aiAgentsAPI.getOpportunities(10),
      ]);

      setStatus(statusResponse.data?.data?.aiAgentSystem || statusResponse.data);
      setHealth(healthResponse.data?.data?.aiAgentHealth || healthResponse.data);
      setOpportunities(opportunitiesResponse.data?.data?.opportunities || []);
    } catch (error) {
      console.error('Error loading AI data:', error);
      setError('Failed to load AI agent data');
    } finally {
      setLoading(false);
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <HeartIcon className="h-5 w-5 text-green-500" />;
      case 'unhealthy':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <CpuChipIcon className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'unhealthy':
        return 'text-red-500';
      default:
        return 'text-yellow-500';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Insights</h1>
          <p className="text-gray-400">AI-powered predictions and market intelligence</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading AI agent data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Insights</h1>
          <p className="text-gray-400">AI-powered predictions and market intelligence</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-red-700 p-12 text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Error</h3>
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={loadAIData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">AI Insights</h1>
        <p className="text-gray-400">AI-powered predictions and market intelligence</p>
      </div>

      {/* AI System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center">
            <CpuChipIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">System Status</p>
              <p className={`text-lg font-semibold ${getHealthColor(health?.status || 'unknown')}`}>
                {health?.status?.toUpperCase() || 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center">
            <SparklesIcon className="h-8 w-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Products Monitored</p>
              <p className="text-lg font-semibold text-white">
                {status?.total_products || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center">
            {getHealthIcon(health?.components?.database || 'unknown')}
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Database</p>
              <p className={`text-lg font-semibold ${getHealthColor(health?.components?.database || 'unknown')}`}>
                {health?.components?.database?.toUpperCase() || 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center">
            {getHealthIcon(health?.components?.gemini_api || 'unknown')}
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Gemini AI</p>
              <p className={`text-lg font-semibold ${getHealthColor(health?.components?.gemini_api || 'unknown')}`}>
                {health?.components?.gemini_api?.toUpperCase() || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Opportunities */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Recent AI Opportunities</h3>
        {opportunities.length > 0 ? (
          <div className="space-y-3">
            {opportunities.map((opportunity, index) => (
              <div key={index} className="bg-gray-700 rounded-md p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white font-medium">{opportunity.opportunity?.type || opportunity.type || 'Market Opportunity'}</p>
                    <p className="text-gray-400 text-sm">{opportunity.opportunity?.reasoning || opportunity.reasoning || 'AI-identified opportunity'}</p>
                    <p className="text-gray-300 text-xs mt-1">
                      Product: {opportunity.product_id || 'Unknown'}
                    </p>
                    <p className="text-gray-300 text-xs">
                      {(opportunity.opportunity?.source_store || opportunity.source_store) || 'N/A'} → {(opportunity.opportunity?.target_store || opportunity.target_store) || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-medium">
                      ${(opportunity.opportunity?.potential_profit || opportunity.potential_profit || 0).toFixed(2)}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {(opportunity.opportunity?.confidence || opportunity.confidence) ? `${((opportunity.opportunity?.confidence || opportunity.confidence) * 100).toFixed(0)}% confidence` : ''}
                    </p>
                    <p className="text-yellow-400 text-sm">
                      {(opportunity.opportunity?.urgency || opportunity.urgency)?.toUpperCase() || 'MEDIUM'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <SparklesIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No opportunities identified yet</p>
            <p className="text-gray-500 text-sm">AI agents are analyzing market data...</p>
          </div>
        )}
      </div>

      {/* System Components Status */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">System Components</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {health?.components && Object.entries(health.components).map(([component, status]) => (
            <div key={component} className="flex items-center justify-between p-3 bg-gray-700 rounded-md">
              <span className="text-white capitalize">{component.replace('_', ' ')}</span>
              <div className="flex items-center">
                {getHealthIcon(status)}
                <span className={`ml-2 text-sm ${getHealthColor(status)}`}>
                  {status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Last Updated */}
      {status?.last_updated && (
        <div className="text-center text-gray-400 text-sm">
          Last updated: {new Date(status.last_updated).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default AIInsightsDashboard;
