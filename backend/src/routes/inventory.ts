import { Router, Request, Response, NextFunction } from 'express';
import { Inventory } from '../models/Inventory';
import { keydb } from '../config/keydb';
import { logger } from '../utils/logger';

const router = Router();

// Get all inventory with pagination and filtering
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 50,
      storeId,
      productId,
      lowStock,
      overstock,
      sortBy = 'lastUpdated',
      sortOrder = 'desc'
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const query: any = {};

    // Build filter query
    if (storeId) query.storeId = storeId;
    if (productId) query.productId = productId;
    if (lowStock === 'true') {
      query.$expr = {
        $lte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, '$reorderPoint']
      };
    }
    if (overstock === 'true') {
      query.$expr = {
        $gt: ['$quantity', { $multiply: ['$maxCapacity', 0.9] }]
      };
    }

    // Get inventory data
    const inventory = await Inventory.find(query)
      .sort({ [sortBy as string]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Inventory.countDocuments(query);

    res.json({
      success: true,
      data: {
        inventory,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get arbitrage opportunities
router.get('/arbitrage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const minProfitMargin = parseFloat(req.query.minProfitMargin as string) || 10;
    
    // Find arbitrage opportunities by comparing prices across different stores for the same product
    const opportunities = await Inventory.aggregate([
      {
        $lookup: {
          from: 'inventories',
          let: { productId: '$productId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$productId', '$$productId'] },
                    { $gt: ['$quantity', 0] }
                  ]
                }
              }
            }
          ],
          as: 'sameProductInventory'
        }
      },
      {
        $unwind: '$sameProductInventory'
      },
      {
        $project: {
          productId: 1,
          storeId: 1,
          cost: 1,
          retailPrice: 1,
          quantity: 1,
          otherStoreId: '$sameProductInventory.storeId',
          otherCost: '$sameProductInventory.cost',
          otherRetailPrice: '$sameProductInventory.retailPrice',
          otherQuantity: '$sameProductInventory.quantity',
          priceDifference: { $subtract: ['$sameProductInventory.retailPrice', '$cost'] },
          profitMargin: {
            $multiply: [
              { $divide: [{ $subtract: ['$sameProductInventory.retailPrice', '$cost'] }, '$cost'] },
              100
            ]
          }
        }
      },
      {
        $match: {
          $expr: {
            $and: [
              { $ne: ['$storeId', '$otherStoreId'] },
              { $gt: ['$profitMargin', minProfitMargin] },
              { $gt: ['$priceDifference', 0] }
            ]
          }
        }
      },
      {
        $sort: { profitMargin: -1 }
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: 'productId',
          as: 'product'
        }
      },
      {
        $lookup: {
          from: 'stores',
          localField: 'storeId',
          foreignField: 'storeId',
          as: 'sourceStore'
        }
      },
      {
        $lookup: {
          from: 'stores',
          localField: 'otherStoreId',
          foreignField: 'storeId',
          as: 'targetStore'
        }
      },
      {
        $project: {
          productId: 1,
          product: { $arrayElemAt: ['$product', 0] },
          sourceStore: { $arrayElemAt: ['$sourceStore', 0] },
          targetStore: { $arrayElemAt: ['$targetStore', 0] },
          buyPrice: '$cost',
          sellPrice: '$otherRetailPrice',
          profitMargin: 1,
          priceDifference: 1,
          availableQuantity: '$quantity',
          demandQuantity: '$otherQuantity',
          maxProfitableQuantity: { $min: ['$quantity', '$otherQuantity'] }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        opportunities,
        count: opportunities.length,
        filters: {
          minProfitMargin,
          limit
        }
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get inventory by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inventory = await Inventory.findById(req.params.id);
    
    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: { message: 'Inventory item not found' },
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: inventory,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Update inventory
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quantity, reservedQuantity, cost, retailPrice } = req.body;
    
    const inventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      {
        ...(quantity !== undefined && { quantity }),
        ...(reservedQuantity !== undefined && { reservedQuantity }),
        ...(cost !== undefined && { cost }),
        ...(retailPrice !== undefined && { retailPrice }),
        lastUpdated: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: { message: 'Inventory item not found' },
        timestamp: new Date().toISOString(),
      });
    }

    // Update real-time cache in KeyDB
    try {
      const client = keydb.getClient();
      const cacheKey = `inventory:${inventory.storeId}:${inventory.productId}`;
      await client.hset(cacheKey, {
        quantity: inventory.quantity.toString(),
        reserved: inventory.reservedQuantity.toString(),
        lastUpdated: inventory.lastUpdated.getTime().toString(),
        cost: inventory.cost.toString(),
        retail: inventory.retailPrice.toString(),
      });
      
      // Publish update event
      const publisher = keydb.getPublisher();
      await publisher.publish('inventory:updated', JSON.stringify({
        id: inventory._id,
        storeId: inventory.storeId,
        productId: inventory.productId,
        quantity: inventory.quantity,
        reservedQuantity: inventory.reservedQuantity,
        timestamp: new Date().toISOString(),
      }));
    } catch (cacheError) {
      logger.warn('Failed to update cache:', cacheError);
    }

    res.json({
      success: true,
      data: inventory,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Bulk update inventory
router.post('/bulk-update', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Updates must be an array' },
        timestamp: new Date().toISOString(),
      });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { id, ...updateData } = update;
        const inventory = await Inventory.findByIdAndUpdate(
          id,
          { ...updateData, lastUpdated: new Date() },
          { new: true, runValidators: true }
        );

        if (inventory) {
          results.push(inventory);
          
          // Update cache
          try {
            const client = keydb.getClient();
            const cacheKey = `inventory:${inventory.storeId}:${inventory.productId}`;
            await client.hset(cacheKey, {
              quantity: inventory.quantity.toString(),
              reserved: inventory.reservedQuantity.toString(),
              lastUpdated: inventory.lastUpdated.getTime().toString(),
            });
          } catch (cacheError) {
            logger.warn('Failed to update cache for bulk update:', cacheError);
          }
        } else {
          errors.push({ id, error: 'Item not found' });
        }
      } catch (error) {
        errors.push({ id: update.id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    res.json({
      success: true,
      data: {
        updated: results,
        errors,
        summary: {
          total: updates.length,
          successful: results.length,
          failed: errors.length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get low stock items
router.get('/alerts/low-stock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.query;
    const query: any = {
      $expr: {
        $lte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, '$reorderPoint']
      }
    };

    if (storeId) query.storeId = storeId;

    const lowStockItems = await Inventory.find(query).lean();

    res.json({
      success: true,
      data: lowStockItems,
      count: lowStockItems.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get inventory analytics
router.get('/analytics/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.query;
    const matchStage = storeId ? { storeId } : {};

    const analytics = await Inventory.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: { $multiply: ['$quantity', '$cost'] } },
          lowStockCount: {
            $sum: {
              $cond: [
                { $lte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, '$reorderPoint'] },
                1,
                0
              ]
            }
          },
          overstockCount: {
            $sum: {
              $cond: [
                { $gt: ['$quantity', { $multiply: ['$maxCapacity', 0.9] }] },
                1,
                0
              ]
            }
          },
          averageTurnover: { $avg: '$turnoverRate' },
        }
      }
    ]);

    res.json({
      success: true,
      data: analytics[0] || {
        totalItems: 0,
        totalQuantity: 0,
        totalValue: 0,
        lowStockCount: 0,
        overstockCount: 0,
        averageTurnover: 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
