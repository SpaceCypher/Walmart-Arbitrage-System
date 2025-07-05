import React from 'react';
import {
  Bars3Icon,
  BellIcon,
  WifiIcon,
} from '@heroicons/react/24/outline';

interface HeaderProps {
  onMenuClick: () => void;
  isConnected: boolean;
  onLogout?: () => void;
  isAuthenticated?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, isConnected, onLogout, isAuthenticated }) => {
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
            <h2 className="text-lg font-semibold text-white">
              AI Inventory Arbitrage Network
            </h2>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
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

          {/* Notifications */}
          <button className="text-gray-400 hover:text-white relative">
            <BellIcon className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-600 rounded-full"></span>
          </button>

          {/* Current time */}
          <div className="text-sm text-gray-400">
            {new Date().toLocaleTimeString()}
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
