import { Router, Request, Response, NextFunction } from 'express';
import { AgentManager } from '../agents/AgentManager';
import { logger } from '../utils/logger';

const router = Router();

// Initialize agent manager (this will be done in app.ts)
let agentManager: AgentManager;

export const initializeAgentManager = (manager: AgentManager) => {
  agentManager = manager;
};

// Get all agents status
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!agentManager) {
      return res.status(503).json({
        success: false,
        error: { message: 'Agent manager not initialized' },
        timestamp: new Date().toISOString(),
      });
    }

    const agentStatus = agentManager.getAgentStatus();
    
    res.json({
      success: true,
      data: {
        agents: agentStatus,
        summary: {
          totalAgents: agentManager.agentCount,
          activeAgents: agentStatus.filter(a => a.isActive).length,
          isManagerActive: agentManager.isActive
        }
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get specific agent details
router.get('/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!agentManager) {
      return res.status(503).json({
        success: false,
        error: { message: 'Agent manager not initialized' },
        timestamp: new Date().toISOString(),
      });
    }

    const agent = agentManager.getAgentById(req.params.agentId);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: { message: 'Agent not found' },
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: {
        id: agent.id,
        type: agent.type,
        isActive: agent.isActive,
        activeActions: agent.activeActionCount,
        recentDecisions: agent.recentDecisions
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Create a new product agent
router.post('/product/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!agentManager) {
      return res.status(503).json({
        success: false,
        error: { message: 'Agent manager not initialized' },
        timestamp: new Date().toISOString(),
      });
    }

    const { productId } = req.params;
    const customConfig = req.body.config || {};

    const agent = await agentManager.createProductAgent(productId, customConfig);
    
    res.status(201).json({
      success: true,
      data: {
        agentId: agent.id,
        productId,
        isActive: agent.isActive,
        message: 'Product agent created successfully'
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: { message: error.message },
        timestamp: new Date().toISOString(),
      });
    }
    next(error);
  }
});

// Remove an agent
router.delete('/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!agentManager) {
      return res.status(503).json({
        success: false,
        error: { message: 'Agent manager not initialized' },
        timestamp: new Date().toISOString(),
      });
    }

    await agentManager.removeAgent(req.params.agentId);
    
    res.json({
      success: true,
      data: { message: 'Agent removed successfully' },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Send message to agents
router.post('/message', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!agentManager) {
      return res.status(503).json({
        success: false,
        error: { message: 'Agent manager not initialized' },
        timestamp: new Date().toISOString(),
      });
    }

    const { type, to, payload, priority = 'medium' } = req.body;

    if (!type || !to || !payload) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required fields: type, to, payload' },
        timestamp: new Date().toISOString(),
      });
    }

    await agentManager.broadcastMessage({
      type,
      to,
      payload,
      priority
    });
    
    res.json({
      success: true,
      data: { message: 'Message sent successfully' },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get product agent specific data
router.get('/product/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!agentManager) {
      return res.status(503).json({
        success: false,
        error: { message: 'Agent manager not initialized' },
        timestamp: new Date().toISOString(),
      });
    }

    const agent = agentManager.getProductAgent(req.params.productId);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: { message: 'Product agent not found' },
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: {
        agentId: agent.id,
        productId: req.params.productId,
        isActive: agent.isActive,
        activeActions: agent.activeActionCount,
        recentDecisions: agent.recentDecisions.map(decision => ({
          id: decision.id,
          type: decision.type,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
          actionsCount: decision.actions.length,
          timestamp: decision.timestamp
        }))
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get system-wide agent analytics
router.get('/analytics/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!agentManager) {
      return res.status(503).json({
        success: false,
        error: { message: 'Agent manager not initialized' },
        timestamp: new Date().toISOString(),
      });
    }

    const agentStatus = agentManager.getAgentStatus();
    
    const analytics = {
      totalAgents: agentManager.agentCount,
      activeAgents: agentStatus.filter(a => a.isActive).length,
      totalActiveActions: agentStatus.reduce((sum, a) => sum + a.activeActions, 0),
      totalRecentDecisions: agentStatus.reduce((sum, a) => sum + a.recentDecisions, 0),
      agentTypes: agentStatus.reduce((acc, agent) => {
        acc[agent.type] = (acc[agent.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      averageActionsPerAgent: agentStatus.length > 0 
        ? agentStatus.reduce((sum, a) => sum + a.activeActions, 0) / agentStatus.length 
        : 0,
      systemHealth: {
        managerActive: agentManager.isActive,
        agentUtilization: agentStatus.length > 0 
          ? (agentStatus.filter(a => a.isActive).length / agentStatus.length) * 100 
          : 0
      }
    };
    
    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
