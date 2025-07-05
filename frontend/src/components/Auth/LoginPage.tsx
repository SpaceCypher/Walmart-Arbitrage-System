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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Login</h1>
        <button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold mb-4"
          onClick={() => onLogin('admin')}
        >
          Login as Admin
        </button>
        <div className="flex items-center my-4">
          <div className="flex-grow border-t border-gray-600"></div>
          <span className="mx-2 text-gray-400 text-sm">or</span>
          <div className="flex-grow border-t border-gray-600"></div>
        </div>
        <input
          type="text"
          placeholder="Enter Store ID"
          value={storeId}
          onChange={e => setStoreId(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-md px-4 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={false}
        />
        {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
        <button
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-md font-semibold"
          onClick={handleStoreLogin}
        >
          Login with Store ID
        </button>
      </div>
    </div>
  );
};

export default LoginPage;