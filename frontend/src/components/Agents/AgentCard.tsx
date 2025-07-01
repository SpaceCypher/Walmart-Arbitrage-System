import React from 'react';
import { AgentProduct } from '../../types/api';
import { agentProductsAPI } from '../../services/api';
import {
  PlayIcon,
  PauseIcon,
  CpuChipIcon,
  ChartBarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface AgentCardProps {
  agent: AgentProduct;
  onRefresh?: () => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'text-green-400 bg-green-400/10';
    case 'paused':
      return 'text-yellow-400 bg-yellow-400/10';
    case 'error':
      return 'text-red-400 bg-red-400/10';
    case 'initializing':
      return 'text-blue-400 bg-blue-400/10';
    default:
      return 'text-gray-400 bg-gray-400/10';
  }
};

const AgentCard: React.FC<AgentCardProps> = ({ agent, onRefresh }) => {
  const statusColor = getStatusColor(agent.agentStatus.status);
  const handleAgentAction = async (action: 'start' | 'stop') => {
    try {
      if (action === 'start') {
        await agentProductsAPI.start(agent.productId);
      } else {
        await agentProductsAPI.stop(agent.productId);
      }
      onRefresh?.(); // Refresh the parent component
    } catch (error) {
      console.error(`Error ${action}ing agent:`, error);
    }
  };

  const handleStart = () => handleAgentAction('start');
  const handleStop = () => handleAgentAction('stop');
  
  const isActive = agent.agentStatus.status === 'active';

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
          <p className="text-sm text-gray-400">{agent.category} • {agent.brand}</p>
        </div>
        
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
          {agent.agentStatus.status}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Profit Generated</span>
          <span className="text-sm font-medium text-green-400">
            ${agent.agentStatus.performanceMetrics.totalProfitGenerated.toFixed(2)}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Success Rate</span>
          <span className="text-sm font-medium text-white">
            {(agent.agentStatus.performanceMetrics.transferSuccessRate * 100).toFixed(1)}%
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Active Actions</span>
          <span className="text-sm font-medium text-white">
            {agent.agentStatus.activeActions}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Strategy</span>
          <span className="text-sm font-medium text-blue-400 truncate ml-2">
            {agent.agentStatus.currentStrategy}
          </span>
        </div>
      </div>

      {/* Current Decision */}
      {agent.currentDecision && (
        <div className="bg-gray-700 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400">CURRENT DECISION</span>
            <span className="text-xs text-gray-400">
              {agent.currentDecision.confidence}% confidence
            </span>
          </div>
          <p className="text-sm text-white">{agent.currentDecision.type}</p>
          <p className="text-xs text-gray-400 mt-1">{agent.currentDecision.reasoning}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-2">
        <button
          onClick={isActive ? handleStop : handleStart}
          className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isActive ? (
            <>
              <PauseIcon className="h-4 w-4 mr-2" />
              Stop
            </>
          ) : (
            <>
              <PlayIcon className="h-4 w-4 mr-2" />
              Start
            </>
          )}
        </button>
        
        <button className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
          <ChartBarIcon className="h-4 w-4" />
        </button>
        
        <button className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
          <CpuChipIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Last Updated */}
      <div className="mt-3 flex items-center text-xs text-gray-500">
        <ClockIcon className="h-3 w-3 mr-1" />
        Updated {new Date(agent.timestamps.updatedAt).toLocaleString()}
      </div>
    </div>
  );
};

export default AgentCard;
