import Redis from 'ioredis';
import { logger } from '../utils/logger';

export class KeyDBConnection {
  private static instance: KeyDBConnection;
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;

  private constructor() {}

  public static getInstance(): KeyDBConnection {
    if (!KeyDBConnection.instance) {
      KeyDBConnection.instance = new KeyDBConnection();
    }
    return KeyDBConnection.instance;
  }

  public async connect(): Promise<void> {
    try {
      const config = {
        host: process.env.KEYDB_HOST || 'localhost',
        port: parseInt(process.env.KEYDB_PORT || '6379'),
        password: process.env.KEYDB_PASSWORD || undefined,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      };

      // Main client for general operations
      this.client = new Redis(config);
      
      // Separate connections for pub/sub
      this.subscriber = new Redis(config);
      this.publisher = new Redis(config);

      // Connect all clients
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);

      // Set up event handlers
      this.setupEventHandlers();

      logger.info('KeyDB connected successfully');
    } catch (error) {
      logger.error('Failed to connect to KeyDB:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.client || !this.subscriber || !this.publisher) return;

    // Main client events
    this.client.on('error', (error) => {
      logger.error('KeyDB client error:', error);
    });

    this.client.on('connect', () => {
      logger.info('KeyDB client connected');
    });

    this.client.on('ready', () => {
      logger.info('KeyDB client ready');
    });

    this.client.on('close', () => {
      logger.warn('KeyDB client connection closed');
    });

    // Subscriber events
    this.subscriber.on('error', (error) => {
      logger.error('KeyDB subscriber error:', error);
    });

    // Publisher events
    this.publisher.on('error', (error) => {
      logger.error('KeyDB publisher error:', error);
    });
  }

  public getClient(): Redis {
    if (!this.client) {
      throw new Error('KeyDB client not initialized. Call connect() first.');
    }
    return this.client;
  }

  public getSubscriber(): Redis {
    if (!this.subscriber) {
      throw new Error('KeyDB subscriber not initialized. Call connect() first.');
    }
    return this.subscriber;
  }

  public getPublisher(): Redis {
    if (!this.publisher) {
      throw new Error('KeyDB publisher not initialized. Call connect() first.');
    }
    return this.publisher;
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.client = null;
      }
      if (this.subscriber) {
        await this.subscriber.quit();
        this.subscriber = null;
      }
      if (this.publisher) {
        await this.publisher.quit();
        this.publisher = null;
      }
      logger.info('KeyDB disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from KeyDB:', error);
      throw error;
    }
  }

  public async ping(): Promise<string> {
    return await this.getClient().ping();
  }

  public isConnected(): boolean {
    return this.client?.status === 'ready' && 
           this.subscriber?.status === 'ready' && 
           this.publisher?.status === 'ready';
  }
}

export const keydb = KeyDBConnection.getInstance();
