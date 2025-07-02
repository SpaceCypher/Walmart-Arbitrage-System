import mongoose, { Schema, Document } from 'mongoose';

export interface IInventory extends Document {
  id: string;
  storeId: string;
  productId: string;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  cost: number;
  retailPrice: number;
  location: {
    latitude: number;
    longitude: number;
  };
  lastUpdated: Date;
  reorderPoint: number;
  maxCapacity: number;
  turnoverRate: number;
  demandForecast: Array<{
    period: string;
    predictedDemand: number;
    confidence: number;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema: Schema = new Schema({
  storeId: {
    type: String,
    required: true,
    index: true,
  },
  productId: {
    type: String,
    required: true,
    index: true,
  },
  sku: {
    type: String,
    required: true,
    unique: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  reservedQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  cost: {
    type: Number,
    required: true,
    min: 0,
  },
  retailPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  location: {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  reorderPoint: {
    type: Number,
    required: true,
    min: 0,
  },
  maxCapacity: {
    type: Number,
    required: true,
    min: 0,
  },
  turnoverRate: {
    type: Number,
    default: 0,
    min: 0,
  },
  demandForecast: [{
    period: {
      type: String,
      required: true,
    },
    predictedDemand: {
      type: Number,
      required: true,
      min: 0,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
  collection: 'inventory',
});

// Compound indexes for efficient queries
InventorySchema.index({ storeId: 1, productId: 1 });
InventorySchema.index({ productId: 1, quantity: 1 });
InventorySchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
InventorySchema.index({ lastUpdated: -1 });

// Virtual for available quantity
InventorySchema.virtual('availableQuantity').get(function(this: IInventory) {
  return (this.quantity || 0) - (this.reservedQuantity || 0);
});

// Instance method to check if reorder is needed
InventorySchema.methods.needsReorder = function(this: IInventory): boolean {
  const available = (this.quantity || 0) - (this.reservedQuantity || 0);
  return available <= (this.reorderPoint || 0);
};

// Instance method to check if overstocked
InventorySchema.methods.isOverstocked = function(this: IInventory): boolean {
  return (this.quantity || 0) > (this.maxCapacity || 0) * 0.9;
};

// Static method to find low stock items
InventorySchema.statics.findLowStock = function() {
  return this.find({
    $expr: {
      $lte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, '$reorderPoint']
    }
  });
};

export const Inventory = mongoose.model<IInventory>('Inventory', InventorySchema);
