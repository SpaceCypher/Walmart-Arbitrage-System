import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { db } from './config/database';
import { keydb } from './config/keydb';
import { logger, loggerStream } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';

// Import routes
import inventoryRoutes from './routes/inventory';
import tradeRoutes from './routes/trades';
import productRoutes from './routes/products';
import storeRoutes from './routes/stores';
import healthRoutes from './routes/health';
import agentRoutes, { initializeAgentManager } from './routes/agents';
import agentProductRoutes from './routes/agentProducts';
import marketplaceRoutes from './routes/marketplace';
import aiAgentRoutes from './routes/aiAgents';
import tradeDecisionRoutes from './routes/tradeDecisions';
import analyticsRoutes from './routes/analyticsRoutes';

// Import agent system
import { AgentManager, AgentManagerConfig } from './agents/AgentManager';
import { AgentProduct } from './models/AgentProduct';
import { internalMarketplace } from './market/InternalMarketplace';

// Load environment variables
dotenv.config();

class App {
  public app: express.Application;
  public server: any;
  public io: SocketIOServer;
  public agentManager!: AgentManager;
  private port: string | number;

  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    // Create HTTP server
    this.server = createServer(this.app);
    
    // Initialize Socket.IO
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3001",
        methods: ["GET", "POST"]
      }
    });

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandlers();
    this.initializeWebSockets();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3001",
      credentials: true,
    }));

    // Compression
    this.app.use(compression());

    // Logging
    this.app.use(morgan('combined', { stream: loggerStream }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Trust proxy for production deployment
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    // Health check
    this.app.use('/health', healthRoutes);

    // API routes
    this.app.use('/api/v1/inventory', inventoryRoutes);
    this.app.use('/api/v1/trades', tradeRoutes);
    this.app.use('/api/v1/products', agentProductRoutes); // Now returns agent-products
    this.app.use('/api/v1/legacy-products', productRoutes); // Keep old products for reference
    this.app.use('/api/v1/stores', storeRoutes);
    this.app.use('/api/v1/agents', agentRoutes);
    this.app.use('/api/v1/marketplace', marketplaceRoutes); // New marketplace API
    this.app.use('/api/v1/ai-agents', aiAgentRoutes); // New AI agent API integration
    this.app.use('/api/v1/trade-decisions', tradeDecisionRoutes); // Trade decision tracking
    this.app.use('/api/v1/trade-decisions', tradeDecisionRoutes); // New trade decisions API
    this.app.use('/api/v1/analytics', analyticsRoutes); // New analytics API integration

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'AI Inventory Arbitrage Network API',
        version: '1.0.0',
        status: 'operational',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          inventory: '/api/v1/inventory',
          trades: '/api/v1/trades',
          products: '/api/v1/products',
          stores: '/api/v1/stores',
        }
      });
    });
  }

  private initializeErrorHandlers(): void {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Global error handler
    this.app.use(errorHandler);
  }

  private initializeWebSockets(): void {
    this.io.on('connection', (socket) => {
      logger.info(`WebSocket client connected: ${socket.id}`);

      socket.on('join-room', (room: string) => {
        socket.join(room);
        logger.info(`Client ${socket.id} joined room: ${room}`);
      });

      socket.on('leave-room', (room: string) => {
        socket.leave(room);
        logger.info(`Client ${socket.id} left room: ${room}`);
      });

      socket.on('disconnect', () => {
        logger.info(`WebSocket client disconnected: ${socket.id}`);
      });
    });
  }

  public async connectDatabases(): Promise<void> {
    try {
      // Connect to MongoDB
      await db.connect();
      logger.info('MongoDB connected successfully');

      // Connect to KeyDB
      await keydb.connect();
      logger.info('KeyDB connected successfully');

      // Initialize Agent Manager
      await this.initializeAgentManager();

    } catch (error) {
      logger.error('Failed to connect to databases:', error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      // Connect to databases
      await this.connectDatabases();

      // Start the server
      this.server.listen(this.port, () => {
        logger.info(`Server running on port ${this.port}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`WebSocket server initialized`);
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      // Close WebSocket connections
      this.io.close();

      // Disconnect from databases
      await keydb.disconnect();
      await db.disconnect();

      // Close HTTP server
      this.server.close();

      logger.info('Server stopped gracefully');
    } catch (error) {
      logger.error('Error stopping server:', error);
      throw error;
    }
  }

  private async initializeAgentManager(): Promise<void> {
    try {
      // First, start all AgentProducts (self-contained agents)
      await this.startAgentProducts();

      // Initialize marketplace system
      await this.initializeMarketplace();

      // Then initialize the legacy agent manager for monitoring
      const agentConfig: AgentManagerConfig = {
        maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '50'),
        agentCheckInterval: parseInt(process.env.AGENT_CHECK_INTERVAL || '30000'), // 30 seconds
        messageRouting: {
          defaultTimeout: parseInt(process.env.MESSAGE_TIMEOUT || '5000'),
          retryAttempts: parseInt(process.env.MESSAGE_RETRY_ATTEMPTS || '3')
        },
        productAgentDefaults: {
          decisionInterval: parseInt(process.env.AGENT_DECISION_INTERVAL || '60000'), // 1 minute
          maxConcurrentActions: parseInt(process.env.MAX_CONCURRENT_ACTIONS || '5'),
          thresholds: {
            lowStockThreshold: parseFloat(process.env.LOW_STOCK_THRESHOLD || '50'),
            highStockThreshold: parseFloat(process.env.HIGH_STOCK_THRESHOLD || '500'),
            minProfitMargin: parseFloat(process.env.MIN_PROFIT_MARGIN || '15'),
            maxTransportCostRatio: parseFloat(process.env.MAX_TRANSPORT_COST_RATIO || '0.1')
          },
          forecastingConfig: {
            lookAheadDays: parseInt(process.env.FORECAST_LOOKAHEAD_DAYS || '30'),
            confidenceThreshold: parseFloat(process.env.FORECAST_CONFIDENCE_THRESHOLD || '0.7'),
            updateInterval: parseInt(process.env.FORECAST_UPDATE_INTERVAL || '300000') // 5 minutes
          }
        }
      };

      this.agentManager = new AgentManager(agentConfig);
      
      // Set up agent manager event listeners (for monitoring)
      this.setupAgentManagerEventListeners();
      
      // Initialize for monitoring purposes only
      await this.agentManager.initialize();
      
      // Make agent manager available to routes
      initializeAgentManager(this.agentManager);
      
      logger.info('Agent system initialized successfully', {
        agentProducts: await AgentProduct.countDocuments({ isActive: true }),
        legacyAgents: this.agentManager.agentCount
      });

    } catch (error) {
      logger.error('Failed to initialize Agent Manager:', error);
      throw error;
    }
  }

  private async startAgentProducts(): Promise<void> {
    try {
      // Get all active agent products
      const agentProducts = await AgentProduct.find({ 
        isActive: true,
        'agentState.status': { $ne: 'active' }
      });

      logger.info(`Starting ${agentProducts.length} AgentProducts...`);

      let started = 0;
      for (const agentProduct of agentProducts) {
        try {
          await agentProduct.startAgent();
          started++;
        } catch (error) {
          logger.error(`Failed to start AgentProduct ${agentProduct.productId}:`, error);
        }
      }

      logger.info(`Successfully started ${started} AgentProducts`);

    } catch (error) {
      logger.error('Failed to start AgentProducts:', error);
      throw error;
    }
  }

  private setupAgentManagerEventListeners(): void {
    this.agentManager.on('agentCreated', (data) => {
      logger.info(`Agent created: ${data.agentId}`, data);
      // Emit to WebSocket clients
      this.io.emit('agentCreated', data);
    });

    this.agentManager.on('agentRemoved', (data) => {
      logger.info(`Agent removed: ${data.agentId}`, data);
      this.io.emit('agentRemoved', data);
    });

    this.agentManager.on('agentError', (data) => {
      logger.error(`Agent error: ${data.agentId}`, data.error);
      this.io.emit('agentError', data);
    });

    this.agentManager.on('agentActionCompleted', (data) => {
      logger.debug(`Agent action completed: ${data.agentId}`, data);
      this.io.emit('agentActionCompleted', data);
    });

    this.agentManager.on('agentActionFailed', (data) => {
      logger.warn(`Agent action failed: ${data.agentId}`, data);
      this.io.emit('agentActionFailed', data);
    });

    this.agentManager.on('healthCheck', (data) => {
      logger.debug('Agent Manager health check', data);
      this.io.emit('agentHealthCheck', data);
    });
  }

  private async initializeMarketplace(): Promise<void> {
    try {
      // Set up marketplace event listeners for WebSocket broadcasting
      internalMarketplace.on('bidSubmitted', (bid) => {
        this.io.emit('marketBidSubmitted', bid);
        logger.debug('Market bid submitted', { bidId: bid.id, productId: bid.productId });
      });

      internalMarketplace.on('matchCreated', (match) => {
        this.io.emit('marketMatchCreated', match);
        logger.info('Market match created', { 
          matchId: match.id, 
          productId: match.buyBid.productId,
          profit: match.estimatedProfit 
        });
      });

      internalMarketplace.on('negotiationStarted', (negotiation) => {
        this.io.emit('negotiationStarted', negotiation);
        logger.debug('Negotiation started', { 
          negotiationId: negotiation.negotiationId,
          participants: [negotiation.initiator, negotiation.target]
        });
      });

      internalMarketplace.on('negotiationCompleted', (result) => {
        this.io.emit('negotiationCompleted', result);
        logger.info('Negotiation completed', { 
          negotiationId: result.negotiationId,
          agreedPrice: result.agreedTerms?.finalPrice 
        });
      });

      internalMarketplace.on('transferExecuted', (transfer) => {
        this.io.emit('transferExecuted', transfer);
        logger.info('Transfer executed via marketplace', { 
          transferId: transfer.transferId,
          productId: transfer.subject.productId,
          quantity: transfer.subject.quantity
        });
      });

      // Trigger initial marketplace participation for all active agents
      const activeAgents = await AgentProduct.find({ 
        isActive: true,
        'agentState.status': 'active' 
      });

      logger.info(`Initializing marketplace participation for ${activeAgents.length} active agents`);

      // Schedule periodic market participation
      setInterval(async () => {
        try {
          const agents = await AgentProduct.find({ 
            isActive: true,
            'agentState.status': 'active' 
          }).limit(10); // Process 10 agents at a time

          for (const agent of agents) {
            try {
              await agent.participateInMarket();
            } catch (error) {
              logger.debug(`Market participation failed for agent ${agent.productId}:`, error);
            }
          }
        } catch (error) {
          logger.error('Scheduled market participation failed:', error);
        }
      }, 5 * 60 * 1000); // Every 5 minutes

      logger.info('Internal marketplace initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize marketplace:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down application...');
    
    try {
      // Shutdown agent manager first
      if (this.agentManager) {
        await this.agentManager.shutdown();
        logger.info('Agent Manager shutdown completed');
      }

      // Close WebSocket server
      if (this.io) {
        this.io.close();
        logger.info('WebSocket server closed');
      }

      // Close HTTP server
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => {
            logger.info('HTTP server closed');
            resolve();
          });
        });
      }

      // Close database connections
      await db.disconnect();
      await keydb.disconnect();
      logger.info('Database connections closed');

      logger.info('Application shutdown completed');
    } catch (error) {
      logger.error('Error during shutdown:', error);
      throw error;
    }
  }
}

// Create and export app instance
const app = new App();

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, starting graceful shutdown...');
  try {
    await app.shutdown();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, starting graceful shutdown...');
  try {
    await app.shutdown();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  app.start().catch((error) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
  });
}

export default app;
