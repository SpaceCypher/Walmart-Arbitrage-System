import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface AgentConfig {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  decisionInterval: number; // milliseconds
  maxConcurrentActions: number;
}

export interface AgentMessage {
  id: string;
  type: string;
  from: string;
  to: string;
  payload: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentDecision {
  id: string;
  agentId: string;
  type: string;
  confidence: number;
  reasoning: string;
  actions: AgentAction[];
  timestamp: Date;
}

export interface AgentAction {
  id: string;
  type: string;
  parameters: any;
  expectedOutcome: any;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export abstract class BaseAgent extends EventEmitter {
  protected config: AgentConfig;
  protected isRunning: boolean = false;
  protected messageQueue: AgentMessage[] = [];
  protected activeActions: Map<string, AgentAction> = new Map();
  protected decisionHistory: AgentDecision[] = [];
  private decisionTimer?: NodeJS.Timeout;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.setupEventHandlers();
  }

  // Abstract methods that must be implemented by subclasses
  abstract initialize(): Promise<void>;
  abstract makeDecision(): Promise<AgentDecision | null>;
  abstract processMessage(message: AgentMessage): Promise<void>;
  abstract cleanup(): Promise<void>;

  // Core agent lifecycle
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn(`Agent ${this.config.id} is already running`);
      return;
    }

    try {
      await this.initialize();
      this.isRunning = true;
      this.scheduleDecisionCycle();
      
      logger.info(`Agent ${this.config.id} started successfully`, {
        agentId: this.config.id,
        type: this.config.type,
        decisionInterval: this.config.decisionInterval
      });

      this.emit('started', { agentId: this.config.id });
    } catch (error) {
      logger.error(`Failed to start agent ${this.config.id}:`, error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.isRunning = false;
      
      if (this.decisionTimer) {
        clearTimeout(this.decisionTimer);
        this.decisionTimer = undefined;
      }

      // Wait for active actions to complete
      await this.waitForActiveActions();
      
      await this.cleanup();
      
      logger.info(`Agent ${this.config.id} stopped successfully`);
      this.emit('stopped', { agentId: this.config.id });
    } catch (error) {
      logger.error(`Error stopping agent ${this.config.id}:`, error);
      throw error;
    }
  }

  // Message handling
  async sendMessage(message: Omit<AgentMessage, 'id' | 'from' | 'timestamp'>): Promise<void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: this.generateId(),
      from: this.config.id,
      timestamp: new Date()
    };

    this.emit('message', fullMessage);
    logger.debug(`Agent ${this.config.id} sent message`, {
      messageId: fullMessage.id,
      type: fullMessage.type,
      to: fullMessage.to
    });
  }

  async receiveMessage(message: AgentMessage): Promise<void> {
    this.messageQueue.push(message);
    logger.debug(`Agent ${this.config.id} received message`, {
      messageId: message.id,
      type: message.type,
      from: message.from
    });

    // Process high priority messages immediately
    if (message.priority === 'critical' || message.priority === 'high') {
      await this.processMessage(message);
    }
  }

  // Decision making cycle
  private scheduleDecisionCycle(): void {
    if (!this.isRunning || !this.config.enabled) {
      return;
    }

    this.decisionTimer = setTimeout(async () => {
      try {
        await this.runDecisionCycle();
      } catch (error) {
        logger.error(`Decision cycle error for agent ${this.config.id}:`, error);
        this.emit('error', error);
      } finally {
        this.scheduleDecisionCycle();
      }
    }, this.config.decisionInterval);
  }

  private async runDecisionCycle(): Promise<void> {
    if (!this.isRunning || this.activeActions.size >= this.config.maxConcurrentActions) {
      return;
    }

    // Process queued messages
    await this.processMessageQueue();

    // Make decision
    const decision = await this.makeDecision();
    if (decision) {
      this.decisionHistory.push(decision);
      await this.executeDecision(decision);
    }
  }

  private async processMessageQueue(): Promise<void> {
    // Process messages in priority order
    this.messageQueue.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    const messagesToProcess = this.messageQueue.splice(0, 10); // Process up to 10 messages per cycle
    
    for (const message of messagesToProcess) {
      try {
        await this.processMessage(message);
      } catch (error) {
        logger.error(`Error processing message ${message.id}:`, error);
      }
    }
  }

  private async executeDecision(decision: AgentDecision): Promise<void> {
    logger.info(`Agent ${this.config.id} executing decision`, {
      decisionId: decision.id,
      type: decision.type,
      confidence: decision.confidence,
      actionsCount: decision.actions.length
    });

    for (const action of decision.actions) {
      if (this.activeActions.size >= this.config.maxConcurrentActions) {
        break;
      }

      action.status = 'executing';
      this.activeActions.set(action.id, action);
      
      try {
        await this.executeAction(action);
        action.status = 'completed';
        this.emit('actionCompleted', { agentId: this.config.id, action });
      } catch (error) {
        action.status = 'failed';
        logger.error(`Action ${action.id} failed:`, error);
        this.emit('actionFailed', { agentId: this.config.id, action, error });
      } finally {
        this.activeActions.delete(action.id);
      }
    }
  }

  protected abstract executeAction(action: AgentAction): Promise<void>;

  private async waitForActiveActions(): Promise<void> {
    const timeout = 30000; // 30 seconds timeout
    const startTime = Date.now();

    while (this.activeActions.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.activeActions.size > 0) {
      logger.warn(`Agent ${this.config.id} has ${this.activeActions.size} active actions after timeout`);
    }
  }

  private setupEventHandlers(): void {
    this.on('error', (error) => {
      logger.error(`Agent ${this.config.id} error:`, error);
    });
  }

  // Utility methods
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Getters
  get id(): string {
    return this.config.id;
  }

  get type(): string {
    return this.config.type;
  }

  get isActive(): boolean {
    return this.isRunning;
  }

  get activeActionCount(): number {
    return this.activeActions.size;
  }

  get recentDecisions(): AgentDecision[] {
    return this.decisionHistory.slice(-10); // Last 10 decisions
  }
}
