import React, { useState } from 'react';

interface LoginPageProps {
  onLogin: (role: 'admin' | 'store', storeId?: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState('');

  const handleStoreLogin = () => {
    if (!storeId.trim()) {
      setError('Please enter a Store ID');
      return;
    }
    onLogin('store', storeId.trim());
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-gray-900 to-emerald-900">
      <div className="flex flex-col items-center w-full max-w-2xl px-4">
        <h1 className="text-5xl font-extrabold text-white mb-4 drop-shadow-lg text-center">AI Arbitrage System</h1>
        <p className="text-lg text-gray-300 mb-10 text-center max-w-xl">Maximize your profits with AI-powered trading. Log in as an admin to manage the network, or as a store to view and act on your personalized opportunities.</p>
        <div className="w-full flex flex-col items-center">
          <div className="bg-gray-800 p-10 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Sign In</h2>
            <button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold mb-4 transition-colors text-lg shadow"
              onClick={() => onLogin('admin')}
            >
              Login as Admin
            </button>
            <div className="flex items-center my-6">
              <div className="flex-grow border-t border-gray-600"></div>
              <span className="mx-2 text-gray-400 text-sm">or</span>
              <div className="flex-grow border-t border-gray-600"></div>
            </div>
            <input
              type="text"
              placeholder="Enter Store ID"
              value={storeId}
              onChange={e => setStoreId(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-md px-4 py-3 mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg"
              disabled={false}
            />
            {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
            <button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-md font-semibold text-lg shadow transition-colors"
              onClick={handleStoreLogin}
            >
              Login with Store ID
            </button>
          </div>
        </div>
        <div className="mt-10 text-gray-400 text-sm text-center max-w-lg">
          <p>AI Arbitrage System leverages advanced algorithms to identify the most profitable trades across multiple stores and platforms. Secure, fast, and always learning.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;