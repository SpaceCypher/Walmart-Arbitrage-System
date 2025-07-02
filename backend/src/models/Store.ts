import mongoose, { Schema, Document } from 'mongoose';

export interface IStore extends Document {
  storeId: string;
  name: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  capacity: number;
  operatingHours: {
    monday: { open: string; close: string; };
    tuesday: { open: string; close: string; };
    wednesday: { open: string; close: string; };
    thursday: { open: string; close: string; };
    friday: { open: string; close: string; };
    saturday: { open: string; close: string; };
    sunday: { open: string; close: string; };
  };
  demographics: {
    population: number;
    medianIncome: number;
    ageGroups: {
      '18-24': number;
      '25-34': number;
      '35-44': number;
      '45-54': number;
      '55-64': number;
      '65+': number;
    };
  };
  seasonalPatterns: Array<{
    season: string;
    demandMultiplier: number;
    categories: string[];
  }>;
  transportConnections: Array<{
    storeId: string;
    distance: number;
    travelTime: number;
    cost: number;
  }>;
  performanceMetrics: {
    averageDailySales: number;
    inventoryTurnover: number;
    customerFootfall: number;
    profitMargin: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StoreSchema: Schema = new Schema({
  storeId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(coords: number[]) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;     // latitude
        },
        message: 'Coordinates must be [longitude, latitude] with valid ranges',
      },
    },
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: 'USA' },
  },
  capacity: {
    type: Number,
    required: true,
    min: 0,
  },
  operatingHours: {
    monday: {
      open: { type: String, required: true },
      close: { type: String, required: true },
    },
    tuesday: {
      open: { type: String, required: true },
      close: { type: String, required: true },
    },
    wednesday: {
      open: { type: String, required: true },
      close: { type: String, required: true },
    },
    thursday: {
      open: { type: String, required: true },
      close: { type: String, required: true },
    },
    friday: {
      open: { type: String, required: true },
      close: { type: String, required: true },
    },
    saturday: {
      open: { type: String, required: true },
      close: { type: String, required: true },
    },
    sunday: {
      open: { type: String, required: true },
      close: { type: String, required: true },
    },
  },
  demographics: {
    population: { type: Number, min: 0 },
    medianIncome: { type: Number, min: 0 },
    ageGroups: {
      '18-24': { type: Number, min: 0, max: 100 },
      '25-34': { type: Number, min: 0, max: 100 },
      '35-44': { type: Number, min: 0, max: 100 },
      '45-54': { type: Number, min: 0, max: 100 },
      '55-64': { type: Number, min: 0, max: 100 },
      '65+': { type: Number, min: 0, max: 100 },
    },
  },
  seasonalPatterns: [{
    season: {
      type: String,
      enum: ['spring', 'summer', 'fall', 'winter', 'holiday'],
      required: true,
    },
    demandMultiplier: {
      type: Number,
      required: true,
      min: 0,
    },
    categories: [String],
  }],
  transportConnections: [{
    storeId: { type: String, required: true },
    distance: { type: Number, required: true, min: 0 },
    travelTime: { type: Number, required: true, min: 0 },
    cost: { type: Number, required: true, min: 0 },
  }],
  performanceMetrics: {
    averageDailySales: { type: Number, default: 0, min: 0 },
    inventoryTurnover: { type: Number, default: 0, min: 0 },
    customerFootfall: { type: Number, default: 0, min: 0 },
    profitMargin: { type: Number, default: 0, min: 0 },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  collection: 'stores',
});

// Geospatial index for location-based queries
StoreSchema.index({ location: '2dsphere' });

// Other indexes
StoreSchema.index({ 'address.city': 1, 'address.state': 1 });
StoreSchema.index({ capacity: 1 });
StoreSchema.index({ isActive: 1 });

// Virtual for longitude
StoreSchema.virtual('longitude').get(function(this: IStore) {
  return this.location.coordinates[0];
});

// Virtual for latitude
StoreSchema.virtual('latitude').get(function(this: IStore) {
  return this.location.coordinates[1];
});

// Method to calculate distance to another store
StoreSchema.methods.distanceTo = function(this: IStore, otherStore: IStore): number {
  const [lon1, lat1] = this.location.coordinates;
  const [lon2, lat2] = otherStore.location.coordinates;
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Static method to find nearby stores
StoreSchema.statics.findNearby = function(longitude: number, latitude: number, maxDistance: number) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance * 1000 // Convert km to meters
      }
    },
    isActive: true
  });
};

export const Store = mongoose.model<IStore>('Store', StoreSchema);
