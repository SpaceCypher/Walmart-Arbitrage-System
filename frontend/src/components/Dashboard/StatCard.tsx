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
    <div className="bg-gray-800 rounded-xl min-h-[130px] p-4 border border-gray-700 hover:border-gray-600 transition-colors shadow flex flex-col items-center justify-between text-center">
      <div className="flex flex-col items-center mb-2">
        <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${colors.iconBg} bg-opacity-20 mb-2`}>
          <Icon className={`h-6 w-6 ${colors.text}`} />
        </div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
          {title}
        </p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-3xl font-extrabold text-white leading-tight">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-400">
            {subtitle}
          </p>
        )}
        {trend && (
          <div className="mt-1 flex items-center">
            <span
              className={`text-xs font-medium ${
                trend.isPositive ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-gray-400 ml-1">vs last period</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
