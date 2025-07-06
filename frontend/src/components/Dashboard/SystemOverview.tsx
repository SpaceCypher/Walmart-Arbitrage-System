import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { analyticsAPI } from '../../services/api';

interface ChartData {
  time: string;
  revenue: number;
  profit: number;
  activeAgents: number;
}

interface SystemOverviewProps {
  storeId?: string; // If present, use as store-specific; otherwise, treat as admin/global
}

const getUserKey = (storeId?: string) => (storeId ? `store_${storeId}` : 'admin');

const LOCAL_STORAGE_KEY = `dashboard_chart_data_v1_${getUserKey()}`;
const LOCAL_STORAGE_TRADE_KEY = `dashboard_trade_volume_v1_${getUserKey()}`;
const LOCAL_STORAGE_TIMESTAMP_KEY = `dashboard_chart_data_timestamp_v1_${getUserKey()}`;
const DATA_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const SystemOverview: React.FC<SystemOverviewProps> = ({ storeId }) => {
  const userKey = getUserKey(storeId);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [tradeVolumeData, setTradeVolumeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChartData();
    // eslint-disable-next-line
  }, [storeId]);

  const generateRealisticChartData = () => {
    // Optionally, you can make the data slightly different per store
    const baseRevenue = storeId ? 6000 + (parseInt(storeId.replace(/\D/g, ''), 10) % 4000) : 12000;
    const baseProfit = storeId ? 1200 + (parseInt(storeId.replace(/\D/g, ''), 10) % 800) : 2500;
    const baseAgents = storeId ? 30 + (parseInt(storeId.replace(/\D/g, ''), 10) % 20) : 195;
    // Make revenue/profit in thousands per hour, so daily total is in the $1000s
    return Array.from({ length: 24 }, (_, i) => {
      const hour = new Date();
      hour.setHours(hour.getHours() - (23 - i));
      const isPeak = i >= 8 && i <= 20;
      // Each hour: revenue $200-600, profit $40-120 (so daily total is $5k-$15k revenue)
      const revenue = Math.round((isPeak ? 400 + Math.random() * 200 : 200 + Math.random() * 100));
      const profit = Math.round((isPeak ? 80 + Math.random() * 40 : 40 + Math.random() * 20));
      const activeAgents = baseAgents - Math.floor(Math.random() * 2) - (isPeak ? 0 : 2);
      return {
        time: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        revenue,
        profit,
        activeAgents,
      };
    });
  };

  const generateRealisticTradeVolume = () => {
    return Array.from({ length: 24 }, (_, i) => {
      const isPeak = i >= 8 && i <= 20;
      return {
        time: chartData[i]?.time || '',
        trades: storeId
          ? (isPeak ? Math.floor(Math.random() * 3) + 5 : Math.floor(Math.random() * 2) + 1)
          : (isPeak ? Math.floor(Math.random() * 8) + 15 : Math.floor(Math.random() * 3) + 3),
      };
    });
  };

  const loadChartData = async () => {
    try {
      setLoading(true);
      let loadedChartData = [];
      let loadedTradeData = [];
      const savedChart = localStorage.getItem(LOCAL_STORAGE_KEY);
      const savedTrade = localStorage.getItem(LOCAL_STORAGE_TRADE_KEY);
      const savedTimestamp = localStorage.getItem(LOCAL_STORAGE_TIMESTAMP_KEY);
      const now = Date.now();
      let shouldRegenerate = true;
      if (savedChart && savedTrade && savedTimestamp) {
        const lastGen = parseInt(savedTimestamp, 10);
        if (!isNaN(lastGen) && now - lastGen < DATA_REFRESH_INTERVAL_MS) {
          shouldRegenerate = false;
        }
      }
      if (shouldRegenerate) {
        loadedChartData = generateRealisticChartData();
        setChartData(loadedChartData);
        loadedTradeData = generateRealisticTradeVolume();
        // Save to localStorage
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loadedChartData));
        localStorage.setItem(LOCAL_STORAGE_TRADE_KEY, JSON.stringify(loadedTradeData));
        localStorage.setItem(LOCAL_STORAGE_TIMESTAMP_KEY, now.toString());
      } else {
        loadedChartData = JSON.parse(savedChart!);
        loadedTradeData = JSON.parse(savedTrade!);
      }
      setChartData(loadedChartData);
      setTradeVolumeData(loadedTradeData);
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="p-6 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">System Overview</h3>
        <p className="text-sm text-gray-400">Performance metrics over time</p>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-4">Revenue & Profit (24h)</h4>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', color: '#F3F4F6' }} />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="profit" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Trade Volume Chart */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-4">Trade Volume (24h)</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={tradeVolumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', color: '#F3F4F6' }} />
                <Bar dataKey="trades" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemOverview;
