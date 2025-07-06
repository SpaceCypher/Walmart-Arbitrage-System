import React, { useState, useEffect } from 'react';
import {
  Bars3Icon,
  WifiIcon,
  BellIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { aiAgentsAPI } from '../../services/api';

interface HeaderProps {
  onMenuClick: () => void;
  isConnected: boolean;
  onLogout?: () => void;
  isAuthenticated?: boolean;
  auth: { role: 'admin' | 'store' | null, storeId?: string };
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, isConnected, onLogout, isAuthenticated, auth }) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [topTrades, setTopTrades] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const fetchOpportunities = async () => {
      let res;
      if (auth.role === 'store' && auth.storeId) {
        res = await aiAgentsAPI.getOpportunities(20, auth.storeId);
      } else {
        res = await aiAgentsAPI.getOpportunities(20);
      }
      let all = res.data?.data?.opportunities || [];
      if (auth.role === 'store' && auth.storeId) {
        const storeIdLower = String(auth.storeId).toLowerCase();
        all = all.filter((trade: any) => {
          const src = String(trade.opportunity.source_store || '').toLowerCase();
          const tgt = String(trade.opportunity.target_store || '').toLowerCase();
          return src.includes(storeIdLower) || tgt.includes(storeIdLower);
        });
      } else if (auth.role === 'admin') {
        // Only urgent (critical/high) trades, sorted by profit, top 10
        all = all.filter((trade: any) => {
          const urgency = (trade.opportunity.urgency || '').toLowerCase();
          return urgency === 'critical' || urgency === 'high';
        }).sort((a: any, b: any) => (b.opportunity.potential_profit || 0) - (a.opportunity.potential_profit || 0)).slice(0, 10);
      }
      const sorted = [...all].sort((a, b) => {
        const urgencyOrder: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
        const ua = urgencyOrder[(a.opportunity.urgency as string) || 'low'] || 0;
        const ub = urgencyOrder[(b.opportunity.urgency as string) || 'low'] || 0;
        if (ua !== ub) return ub - ua;
        return (b.opportunity.potential_profit || 0) - (a.opportunity.potential_profit || 0);
      });
      if (isMounted) setTopTrades(sorted.slice(0, auth.role === 'admin' ? 10 : 5)); // Only top 5
    };
    fetchOpportunities();
    return () => { isMounted = false; };
  }, [auth]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTradeClick = (trade: any, idx: number) => {
    setNotifOpen(false);
    navigate(`/trading?tradeId=${encodeURIComponent(trade.id)}`);
  };

  return (
    <header className="bg-gray-900 shadow-lg border-b border-gray-700">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left side */}
        <div className="flex items-center">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-gray-400 hover:text-white focus:outline-none focus:text-white"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <div className="hidden lg:block ml-4">
          </div>
        </div>

        {/* Center: Welcome message */}
        <div className="flex-1 flex justify-center">
          <span className="text-lg font-semibold text-gray-200">
            {auth.role === 'admin'
              ? 'Welcome, Admin! Manage your AI Arbitrage System.'
              : auth.role === 'store' && auth.storeId
                ? `Welcome, Store ${auth.storeId} ! Here are your latest opportunities.`
                : 'Welcome to the AI Arbitrage System!'}
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Show current user role/store */}
          <div className="flex items-center px-3 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-gray-300 font-semibold">
            {auth.role === 'admin' ? 'Admin' : auth.role === 'store' && auth.storeId ? `Store: ${auth.storeId}` : 'Not logged in'}
          </div>
          {/* Connection status */}
          <div className="flex items-center space-x-2">
            <WifiIcon 
              className={`h-5 w-5 ${
                isConnected ? 'text-green-400' : 'text-red-400'
              }`} 
            />
            <span className={`text-sm ${
              isConnected ? 'text-green-400' : 'text-red-400'
            }`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Notification Bell (only if logged in) */}
          {isAuthenticated && (
            <div className="relative">
              <button
                className="text-gray-400 hover:text-white focus:outline-none relative"
                onClick={() => setNotifOpen((v) => !v)}
              >
                <BellIcon className="h-6 w-6" />
                {topTrades.length > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                    {topTrades.length}+
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                  <div className="p-3 border-b border-gray-700 text-sm font-semibold text-white">Top Trades</div>
                  <ul className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
                    {topTrades.length === 0 && (
                      <li className="p-4 text-gray-400 text-center">No urgent or high-profit trades</li>
                    )}
                    {topTrades.map((trade, idx) => (
                      <li
                        key={trade.id}
                        className={`flex items-start gap-2 p-3 transition hover:bg-gray-700 cursor-pointer`}
                        onClick={() => handleTradeClick(trade, idx)}
                      >
                        <div className="flex flex-col items-center justify-center mt-1">
                          {['critical', 'high'].includes(trade.opportunity.urgency) ? (
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                          ) : (
                            <CurrencyDollarIcon className="h-5 w-5 text-green-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">
                              {trade.product_id}
                            </span>
                            <span className="text-xs text-gray-400">{trade.opportunity.type}</span>
                            <span className="ml-auto text-xs text-gray-400">
                              {trade.opportunity.urgency.charAt(0).toUpperCase() + trade.opportunity.urgency.slice(1)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-300 mt-1">
                            {trade.opportunity.source_store} → {trade.opportunity.target_store}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Profit: <span className="text-green-400 font-semibold">${trade.opportunity.potential_profit?.toLocaleString()}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Current time */}
          <div className="text-sm text-gray-400">
            {currentTime.toLocaleTimeString()}
          </div>

          {/* Logout button */}
          {isAuthenticated && onLogout && (
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-semibold"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
