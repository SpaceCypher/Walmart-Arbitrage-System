import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  productId: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  description: string;
  attributes: {
    weight: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
    perishable: boolean;
    seasonality: string[];
    shelfLife?: number;
  };
  pricing: {
    baseCost: number;
    standardRetail: number;
    marginTargets: {
      minimum: number;
      target: number;
      premium: number;
    };
  };
  substitutes: string[];
  complements: string[];
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema = new Schema({
  productId: {
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
  category: {
    type: String,
    required: true,
    index: true,
  },
  subcategory: {
    type: String,
    required: true,
    index: true,
  },
  brand: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  attributes: {
    weight: {
      type: Number,
      required: true,
      min: 0,
    },
    dimensions: {
      length: { type: Number, required: true, min: 0 },
      width: { type: Number, required: true, min: 0 },
      height: { type: Number, required: true, min: 0 },
    },
    perishable: {
      type: Boolean,
      default: false,
    },
    seasonality: [{
      type: String,
      enum: ['spring', 'summer', 'fall', 'winter', 'holiday', 'year-round'],
    }],
    shelfLife: {
      type: Number,
      min: 0,
    },
  },
  pricing: {
    baseCost: {
      type: Number,
      required: true,
      min: 0,
    },
    standardRetail: {
      type: Number,
      required: true,
      min: 0,
    },
    marginTargets: {
      minimum: { type: Number, required: true, min: 0 },
      target: { type: Number, required: true, min: 0 },
      premium: { type: Number, required: true, min: 0 },
    },
  },
  substitutes: [{
    type: String,
    ref: 'Product',
  }],
  complements: [{
    type: String,
    ref: 'Product',
  }],
  tags: [String],
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  collection: 'products',
});

// Indexes
ProductSchema.index({ category: 1, subcategory: 1 });
ProductSchema.index({ brand: 1 });
ProductSchema.index({ tags: 1 });
ProductSchema.index({ 'attributes.perishable': 1 });
ProductSchema.index({ isActive: 1 });

// Text search index
ProductSchema.index({
  name: 'text',
  description: 'text',
  brand: 'text',
  category: 'text',
});

// Virtual for volume calculation
ProductSchema.virtual('volume').get(function(this: IProduct) {
  const { length, width, height } = this.attributes.dimensions;
  return length * width * height;
});

// Method to calculate margin percentage
ProductSchema.methods.calculateMargin = function(this: IProduct, sellPrice: number): number {
  return ((sellPrice - this.pricing.baseCost) / sellPrice) * 100;
};

// Static method to find products by category
ProductSchema.statics.findByCategory = function(category: string) {
  return this.find({ category, isActive: true });
};

// Static method to find seasonal products
ProductSchema.statics.findSeasonal = function(season: string) {
  return this.find({ 
    'attributes.seasonality': season,
    isActive: true 
  });
};

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
