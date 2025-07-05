import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentProductsAPI } from '../../services/api';
import { AgentProduct } from '../../types/api';
import AgentFilters from './AgentFilters';
import LoadingSpinner from '../Common/LoadingSpinner';
import ErrorMessage from '../Common/ErrorMessage';
import { handleApiError } from '../../utils/api';
import webSocketService from '../../services/websocket';
import { SparklesIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await agentProductsAPI.getAll();
      // Extract agents from nested response structure
      const agents = (response.data as any)?.data?.products || (response.data as any) || [];
      setAgents(agents);
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      console.error('Error loading agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
    
    // Subscribe to agent updates
    webSocketService.subscribe({
      onAgentUpdate: (data) => {
        console.log('Agent update received:', data);
        loadAgents(); // Refresh agents list
      },
    });

    return () => {
      webSocketService.unsubscribe();
    };
  }, []);

  // Filter agents inline
  const filteredAgents = agents.filter(agent => {
    if (filter === 'all') return true;
    return agent.agentStatus?.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage 
        message={error}
        onRetry={loadAgents}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Migration Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 border border-blue-500 rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-white bg-opacity-20 p-3 rounded-full">
              <SparklesIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">🎉 New AI Trading System Available!</h3>
              <p className="text-blue-100 mt-1">
                Experience our upgraded AI agents with real-time analysis and profitable trading opportunities.
                The new system uses advanced Gemini AI for better decision-making.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/trading')}
            className="flex items-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
          >
            Go to Trading
            <ArrowRightIcon className="h-5 w-5 ml-2" />
          </button>
        </div>
      </div>

      {/* Legacy System Notice */}
      <div className="bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-yellow-400 text-sm font-medium">
            ⚠️ Legacy System: This is the old AI agent interface. For the latest features and active trading, please use the new Trading system above.
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        
        <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <span className="text-lg mr-2">+</span>
          New Agent
        </button>
      </div>

      <AgentFilters 
        currentFilter={filter} 
        onFilterChange={setFilter}
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400">Total Agents</div>
          <div className="text-2xl font-bold text-white">{agents.length}</div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400">Active</div>
          <div className="text-2xl font-bold text-green-400">
            {agents.filter(a => a.agentStatus?.status === 'active').length}
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400">Paused</div>
          <div className="text-2xl font-bold text-yellow-400">
            {agents.filter(a => a.agentStatus?.status === 'paused').length}
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400">Total Profit</div>
          <div className="text-2xl font-bold text-blue-400">
            ${agents.reduce((sum, a) => sum + (a.agentStatus?.performanceMetrics?.totalProfitGenerated || 0), 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Agents Grid */}

      {filteredAgents.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">No agents found</div>
          <div className="text-gray-500 text-sm mt-2">
            {filter === 'all' ? 'Create your first AI agent to get started' : `No agents with status: ${filter}`}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;
