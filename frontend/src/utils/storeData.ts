// Enhanced store and product data for better trading card information

export const STORE_LOCATIONS = {
  'STORE-6342': {
    name: 'Downtown Electronics Hub',
    location: 'Downtown District',
    coordinates: { lat: 40.7589, lng: -73.9851 },
    type: 'flagship',
    capacity: 10000,
    specialties: ['electronics', 'appliances'],
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA'
    }
  },
  'STORE-4578': {
    name: 'North Side Warehouse',
    location: 'North Industrial Zone',
    coordinates: { lat: 40.7831, lng: -73.9712 },
    type: 'warehouse',
    capacity: 50000,
    specialties: ['bulk_storage', 'distribution'],
    address: {
      street: '456 North Ave',
      city: 'New York',
      state: 'NY',
      zipCode: '10024',
      country: 'USA'
    }
  },
  'STORE-8943': {
    name: 'Central Distribution Center',
    location: 'Central Business District',
    coordinates: { lat: 40.7505, lng: -73.9934 },
    type: 'distribution',
    capacity: 75000,
    specialties: ['logistics', 'bulk_distribution'],
    address: {
      street: '789 Central Blvd',
      city: 'New York',
      state: 'NY',
      zipCode: '10018',
      country: 'USA'
    }
  },
  'STORE-2156': {
    name: 'West Coast Branch',
    location: 'West Side Plaza',
    coordinates: { lat: 40.7648, lng: -74.0020 },
    type: 'retail',
    capacity: 8000,
    specialties: ['retail', 'customer_service'],
    address: {
      street: '321 West St',
      city: 'New York',
      state: 'NY',
      zipCode: '10014',
      country: 'USA'
    }
  },
  'STORE-7829': {
    name: 'East Side Outlet',
    location: 'East Side Mall',
    coordinates: { lat: 40.7282, lng: -73.9942 },
    type: 'outlet',
    capacity: 12000,
    specialties: ['discounted_goods', 'clearance'],
    address: {
      street: '654 East Ave',
      city: 'New York',
      state: 'NY',
      zipCode: '10003',
      country: 'USA'
    }
  }
};

export const PRODUCT_CATALOG = {
  'PRD-11193': {
    name: 'Sony Tasty Frozen Chips',
    category: 'Food & Beverages',
    brand: 'Sony',
    weight: 2.5, // kg per unit
    dimensions: { length: 30, width: 20, height: 15 }, // cm
    fragile: false,
    temperature_controlled: true,
    value_per_unit: 298.68
  },
  'PRD-11194': {
    name: 'Premium Electronics Bundle',
    category: 'Electronics',
    brand: 'TechCorp',
    weight: 5.2,
    dimensions: { length: 50, width: 35, height: 25 },
    fragile: true,
    temperature_controlled: false,
    value_per_unit: 1250.00
  },
  'PRD-11195': {
    name: 'Smart Home Device Set',
    category: 'Smart Home',
    brand: 'HomeAI',
    weight: 3.1,
    dimensions: { length: 40, width: 30, height: 20 },
    fragile: true,
    temperature_controlled: false,
    value_per_unit: 899.99
  }
};

// Calculate actual distance between two stores using their coordinates
export function calculateRealDistance(sourceStoreId: string, targetStoreId: string): number {
  const source = STORE_LOCATIONS[sourceStoreId as keyof typeof STORE_LOCATIONS];
  const target = STORE_LOCATIONS[targetStoreId as keyof typeof STORE_LOCATIONS];
  
  if (!source || !target) {
    // Fallback calculation if stores not in our database
    const sourceNum = parseInt(sourceStoreId.split('-')[1] || '0');
    const targetNum = parseInt(targetStoreId.split('-')[1] || '0');
    const rawDistance = Math.abs(sourceNum - targetNum) / 100;
    return Math.max(5, Math.min(500, rawDistance * 50));
  }

  // Haversine formula for distance calculation
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(target.coordinates.lat - source.coordinates.lat);
  const dLng = toRadians(target.coordinates.lng - source.coordinates.lng);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRadians(source.coordinates.lat)) * Math.cos(toRadians(target.coordinates.lat)) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Calculate transport cost based on product type, quantity, and distance
export function calculateEnhancedTransportCost(
  productId: string, 
  quantity: number, 
  distance: number
): { totalCost: number, breakdown: any } {
  const product = PRODUCT_CATALOG[productId as keyof typeof PRODUCT_CATALOG];
  
  if (!product) {
    // Fallback calculation
    const baseCostPerKm = 2.5;
    const costPerUnit = 0.5;
    return {
      totalCost: (distance * baseCostPerKm) + (quantity * costPerUnit),
      breakdown: {
        distanceCost: distance * baseCostPerKm,
        handlingCost: quantity * costPerUnit,
        specialHandling: 0
      }
    };
  }

  // Base costs
  const fuelCostPerKm = 1.2;
  const driverCostPerKm = 0.8;
  const vehicleCostPerKm = 0.5;
  
  // Product-specific costs
  const weightCostPerKg = 0.1;
  const volumeCostPerCubicM = 5.0;
  const fragileCost = product.fragile ? 15 : 0;
  const temperatureCost = product.temperature_controlled ? 25 : 0;
  
  // Calculate volume in cubic meters
  const volumePerUnit = (product.dimensions.length * product.dimensions.width * product.dimensions.height) / 1000000;
  const totalVolume = volumePerUnit * quantity;
  const totalWeight = product.weight * quantity;
  
  const breakdown = {
    distanceCost: distance * (fuelCostPerKm + driverCostPerKm + vehicleCostPerKm),
    weightCost: totalWeight * weightCostPerKg,
    volumeCost: totalVolume * volumeCostPerCubicM,
    specialHandling: fragileCost + temperatureCost,
    baseHandling: quantity * 0.3
  };
  
  const totalCost = Object.values(breakdown).reduce((sum, cost) => sum + cost, 0);
  
  return {
    totalCost: Math.round(totalCost * 100) / 100,
    breakdown
  };
}
