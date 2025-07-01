import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  PlayIcon,
  ChartBarIcon,
  CogIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';

const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    {
      title: 'Review AI Trades',
      description: 'Approve profitable opportunities',
      icon: ArrowsRightLeftIcon,
      action: () => navigate('/trading'),
      color: 'bg-emerald-600 hover:bg-emerald-700',
    },
    {
      title: 'Start All Agents',
      description: 'Activate all idle AI agents',
      icon: PlayIcon,
      action: () => {
        // TODO: Implement start all agents functionality
        console.log('Starting all agents...');
      },
      color: 'bg-green-600 hover:bg-green-700',
    },
    {
      title: 'View Analytics',
      description: 'Check performance metrics',
      icon: ChartBarIcon,
      action: () => navigate('/analytics'),
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      title: 'Marketplace',
      description: 'Monitor active bids & matches',
      icon: PlusIcon,
      action: () => navigate('/marketplace'),
      color: 'bg-purple-600 hover:bg-purple-700',
    },
  ];

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="p-6 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
        <p className="text-sm text-gray-400">Common tasks and shortcuts</p>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              className={`
                p-4 rounded-lg text-left transition-colors duration-200
                ${action.color}
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500
              `}
            >
              <div className="flex items-center justify-between mb-3">
                <action.icon className="h-6 w-6 text-white" />
              </div>
              
              <h4 className="text-sm font-semibold text-white mb-1">
                {action.title}
              </h4>
              
              <p className="text-xs text-gray-200 opacity-80">
                {action.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
