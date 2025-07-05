import mongoose, { Schema, Document } from 'mongoose';

export interface ITradeDecision extends Document {
  productId: string;
  tradeId?: string; // Added tradeId field
  opportunityData: {
    type: string;
    confidence: number;
    potential_profit: number;
    source_store: string;
    target_store: string;
    quantity: number;
    reasoning: string;
    urgency: string;
  };
  decision: 'approved' | 'rejected';
  userId: string;
  bidId?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const TradeDecisionSchema: Schema = new Schema({
  productId: {
    type: String,
    required: true,
    index: true,
  },
  tradeId: {
    type: String,
    index: true,
  },
  opportunityData: {
    type: {
      type: String,
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    potential_profit: {
      type: Number,
      required: true,
    },
    source_store: {
      type: String,
      required: true,
    },
    target_store: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    reasoning: {
      type: String,
      required: true,
    },
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
  },
  decision: {
    type: String,
    enum: ['approved', 'rejected'],
    required: true,
  },
  userId: {
    type: String,
    required: true,
    default: 'system',
  },
  bidId: {
    type: String,
  },
  metadata: {
    type: Schema.Types.Mixed,
  },
}, {
  timestamps: true,
  collection: 'tradeDecisions',
});

// Indexes for efficient queries
TradeDecisionSchema.index({ productId: 1, createdAt: -1 });
TradeDecisionSchema.index({ decision: 1, createdAt: -1 });
TradeDecisionSchema.index({ userId: 1 });

export const TradeDecision = mongoose.model<ITradeDecision>('TradeDecision', TradeDecisionSchema);