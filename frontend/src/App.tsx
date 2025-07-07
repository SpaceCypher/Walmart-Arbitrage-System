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
import LoginPage from './components/Auth/LoginPage';
import webSocketService from './services/websocket';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Load auth from localStorage on mount
  const [auth, setAuth] = useState<{ role: 'admin' | 'store' | null, storeId?: string }>(() => {
    const stored = localStorage.getItem('auth');
    return stored ? JSON.parse(stored) : { role: null };
  });

  useEffect(() => {
    // Save auth to localStorage whenever it changes
    localStorage.setItem('auth', JSON.stringify(auth));
  }, [auth]);

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

  const handleLogin = (role: 'admin' | 'store', storeId?: string) => {
    setAuth({ role, storeId });
  };

  const handleLogout = () => {
    setAuth({ role: null });
    localStorage.removeItem('auth');
  };

  return (
    <Router>
      {/* If not authenticated, show only the login/landing page */}
      {!auth.role ? (
        <Routes>
          <Route path="/" element={<LoginPage onLogin={handleLogin} />} />
          {/* Redirect any other route to login */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <div className="flex h-screen bg-gray-900">
          {/* Sidebar */}
          <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <Header 
              onMenuClick={() => setSidebarOpen(!sidebarOpen)}
              isConnected={isConnected}
              onLogout={handleLogout}
              isAuthenticated={!!auth.role}
              auth={auth}
            />
            {/* Main content area */}
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-800">
              <div className="container mx-auto px-6 py-8">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/agents" element={<AgentDashboard />} />
                  <Route path="/marketplace" element={<MarketplaceDashboard userRole={auth.role as 'admin' | 'store'} storeId={auth.storeId} />} />
                  <Route path="/analytics" element={<AnalyticsDashboard />} />
                  <Route path="/ai-insights" element={<AIInsightsDashboard />} />
                  <Route
                    path="/trading"
                    element={<TradingDashboard userRole={auth.role} storeId={auth.storeId} />}
                  />
                  {/* Redirect any unknown route to dashboard */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </div>
            </main>
          </div>
        </div>
      )}
    </Router>
  );
}

export default App;
