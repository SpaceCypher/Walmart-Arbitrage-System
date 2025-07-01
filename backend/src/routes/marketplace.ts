import { Router, Request, Response, NextFunction } from 'express';
import { internalMarketplace } from '../market/InternalMarketplace';
import { AgentProduct } from '../models/AgentProduct';
import { logger } from '../utils/logger';

const router = Router();

// Get market overview and statistics
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const marketState = await internalMarketplace.getMarketState();
    
    res.json({
      success: true,
      data: {
        marketState,
        timestamp: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Failed to get market overview:', error);
    next(error);
  }
});

// Get active bids in the marketplace
router.get('/bids', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, productId, urgency } = req.query;
    const marketState = await internalMarketplace.getMarketState();
    
    let bids = marketState.activeBids;
    
    // Apply filters
    if (type) {
      bids = bids.filter(bid => bid.type === type);
    }
    if (productId) {
      bids = bids.filter(bid => bid.productId === productId);
    }
    if (urgency) {
      bids = bids.filter(bid => bid.urgency === urgency);
    }
    
    res.json({
      success: true,
      data: {
        bids,
        totalCount: bids.length,
        filters: { type, productId, urgency }
      }
    });
    
  } catch (error) {
    logger.error('Failed to get market bids:', error);
    next(error);
  }
});

// Get active matches in the marketplace
router.get('/matches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const marketState = await internalMarketplace.getMarketState();
    
    let matches = marketState.activeMatches;
    
    if (status) {
      matches = matches.filter(match => match.status === status);
    }
    
    res.json({
      success: true,
      data: {
        matches,
        totalCount: matches.length,
        filter: { status }
      }
    });
    
  } catch (error) {
    logger.error('Failed to get market matches:', error);
    next(error);
  }
});

// Submit a bid to the marketplace
router.post('/bids', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      agentId,
      productId,
      type,
      quantity,
      pricePerUnit,
      fromStoreId,
      toStoreId,
      urgency,
      validHours,
      conditions,
      metadata
    } = req.body;

    // Validate required fields
    if (!agentId || !productId || !type || !quantity || !pricePerUnit) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: agentId, productId, type, quantity, pricePerUnit'
      });
    }

    const validUntil = new Date(Date.now() + (validHours || 4) * 60 * 60 * 1000);

    const bidId = await internalMarketplace.submitBid({
      agentId,
      productId,
      type,
      quantity,
      pricePerUnit,
      fromStoreId,
      toStoreId,
      urgency: urgency || 'medium',
      validUntil,
      conditions: conditions || {},
      metadata: metadata || {
        profitPotential: 0,
        riskAssessment: 0.5,
        confidenceLevel: 0.5,
        seasonalFactors: {}
      }
    });

    res.status(201).json({
      success: true,
      data: {
        bidId,
        message: 'Bid submitted successfully',
        validUntil
      }
    });

  } catch (error) {
    logger.error('Failed to submit bid:', error);
    next(error);
  }
});

// Start a negotiation between agents
router.post('/negotiations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      initiatorId,
      targetId,
      productId,
      quantity,
      fromStore,
      toStore,
      initialOffer
    } = req.body;

    // Validate required fields
    if (!initiatorId || !targetId || !productId || !quantity || !fromStore || !toStore || !initialOffer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const negotiationId = await internalMarketplace.startNegotiation({
      initiatorId,
      targetId,
      productId,
      quantity,
      fromStore,
      toStore,
      initialOffer
    });

    res.status(201).json({
      success: true,
      data: {
        negotiationId,
        message: 'Negotiation started successfully'
      }
    });

  } catch (error) {
    logger.error('Failed to start negotiation:', error);
    next(error);
  }
});

// Submit a counter-offer in a negotiation
router.post('/negotiations/:negotiationId/offers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { negotiationId } = req.params;
    const { agentId, priceOffer, conditions } = req.body;

    if (!agentId || priceOffer === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: agentId, priceOffer'
      });
    }

    const isCompleted = await internalMarketplace.submitCounterOffer(
      negotiationId,
      agentId,
      { priceOffer, conditions: conditions || {} }
    );

    res.json({
      success: true,
      data: {
        negotiationId,
        isCompleted,
        message: isCompleted ? 'Negotiation completed successfully' : 'Counter-offer submitted'
      }
    });

  } catch (error) {
    logger.error('Failed to submit counter-offer:', error);
    next(error);
  }
});

// Get top market opportunities
router.get('/opportunities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const marketState = await internalMarketplace.getMarketState();
    
    res.json({
      success: true,
      data: {
        opportunities: marketState.topOpportunities,
        marketStats: marketState.marketStats,
        timestamp: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Failed to get market opportunities:', error);
    next(error);
  }
});

// Trigger market participation for an agent
router.post('/participate/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    
    const agentProduct = await AgentProduct.findOne({ 
      productId: agentId,
      isActive: true 
    });
    
    if (!agentProduct) {
      return res.status(404).json({
        success: false,
        error: 'Agent product not found'
      });
    }

    // Trigger marketplace participation
    await agentProduct.participateInMarket();

    res.json({
      success: true,
      data: {
        agentId,
        message: 'Agent participated in marketplace'
      }
    });

  } catch (error) {
    logger.error('Failed to trigger market participation:', error);
    next(error);
  }
});

// Get AI insights for market analysis
router.get('/ai-insights/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    
    const agentProduct = await AgentProduct.findOne({ 
      productId,
      isActive: true 
    });
    
    if (!agentProduct) {
      return res.status(404).json({
        success: false,
        error: 'Agent product not found'
      });
    }

    // Get AI-powered market analysis
    const marketContext = await agentProduct.buildMarketContext();
    
    // Use AgentBrain for market opportunity analysis
    if (!agentProduct.agentBrain) {
      const { AgentBrain } = await import('../ai/AgentBrain');
      agentProduct.agentBrain = new AgentBrain(productId);
    }
    
    const opportunities = await agentProduct.agentBrain.analyzeMarketOpportunities(marketContext);
    const forecast = await agentProduct.agentBrain.generateMarketForecast(7); // 7-day forecast

    res.json({
      success: true,
      data: {
        productId,
        marketContext,
        opportunities,
        forecast,
        aiInsights: {
          recommendedStrategy: agentProduct.agentState.currentStrategy,
          confidenceLevel: agentProduct.agentState.performanceMetrics.averageDecisionConfidence,
          lastDecision: agentProduct.currentDecision
        },
        timestamp: new Date()
      }
    });

  } catch (error) {
    logger.error('Failed to get AI insights:', error);
    next(error);
  }
});

// Trigger AI learning from market outcomes
router.post('/learn/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const outcomeData = req.body;
    
    const agentProduct = await AgentProduct.findOne({ 
      productId,
      isActive: true 
    });
    
    if (!agentProduct) {
      return res.status(404).json({
        success: false,
        error: 'Agent product not found'
      });
    }

    // Trigger learning from outcome
    await agentProduct.learnFromOutcome(outcomeData);

    res.json({
      success: true,
      data: {
        productId,
        message: 'Learning update processed successfully',
        currentPerformance: agentProduct.agentState.performanceMetrics
      }
    });

  } catch (error) {
    logger.error('Failed to process learning update:', error);
    next(error);
  }
});

// Force market clearing (admin operation)
router.post('/clear-market', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await internalMarketplace.clearMarket();
    
    res.json({
      success: true,
      data: {
        message: 'Market clearing completed',
        timestamp: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Failed to clear market:', error);
    next(error);
  }
});

export default router;
