import React from 'react';

interface AgentFiltersProps {
  currentFilter: string;
  onFilterChange: (filter: string) => void;
}

const filterOptions = [
  { value: 'all', label: 'All Agents', count: 0 },
  { value: 'active', label: 'Active', count: 0 },
  { value: 'paused', label: 'Paused', count: 0 },
  { value: 'initializing', label: 'Initializing', count: 0 },
  { value: 'error', label: 'Error', count: 0 },
];

const AgentFilters: React.FC<AgentFiltersProps> = ({ currentFilter, onFilterChange }) => {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onFilterChange(option.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentFilter === option.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Filter agents by status to manage your AI workforce
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          <div className="text-gray-400">
            Sort by:
          </div>
          <select className="bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600">
            <option value="name">Name</option>
            <option value="status">Status</option>
            <option value="profit">Profit</option>
            <option value="lastUpdated">Last Updated</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default AgentFilters;
