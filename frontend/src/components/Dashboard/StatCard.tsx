import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'yellow' | 'red';
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-500',
    text: 'text-blue-400',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-500',
    text: 'text-green-400',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
  },
  purple: {
    bg: 'bg-purple-500',
    text: 'text-purple-400',
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-600',
  },
  yellow: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-400',
    iconBg: 'bg-yellow-100',
    iconText: 'text-yellow-600',
  },
  red: {
    bg: 'bg-red-500',
    text: 'text-red-400',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
  },
};

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color, 
  trend 
}) => {
  const colors = colorClasses[color];

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-400">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="mt-2 flex items-center">
              <span
                className={`text-sm font-medium ${
                  trend.isPositive ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-gray-400 ml-1">vs last period</span>
            </div>
          )}
        </div>
        
        <div className={`flex-shrink-0 p-3 rounded-lg ${colors.iconBg} bg-opacity-10`}>
          <Icon className={`h-6 w-6 ${colors.text}`} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
