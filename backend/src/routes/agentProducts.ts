import { Router, Request, Response, NextFunction } from 'express';
import { AgentProduct } from '../models/AgentProduct';
import { logger } from '../utils/logger';

const router = Router();

// Get all agent products with their agent status
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = { isActive: true };
    if (category) {
      filter['productData.category'] = category;
    }
    if (status) {
      filter['agentState.status'] = status;
    }

    // Get products with agent status
    const [products, total] = await Promise.all([
      AgentProduct.find(filter)
        .select({
          productId: 1,
          'productData.name': 1,
          'productData.category': 1,
          'productData.brand': 1,
          'productData.pricing': 1,
          'agentState.status': 1,
          'agentState.lastDecisionAt': 1,
          'agentState.currentStrategy': 1,
          'agentState.performanceMetrics': 1,
          'currentDecision': 1,
          'activeActions': 1,
          'recentDecisions': 1,
          createdAt: 1,
          updatedAt: 1
        })
        .sort({ 'agentState.lastDecisionAt': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AgentProduct.countDocuments(filter)
    ]);

    // Transform response to include agent insights
    const productsWithAgentStatus = products.map(product => ({
      productId: product.productId,
      name: product.productData.name,
      category: product.productData.category,
      brand: product.productData.brand,
      pricing: product.productData.pricing,
      
      // Agent status and activity
      agentStatus: {
        status: product.agentState.status,
        lastDecisionAt: product.agentState.lastDecisionAt,
        currentStrategy: product.agentState.currentStrategy,
        activeActions: product.activeActions?.length || 0,
        recentDecisionsCount: product.recentDecisions?.length || 0,
        performanceMetrics: product.agentState.performanceMetrics
      },
      
      // Current agent activity
      currentDecision: product.currentDecision ? {
        type: product.currentDecision.type,
        confidence: product.currentDecision.confidence,
        reasoning: product.currentDecision.reasoning,
        timestamp: product.currentDecision.timestamp,
        actionsCount: product.currentDecision.actions?.length || 0
      } : null,
      
      // Recent activity summary
      recentActivity: {
        lastDecision: product.recentDecisions?.[0] ? {
          type: product.recentDecisions[0].type,
          confidence: product.recentDecisions[0].confidence,
          reasoning: product.recentDecisions[0].reasoning,
          timestamp: product.recentDecisions[0].timestamp
        } : null
      },
      
      timestamps: {
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }
    }));

    res.json({
      success: true,
      data: {
        products: productsWithAgentStatus,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
        summary: {
          totalProducts: total,
          activeAgents: products.filter(p => p.agentState.status === 'active').length,
          averageConfidence: products.reduce((sum, p) => {
            const lastDecision = p.recentDecisions?.[0];
            return sum + (lastDecision?.confidence || 0);
          }, 0) / products.length || 0
        }
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get specific agent product with full details
router.get('/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentProduct = await AgentProduct.findOne({ 
      productId: req.params.productId,
      isActive: true 
    });
    
    if (!agentProduct) {
      return res.status(404).json({
        success: false,
        error: { message: 'Agent product not found' },
        timestamp: new Date().toISOString(),
      });
    }

    // Return complete agent product information
    res.json({
      success: true,
      data: {
        productId: agentProduct.productId,
        
        // Product information
        productData: agentProduct.productData,
        
        // Agent state and configuration
        agentState: agentProduct.agentState,
        agentConfig: agentProduct.agentConfig,
        
        // Current agent activity
        currentDecision: agentProduct.currentDecision,
        activeActions: agentProduct.activeActions,
        recentDecisions: agentProduct.recentDecisions,
        
        // Metadata
        isActive: agentProduct.isActive,
        createdAt: agentProduct.createdAt,
        updatedAt: agentProduct.updatedAt
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Start an agent (if stopped)
router.post('/:productId/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentProduct = await AgentProduct.findOne({ 
      productId: req.params.productId,
      isActive: true 
    });
    
    if (!agentProduct) {
      return res.status(404).json({
        success: false,
        error: { message: 'Agent product not found' },
        timestamp: new Date().toISOString(),
      });
    }

    await agentProduct.startAgent();
    
    res.json({
      success: true,
      data: {
        productId: agentProduct.productId,
        agentStatus: agentProduct.agentState.status,
        message: 'Agent started successfully'
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Stop an agent
router.post('/:productId/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentProduct = await AgentProduct.findOne({ 
      productId: req.params.productId,
      isActive: true 
    });
    
    if (!agentProduct) {
      return res.status(404).json({
        success: false,
        error: { message: 'Agent product not found' },
        timestamp: new Date().toISOString(),
      });
    }

    await agentProduct.stopAgent();
    
    res.json({
      success: true,
      data: {
        productId: agentProduct.productId,
        agentStatus: agentProduct.agentState.status,
        message: 'Agent stopped successfully'
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Force a decision (manual trigger)
router.post('/:productId/decide', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentProduct = await AgentProduct.findOne({ 
      productId: req.params.productId,
      isActive: true 
    });
    
    if (!agentProduct) {
      return res.status(404).json({
        success: false,
        error: { message: 'Agent product not found' },
        timestamp: new Date().toISOString(),
      });
    }

    const decision = await agentProduct.makeDecision();
    
    res.json({
      success: true,
      data: {
        productId: agentProduct.productId,
        decision,
        message: decision ? 'Decision made successfully' : 'No decision needed at this time'
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get agent performance analytics
router.get('/:productId/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentProduct = await AgentProduct.findOne({ 
      productId: req.params.productId,
      isActive: true 
    });
    
    if (!agentProduct) {
      return res.status(404).json({
        success: false,
        error: { message: 'Agent product not found' },
        timestamp: new Date().toISOString(),
      });
    }

    // Calculate additional analytics
    const recentDecisions = agentProduct.recentDecisions || [];
    const avgConfidence = recentDecisions.length > 0 
      ? recentDecisions.reduce((sum, d) => sum + d.confidence, 0) / recentDecisions.length 
      : 0;

    const decisionsLast24h = recentDecisions.filter(d => 
      new Date(d.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length;

    res.json({
      success: true,
      data: {
        productId: agentProduct.productId,
        analytics: {
          performanceMetrics: agentProduct.agentState.performanceMetrics,
          decisionAnalytics: {
            totalRecentDecisions: recentDecisions.length,
            averageConfidence: avgConfidence,
            decisionsLast24h,
            lastDecisionAt: agentProduct.agentState.lastDecisionAt
          },
          activityAnalytics: {
            currentActiveActions: agentProduct.activeActions?.length || 0,
            currentStrategy: agentProduct.agentState.currentStrategy,
            status: agentProduct.agentState.status
          },
          configuration: agentProduct.agentConfig
        }
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Update agent configuration
router.put('/:productId/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentProduct = await AgentProduct.findOne({ 
      productId: req.params.productId,
      isActive: true 
    });
    
    if (!agentProduct) {
      return res.status(404).json({
        success: false,
        error: { message: 'Agent product not found' },
        timestamp: new Date().toISOString(),
      });
    }

    // Update configuration
    const { decisionInterval, thresholds, forecastingConfig } = req.body;
    
    if (decisionInterval) {
      agentProduct.agentConfig.decisionInterval = decisionInterval;
    }
    if (thresholds) {
      agentProduct.agentConfig.thresholds = { ...agentProduct.agentConfig.thresholds, ...thresholds };
    }
    if (forecastingConfig) {
      agentProduct.agentConfig.forecastingConfig = { ...agentProduct.agentConfig.forecastingConfig, ...forecastingConfig };
    }

    await agentProduct.save();
    
    res.json({
      success: true,
      data: {
        productId: agentProduct.productId,
        agentConfig: agentProduct.agentConfig,
        message: 'Agent configuration updated successfully'
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get system-wide agent product analytics
router.get('/analytics/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalProducts, agentStats] = await Promise.all([
      AgentProduct.countDocuments({ isActive: true }),
      AgentProduct.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$agentState.status',
            count: { $sum: 1 },
            avgConfidence: { $avg: { $arrayElemAt: ['$recentDecisions.confidence', 0] } },
            totalProfit: { $sum: '$agentState.performanceMetrics.totalProfitGenerated' },
            totalTransfers: { $sum: '$agentState.performanceMetrics.successfulTransfers' }
          }
        }
      ])
    ]);

    const categoryStats = await AgentProduct.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$productData.category',
          count: { $sum: 1 },
          activeAgents: {
            $sum: { $cond: [{ $eq: ['$agentState.status', 'active'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalProducts,
          statusBreakdown: agentStats,
          categoryBreakdown: categoryStats,
          systemHealth: {
            totalActiveAgents: agentStats.find(s => s._id === 'active')?.count || 0,
            systemUtilization: ((agentStats.find(s => s._id === 'active')?.count || 0) / totalProducts) * 100,
            totalProfitGenerated: agentStats.reduce((sum, s) => sum + (s.totalProfit || 0), 0),
            totalSuccessfulTransfers: agentStats.reduce((sum, s) => sum + (s.totalTransfers || 0), 0)
          }
        }
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
