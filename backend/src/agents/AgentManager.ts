import { EventEmitter } from 'events';
import { ProductAgent, ProductAgentConfig } from './ProductAgent';
import { BaseAgent, AgentMessage } from './BaseAgent';
import { Product } from '../models/Product';
import { keydb } from '../config/keydb';
import { logger } from '../utils/logger';

export interface AgentManagerConfig {
  maxConcurrentAgents: number;
  agentCheckInterval: number;
  messageRouting: {
    defaultTimeout: number;
    retryAttempts: number;
  };
  productAgentDefaults: {
    decisionInterval: number;
    maxConcurrentActions: number;
    thresholds: {
      lowStockThreshold: number;
      highStockThreshold: number;
      minProfitMargin: number;
      maxTransportCostRatio: number;
    };
    forecastingConfig: {
      lookAheadDays: number;
      confidenceThreshold: number;
      updateInterval: number;
    };
  };
}

export class AgentManager extends EventEmitter {
  private config: AgentManagerConfig;
  private agents: Map<string, BaseAgent> = new Map();
  private messageRouter: Map<string, string[]> = new Map(); // topic -> agent IDs
  private isRunning: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: AgentManagerConfig) {
    super();
    this.config = config;
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize message routing through KeyDB
      await this.initializeMessageRouting();

      // Create product agents for all active products
      await this.createProductAgents();

      this.isRunning = true;
      this.startHealthChecks();

      logger.info('AgentManager initialized successfully', {
        agentCount: this.agents.size,
        maxConcurrentAgents: this.config.maxConcurrentAgents
      });

    } catch (error) {
      logger.error('Failed to initialize AgentManager:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.isRunning = false;

      // Stop health checks
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }

      // Stop all agents
      const stopPromises = Array.from(this.agents.values()).map(agent => 
        agent.stop().catch(error => 
          logger.error(`Error stopping agent ${agent.id}:`, error)
        )
      );

      await Promise.all(stopPromises);
      this.agents.clear();

      logger.info('AgentManager shutdown completed');

    } catch (error) {
      logger.error('Error during AgentManager shutdown:', error);
      throw error;
    }
  }

  async createProductAgent(productId: string, customConfig?: Partial<ProductAgentConfig>): Promise<ProductAgent> {
    if (this.agents.has(`product_${productId}`)) {
      throw new Error(`Product agent for ${productId} already exists`);
    }

    if (this.agents.size >= this.config.maxConcurrentAgents) {
      throw new Error('Maximum number of concurrent agents reached');
    }

    const agentConfig: ProductAgentConfig = {
      id: `product_${productId}`,
      type: 'product_agent',
      name: `Product Agent for ${productId}`,
      enabled: true,
      productId,
      decisionInterval: this.config.productAgentDefaults.decisionInterval,
      maxConcurrentActions: this.config.productAgentDefaults.maxConcurrentActions,
      thresholds: { ...this.config.productAgentDefaults.thresholds },
      forecastingConfig: { ...this.config.productAgentDefaults.forecastingConfig },
      ...customConfig
    };

    const agent = new ProductAgent(agentConfig);
    
    // Set up message routing for this agent
    this.setupAgentMessageRouting(agent);
    
    // Add to agents map
    this.agents.set(agent.id, agent);

    try {
      await agent.start();
      
      logger.info(`Product agent created for ${productId}`, {
        agentId: agent.id,
        totalAgents: this.agents.size
      });

      this.emit('agentCreated', { agentId: agent.id, productId });
      return agent;

    } catch (error) {
      this.agents.delete(agent.id);
      throw error;
    }
  }

  async removeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      logger.warn(`Agent ${agentId} not found for removal`);
      return;
    }

    try {
      await agent.stop();
      this.agents.delete(agentId);
      
      logger.info(`Agent ${agentId} removed`, {
        remainingAgents: this.agents.size
      });

      this.emit('agentRemoved', { agentId });

    } catch (error) {
      logger.error(`Error removing agent ${agentId}:`, error);
      throw error;
    }
  }

  async broadcastMessage(message: Omit<AgentMessage, 'id' | 'from' | 'timestamp'>): Promise<void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: this.generateId(),
      from: 'agent_manager',
      timestamp: new Date()
    };

    if (message.to === 'all') {
      // Broadcast to all agents
      const promises = Array.from(this.agents.values()).map(agent =>
        agent.receiveMessage(fullMessage).catch(error =>
          logger.error(`Error sending message to agent ${agent.id}:`, error)
        )
      );
      await Promise.all(promises);
    } else {
      // Send to specific agent or topic subscribers
      const targetAgents = this.resolveMessageTargets(message.to);
      const promises = targetAgents.map(agentId => {
        const agent = this.agents.get(agentId);
        return agent ? agent.receiveMessage(fullMessage) : Promise.resolve();
      });
      await Promise.all(promises);
    }

    logger.debug('Message broadcasted', {
      messageId: fullMessage.id,
      type: fullMessage.type,
      to: fullMessage.to,
      targetCount: message.to === 'all' ? this.agents.size : this.resolveMessageTargets(message.to).length
    });
  }

  getAgentStatus(): Array<{
    id: string;
    type: string;
    isActive: boolean;
    activeActions: number;
    recentDecisions: number;
  }> {
    return Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      type: agent.type,
      isActive: agent.isActive,
      activeActions: agent.activeActionCount,
      recentDecisions: agent.recentDecisions.length
    }));
  }

  getAgentById(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  getProductAgent(productId: string): ProductAgent | undefined {
    const agent = this.agents.get(`product_${productId}`);
    return agent instanceof ProductAgent ? agent : undefined;
  }

  // Private methods
  private async createProductAgents(): Promise<void> {
    try {
      // Get all active products
      const products = await Product.find({ isActive: true }).limit(50); // Start with 50 products
      
      logger.info(`Creating product agents for ${products.length} products`);

      const createPromises = products.map(async (product) => {
        try {
          await this.createProductAgent(product.productId);
        } catch (error) {
          logger.error(`Failed to create agent for product ${product.productId}:`, error);
        }
      });

      await Promise.all(createPromises);

      logger.info(`Successfully created ${this.agents.size} product agents`);

    } catch (error) {
      logger.error('Error creating product agents:', error);
      throw error;
    }
  }

  private async initializeMessageRouting(): Promise<void> {
    // Initialize KeyDB pub/sub for inter-agent communication
    const publisher = keydb.getPublisher();
    const subscriber = keydb.getSubscriber();

    // Subscribe to agent communication channels
    await subscriber.subscribe('agent:messages');
    
    subscriber.on('message', async (channel, message) => {
      try {
        const agentMessage: AgentMessage = JSON.parse(message);
        await this.routeMessage(agentMessage);
      } catch (error) {
        logger.error('Error routing message from KeyDB:', error);
      }
    });

    logger.info('Message routing initialized');
  }

  private setupAgentMessageRouting(agent: BaseAgent): void {
    // Listen for messages from this agent
    agent.on('message', async (message: AgentMessage) => {
      try {
        // Publish message to KeyDB for routing
        const publisher = keydb.getPublisher();
        await publisher.publish('agent:messages', JSON.stringify(message));
      } catch (error) {
        logger.error(`Error publishing message from agent ${agent.id}:`, error);
      }
    });

    // Listen for agent lifecycle events
    agent.on('started', (data) => this.emit('agentStarted', data));
    agent.on('stopped', (data) => this.emit('agentStopped', data));
    agent.on('error', (error) => this.emit('agentError', { agentId: agent.id, error }));
    agent.on('actionCompleted', (data) => this.emit('agentActionCompleted', data));
    agent.on('actionFailed', (data) => this.emit('agentActionFailed', data));
  }

  private async routeMessage(message: AgentMessage): Promise<void> {
    try {
      if (message.to === 'all') {
        await this.broadcastMessage(message);
      } else {
        const targetAgents = this.resolveMessageTargets(message.to);
        
        for (const agentId of targetAgents) {
          const agent = this.agents.get(agentId);
          if (agent) {
            await agent.receiveMessage(message);
          }
        }
      }
    } catch (error) {
      logger.error(`Error routing message ${message.id}:`, error);
    }
  }

  private resolveMessageTargets(target: string): string[] {
    // Handle different target types
    if (target.startsWith('product_')) {
      return [target];
    }
    
    if (target === 'product_agents') {
      return Array.from(this.agents.keys()).filter(id => id.startsWith('product_'));
    }

    if (target === 'operations_team') {
      // In a real system, this would route to human operators
      logger.info('Message targeted to operations team', { target });
      return [];
    }

    // Check topic subscriptions
    return this.messageRouter.get(target) || [];
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health check error:', error);
      }
    }, this.config.agentCheckInterval);
  }

  private async performHealthCheck(): Promise<void> {
    const inactiveAgents: string[] = [];
    
    for (const [agentId, agent] of this.agents.entries()) {
      if (!agent.isActive) {
        inactiveAgents.push(agentId);
      }
    }

    if (inactiveAgents.length > 0) {
      logger.warn(`Found ${inactiveAgents.length} inactive agents`, {
        inactiveAgents
      });

      // Attempt to restart inactive agents
      for (const agentId of inactiveAgents) {
        try {
          const agent = this.agents.get(agentId);
          if (agent) {
            await agent.start();
            logger.info(`Restarted inactive agent ${agentId}`);
          }
        } catch (error) {
          logger.error(`Failed to restart agent ${agentId}:`, error);
        }
      }
    }

    // Emit health status
    this.emit('healthCheck', {
      totalAgents: this.agents.size,
      activeAgents: this.agents.size - inactiveAgents.length,
      inactiveAgents: inactiveAgents.length
    });
  }

  private setupEventHandlers(): void {
    this.on('agentError', (data) => {
      logger.error(`Agent error from ${data.agentId}:`, data.error);
    });

    this.on('agentActionCompleted', (data) => {
      logger.debug(`Agent ${data.agentId} completed action`, {
        actionType: data.action.type,
        actionId: data.action.id
      });
    });

    this.on('agentActionFailed', (data) => {
      logger.warn(`Agent ${data.agentId} action failed`, {
        actionType: data.action.type,
        actionId: data.action.id,
        error: data.error
      });
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Getters
  get agentCount(): number {
    return this.agents.size;
  }

  get isActive(): boolean {
    return this.isRunning;
  }
}
