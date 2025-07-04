import { Router, Request, Response, NextFunction } from 'express';
import { TradeDecision } from '../models/TradeDecision';
import { logger } from '../utils/logger';

const router = Router();

// Get all trade decisions with filtering
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      decision, 
      productId, 
      limit = 50, 
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter: any = {};
    
    if (decision) {
      filter.decision = decision;
    }
    if (productId) {
      filter.productId = productId;
    }

    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const [decisions, totalCount] = await Promise.all([
      TradeDecision.find(filter)
        .sort(sort)
        .limit(Number(limit))
        .skip(Number(offset))
        .lean(),
      TradeDecision.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        decisions,
        totalCount,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          hasMore: totalCount > Number(offset) + Number(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get trade decisions:', error);
    next(error);
  }
});

// Get trade decision by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const decision = await TradeDecision.findById(id).lean();
    
    if (!decision) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Trade decision not found',
          code: 'DECISION_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: decision
    });

  } catch (error) {
    logger.error('Failed to get trade decision:', error);
    next(error);
  }
});

// Create a new trade decision (approve or reject)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      productId,
      tradeId,
      opportunityData,
      decision,
      userId = 'system',
      bidId,
      metadata
    } = req.body;

    // Validate required fields
    if (!productId || !opportunityData || !decision) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields: productId, opportunityData, decision',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Decision must be either "approved" or "rejected"',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const tradeDecision = new TradeDecision({
      productId,
      tradeId,
      opportunityData,
      decision,
      userId,
      bidId,
      metadata
    });

    await tradeDecision.save();

    logger.info('Trade decision created:', {
      id: tradeDecision._id,
      productId,
      tradeId,
      decision,
      userId
    });

    res.status(201).json({
      success: true,
      data: {
        id: tradeDecision._id,
        decision: tradeDecision.toObject()
      }
    });

  } catch (error) {
    logger.error('Failed to create trade decision:', error);
    next(error);
  }
});

// Get trade decision statistics
router.get('/stats/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalDecisions,
      approvedCount,
      rejectedCount,
      recentDecisions,
      profitStats
    ] = await Promise.all([
      TradeDecision.countDocuments(),
      TradeDecision.countDocuments({ decision: 'approved' }),
      TradeDecision.countDocuments({ decision: 'rejected' }),
      TradeDecision.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      TradeDecision.aggregate([
        { $match: { decision: 'approved' } },
        {
          $group: {
            _id: null,
            totalPotentialProfit: { $sum: '$opportunityData.potential_profit' },
            avgPotentialProfit: { $avg: '$opportunityData.potential_profit' },
            avgConfidence: { $avg: '$opportunityData.confidence' }
          }
        }
      ])
    ]);

    const approvalRate = totalDecisions > 0 ? (approvedCount / totalDecisions) : 0;
    const rejectionRate = totalDecisions > 0 ? (rejectedCount / totalDecisions) : 0;

    const stats = profitStats[0] || {
      totalPotentialProfit: 0,
      avgPotentialProfit: 0,
      avgConfidence: 0
    };

    res.json({
      success: true,
      data: {
        overview: {
          totalDecisions,
          approvedCount,
          rejectedCount,
          approvalRate,
          rejectionRate
        },
        profitMetrics: {
          totalPotentialProfit: stats.totalPotentialProfit || 0,
          avgPotentialProfit: stats.avgPotentialProfit || 0,
          avgConfidence: stats.avgConfidence || 0
        },
        recentDecisions
      }
    });

  } catch (error) {
    logger.error('Failed to get trade decision stats:', error);
    next(error);
  }
});

export default router;
