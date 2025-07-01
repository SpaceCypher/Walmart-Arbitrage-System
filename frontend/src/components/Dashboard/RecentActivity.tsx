import React from 'react';
import {
  ClockIcon,
  CpuChipIcon,
  ShoppingCartIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface Activity {
  type: 'bid' | 'match' | 'agent' | 'system';
  message: string;
  timestamp: Date;
}

interface RecentActivityProps {
  activities: Activity[];
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'bid':
      return ShoppingCartIcon;
    case 'match':
      return ArrowPathIcon;
    case 'agent':
      return CpuChipIcon;
    default:
      return ClockIcon;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'bid':
      return 'text-blue-400';
    case 'match':
      return 'text-green-400';
    case 'agent':
      return 'text-purple-400';
    default:
      return 'text-gray-400';
  }
};

const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="p-6 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
        <p className="text-sm text-gray-400">Latest system events</p>
      </div>
      
      <div className="p-6">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <ClockIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.type);
              const colorClass = getActivityColor(activity.type);
              
              return (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 p-2 rounded-lg bg-gray-700`}>
                    <Icon className={`h-4 w-4 ${colorClass}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{activity.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentActivity;
