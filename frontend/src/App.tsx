import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './components/Dashboard/Dashboard';
import AgentDashboard from './components/Agents/AgentDashboard';
import MarketplaceDashboard from './components/Marketplace/MarketplaceDashboard';
import AnalyticsDashboard from './components/Analytics/AnalyticsDashboard';
import AIInsightsDashboard from './components/AIInsights/AIInsightsDashboard';
import TradingDashboard from './components/Trading/TradingDashboard';
import webSocketService from './services/websocket';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Subscribe to WebSocket events
    webSocketService.subscribe({
      onConnect: () => {
        setIsConnected(true);
        console.log('Connected to WebSocket');
      },
      onDisconnect: () => {
        setIsConnected(false);
        console.log('Disconnected from WebSocket');
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      },
    });

    // Cleanup on unmount
    return () => {
      webSocketService.unsubscribe();
    };
  }, []);

  return (
    <Router>
      <div className="flex h-screen bg-gray-900">
        {/* Sidebar */}
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header 
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            isConnected={isConnected}
          />
          
          {/* Main content area */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-800">
            <div className="container mx-auto px-6 py-8">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/agents" element={<AgentDashboard />} />
                <Route path="/marketplace" element={<MarketplaceDashboard />} />
                <Route path="/analytics" element={<AnalyticsDashboard />} />
                <Route path="/ai-insights" element={<AIInsightsDashboard />} />
                <Route path="/trading" element={<TradingDashboard />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
