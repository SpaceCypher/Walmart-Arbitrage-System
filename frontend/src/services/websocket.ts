import { io, Socket } from 'socket.io-client';
import { WebSocketEvent } from '../types/api';

export interface SocketCallbacks {
  onAgentUpdate?: (data: any) => void;
  onMarketUpdate?: (data: any) => void;
  onBidPlaced?: (data: any) => void;
  onMatchFound?: (data: any) => void;
  onAIInsightsUpdate?: (data: any) => void;
  onMetricsUpdate?: (data: any) => void;
  onError?: (error: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private callbacks: SocketCallbacks = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;

  constructor() {
    this.connect();
  }

  connect() {
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';
    
    this.socket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: this.reconnectInterval,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.callbacks.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.callbacks.onDisconnect?.();
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.callbacks.onError?.(error);
    });

    // Agent events
    this.socket.on('agent:update', (data) => {
      this.callbacks.onAgentUpdate?.(data);
    });

    this.socket.on('agent:started', (data) => {
      this.callbacks.onAgentUpdate?.(data);
    });

    this.socket.on('agent:stopped', (data) => {
      this.callbacks.onAgentUpdate?.(data);
    });

    this.socket.on('agent:metrics', (data) => {
      this.callbacks.onMetricsUpdate?.(data);
    });

    // Marketplace events
    this.socket.on('marketplace:update', (data) => {
      this.callbacks.onMarketUpdate?.(data);
    });

    this.socket.on('marketplace:bid-placed', (data) => {
      this.callbacks.onBidPlaced?.(data);
    });

    this.socket.on('marketplace:match-found', (data) => {
      this.callbacks.onMatchFound?.(data);
    });

    // AI insights events
    this.socket.on('ai:insights-update', (data) => {
      this.callbacks.onAIInsightsUpdate?.(data);
    });

    this.socket.on('ai:prediction-update', (data) => {
      this.callbacks.onAIInsightsUpdate?.(data);
    });

    // General metrics events
    this.socket.on('metrics:update', (data) => {
      this.callbacks.onMetricsUpdate?.(data);
    });
  }

  // Subscribe to events
  subscribe(callbacks: SocketCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Unsubscribe from events
  unsubscribe() {
    this.callbacks = {};
  }

  // Emit events
  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected, cannot emit event:', event);
    }
  }

  // Join a specific room (for agent-specific updates)
  joinRoom(room: string) {
    this.emit('join-room', { room });
  }

  // Leave a specific room
  leaveRoom(room: string) {
    this.emit('leave-room', { room });
  }

  // Get connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Reconnect manually
  reconnect() {
    if (this.socket) {
      this.socket.connect();
    } else {
      this.connect();
    }
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;
