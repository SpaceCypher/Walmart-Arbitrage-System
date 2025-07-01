import { Router, Request, Response, NextFunction } from 'express';
import { Trade } from '../models/Trade';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all trades with filtering
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      storeId,
      productId,
      sortBy = 'proposedAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const query: any = {};

    if (status) query.status = status;
    if (storeId) {
      query.$or = [
        { fromStoreId: storeId },
        { toStoreId: storeId }
      ];
    }
    if (productId) query.productId = productId;

    const trades = await Trade.find(query)
      .sort({ [sortBy as string]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Trade.countDocuments(query);

    res.json({
      success: true,
      data: {
        trades,
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

// Create new trade proposal
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tradeData = {
      ...req.body,
      tradeId: uuidv4(),
      status: 'proposed',
      proposedAt: new Date(),
    };

    const trade = new Trade(tradeData);
    await trade.save();

    res.status(201).json({
      success: true,
      data: trade,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get trade by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trade = await Trade.findById(req.params.id);
    
    if (!trade) {
      return res.status(404).json({
        success: false,
        error: { message: 'Trade not found' },
      });
    }

    res.json({
      success: true,
      data: trade,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Approve trade
router.put('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approvedBy } = req.body;
    
    const trade = await Trade.findByIdAndUpdate(
      req.params.id,
      {
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
      },
      { new: true }
    );

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: { message: 'Trade not found' },
      });
    }

    res.json({
      success: true,
      data: trade,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Reject trade
router.put('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rejectedBy, rejectionReason } = req.body;
    
    const trade = await Trade.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        rejectedBy,
        rejectionReason,
        rejectedAt: new Date(),
      },
      { new: true }
    );

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: { message: 'Trade not found' },
      });
    }

    res.json({
      success: true,
      data: trade,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
