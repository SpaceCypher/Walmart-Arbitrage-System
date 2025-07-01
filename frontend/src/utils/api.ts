// API utilities for error handling and data fetching

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export const createApiResponse = <T>(): ApiResponse<T> => ({
  data: null,
  error: null,
  loading: true,
});

export const handleApiError = (error: any): string => {
  if (error.response) {
    // Server responded with error status
    return error.response.data?.message || `Server Error: ${error.response.status}`;
  } else if (error.request) {
    // Network error
    return 'Network Error: Unable to connect to server';
  } else {
    // Other error
    return error.message || 'An unexpected error occurred';
  }
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(2)}%`;
};

export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'active':
    case 'running':
    case 'online':
      return 'text-green-400';
    case 'inactive':
    case 'stopped':
    case 'offline':
      return 'text-red-400';
    case 'pending':
    case 'starting':
      return 'text-yellow-400';
    default:
      return 'text-gray-400';
  }
};

export const getStatusBadgeColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'active':
    case 'running':
    case 'online':
      return 'bg-green-100 text-green-800';
    case 'inactive':
    case 'stopped':
    case 'offline':
      return 'bg-red-100 text-red-800';
    case 'pending':
    case 'starting':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};
