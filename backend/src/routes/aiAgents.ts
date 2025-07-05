import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import axios from 'axios';

const router = Router();
const AI_AGENT_API_URL = process.env.AI_AGENT_API_URL || 'http://127.0.0.1:8000';

// Get AI agent system status
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.get(`${AI_AGENT_API_URL}/status`);
    
    res.json({
      success: true,
      data: {
        aiAgentSystem: response.data,
        integration: 'active',
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching AI agent status:', error);
    res.json({
      success: true,
      data: {
        aiAgentSystem: {
          status: 'unavailable',
          error: 'AI agent service not accessible'
        },
        integration: 'inactive',
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Trigger AI analysis for specific products
router.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { product_ids, force_analysis = false } = req.body;
    
    if (!product_ids || !Array.isArray(product_ids)) {
      return res.status(400).json({
        success: false,
        error: { message: 'product_ids array is required' },
        timestamp: new Date().toISOString(),
      });
    }

    const response = await axios.post(`${AI_AGENT_API_URL}/analyze`, {
      product_ids,
      force_analysis
    });
    
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error triggering AI analysis:', error);
    next(error);
  }
});

// Run complete AI agent cycle
router.post('/cycle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.post(`${AI_AGENT_API_URL}/cycle`);
    
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error starting AI agent cycle:', error);
    next(error);
  }
});

// Get recent opportunities identified by AI
router.get('/opportunities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const response = await axios.get(`${AI_AGENT_API_URL}/opportunities?limit=${limit}`);
    
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching AI opportunities:', error);
    next(error);
  }
});

// Get AI analysis for specific product
router.get('/products/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const response = await axios.get(`${AI_AGENT_API_URL}/products/${productId}/status`);
    
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error fetching AI status for product ${req.params.productId}:`, error);
    next(error);
  }
});

// Trigger AI analysis for specific product
router.post('/products/:productId/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const response = await axios.post(`${AI_AGENT_API_URL}/products/${productId}/analyze`);
    
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error triggering AI analysis for product ${req.params.productId}:`, error);
    next(error);
  }
});

// Health check for AI agent integration
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.get(`${AI_AGENT_API_URL}/health`);
    
    res.json({
      success: true,
      data: {
        aiAgentHealth: response.data,
        integrationStatus: 'healthy',
        lastChecked: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('AI agent health check failed:', error);
    res.json({
      success: true,
      data: {
        aiAgentHealth: { status: 'unhealthy', error: 'Service unavailable' },
        integrationStatus: 'disconnected',
        lastChecked: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Mark opportunity as processed (approved/rejected)
router.post('/opportunities/:opportunityId/process', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { opportunityId } = req.params;
    const { decision, tradeId, bidId } = req.body;
    
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Decision must be either "approved" or "rejected"' },
        timestamp: new Date().toISOString(),
      });
    }

    // Try to mark the opportunity as processed in the AI agents system
    try {
      await axios.post(`${AI_AGENT_API_URL}/opportunities/${opportunityId}/process`, {
        decision,
        tradeId,
        bidId,
        processedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.warn('Could not mark opportunity as processed in AI system:', error);
      // Continue anyway - we'll handle it in our local system
    }
    
    res.json({
      success: true,
      data: {
        opportunityId,
        decision,
        tradeId,
        processedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error processing opportunity:', error);
    next(error);
  }
});

export default router;
