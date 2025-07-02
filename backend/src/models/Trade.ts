import mongoose, { Schema, Document } from 'mongoose';

export interface ITrade extends Document {
  tradeId: string;
  status: 'proposed' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  fromStoreId: string;
  toStoreId: string;
  productId: string;
  sku: string;
  quantity: number;
  estimatedProfit: number;
  transportCost: number;
  urgencyScore: number;
  proposedBy: string; // Agent ID
  approvedBy?: string; // User ID
  rejectedBy?: string; // User ID
  rejectionReason?: string;
  proposedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  scheduledAt?: Date;
  executedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  reasoning: string;
  constraints: {
    maxTransportCost: number;
    minProfitMargin: number;
    deliveryDeadline: Date;
    minQuantity: number;
    maxQuantity: number;
  };
  execution: {
    actualProfit?: number;
    actualTransportCost?: number;
    actualQuantity?: number;
    trackingId?: string;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TradeSchema: Schema = new Schema({
  tradeId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['proposed', 'approved', 'rejected', 'executing', 'completed', 'failed'],
    default: 'proposed',
    index: true,
  },
  fromStoreId: {
    type: String,
    required: true,
    index: true,
  },
  toStoreId: {
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
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  estimatedProfit: {
    type: Number,
    required: true,
  },
  transportCost: {
    type: Number,
    required: true,
    min: 0,
  },
  urgencyScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  proposedBy: {
    type: String,
    required: true,
  },
  approvedBy: {
    type: String,
  },
  rejectedBy: {
    type: String,
  },
  rejectionReason: {
    type: String,
  },
  proposedAt: {
    type: Date,
    default: Date.now,
  },
  approvedAt: {
    type: Date,
  },
  rejectedAt: {
    type: Date,
  },
  scheduledAt: {
    type: Date,
  },
  executedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  failedAt: {
    type: Date,
  },
  reasoning: {
    type: String,
    required: true,
  },
  constraints: {
    maxTransportCost: {
      type: Number,
      required: true,
      min: 0,
    },
    minProfitMargin: {
      type: Number,
      required: true,
      min: 0,
    },
    deliveryDeadline: {
      type: Date,
      required: true,
    },
    minQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    maxQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  execution: {
    actualProfit: {
      type: Number,
    },
    actualTransportCost: {
      type: Number,
      min: 0,
    },
    actualQuantity: {
      type: Number,
      min: 0,
    },
    trackingId: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
}, {
  timestamps: true,
  collection: 'trades',
});

// Compound indexes for efficient queries
TradeSchema.index({ status: 1, proposedAt: -1 });
TradeSchema.index({ fromStoreId: 1, status: 1 });
TradeSchema.index({ toStoreId: 1, status: 1 });
TradeSchema.index({ productId: 1, status: 1 });
TradeSchema.index({ proposedBy: 1, proposedAt: -1 });
TradeSchema.index({ urgencyScore: -1, status: 1 });

// Virtual for profit margin percentage
TradeSchema.virtual('profitMargin').get(function(this: ITrade) {
  if (this.transportCost === 0) return 0;
  return (this.estimatedProfit / (this.estimatedProfit + this.transportCost)) * 100;
});

// Virtual for trade duration
TradeSchema.virtual('tradeDuration').get(function(this: ITrade) {
  if (!this.completedAt || !this.proposedAt) return null;
  return this.completedAt.getTime() - this.proposedAt.getTime();
});

// Method to check if trade is expired
TradeSchema.methods.isExpired = function(this: ITrade): boolean {
  return new Date() > this.constraints.deliveryDeadline;
};

// Method to check if trade is profitable
TradeSchema.methods.isProfitable = function(this: ITrade): boolean {
  return this.estimatedProfit > this.transportCost;
};

// Static method to find pending trades
TradeSchema.statics.findPending = function() {
  return this.find({ 
    status: 'proposed',
    'constraints.deliveryDeadline': { $gt: new Date() }
  }).sort({ urgencyScore: -1, proposedAt: 1 });
};

// Static method to find trades by store
TradeSchema.statics.findByStore = function(storeId: string) {
  return this.find({
    $or: [
      { fromStoreId: storeId },
      { toStoreId: storeId }
    ]
  }).sort({ proposedAt: -1 });
};

// Static method to calculate trade statistics
TradeSchema.statics.getTradeStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalProfit: { $sum: '$estimatedProfit' },
        averageProfit: { $avg: '$estimatedProfit' },
        totalTransportCost: { $sum: '$transportCost' },
      }
    }
  ]);
};

export const Trade = mongoose.model<ITrade>('Trade', TradeSchema);
