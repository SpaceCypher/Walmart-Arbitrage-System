import { Request, Response } from 'express';
import { TradeDecision } from '../models/TradeDecision';

export const getOverview = async (req: Request, res: Response) => {
  try {
    // Get date range for filtering (last 30 days by default)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Real data: Count of actual trade decisions from last 30 days
    const totalDecisions = await TradeDecision.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Real data: Count of approved decisions
    const approvedDecisions = await TradeDecision.countDocuments({
      decision: 'approved',
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Real data: Count of rejected decisions
    const rejectedDecisions = await TradeDecision.countDocuments({
      decision: 'rejected',
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Real data: Sum of actual potential_profit from approved trades
    const profitAggregate = await TradeDecision.aggregate([
      {
        $match: {
          decision: 'approved',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: '$opportunityData.potential_profit' }, // Real profit values
          avgConfidence: { $avg: '$opportunityData.confidence' }       // Real confidence scores
        }
      }
    ]);

    const totalPotentialProfit = profitAggregate[0]?.totalProfit || 0;
    const avgConfidence = profitAggregate[0]?.avgConfidence || 0;

    // Real data: Distribution of urgency levels from actual decisions
    const urgencyDistribution = await TradeDecision.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$opportunityData.urgency',
          count: { $sum: 1 }
        }
      }
    ]);

    const overview = {
      totalDecisions,
      approvedDecisions,
      rejectedDecisions,
      approvalRate: totalDecisions > 0 ? (approvedDecisions / totalDecisions) * 100 : 0,
      totalPotentialProfit,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      urgencyDistribution: urgencyDistribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>),
      dateRange: {
        start: startDate,
        end: endDate
      }
    };

    res.json(overview);
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
};
