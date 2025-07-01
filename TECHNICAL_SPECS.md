# Project Structure and Technical Specifications

## Recommended Project Directory Structure

```
arbitrage-system/
├── README.md
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── docs/
│   ├── api/
│   ├── architecture/
│   └── user-guide/
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   │   ├── base/
│   │   │   │   ├── BaseAgent.ts
│   │   │   │   └── AgentCommunication.ts
│   │   │   ├── product/
│   │   │   │   ├── ProductAgent.ts
│   │   │   │   └── DemandForecaster.ts
│   │   │   ├── location/
│   │   │   │   └── LocationAgent.ts
│   │   │   ├── transport/
│   │   │   │   └── TransportAgent.ts
│   │   │   └── orchestrator/
│   │   │       └── CentralOrchestrator.ts
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── inventory.ts
│   │   │   │   ├── trades.ts
│   │   │   │   ├── analytics.ts
│   │   │   │   └── auth.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── validation.ts
│   │   │   │   └── rateLimit.ts
│   │   │   └── controllers/
│   │   ├── database/
│   │   │   ├── models/
│   │   │   │   ├── Inventory.ts
│   │   │   │   ├── Product.ts
│   │   │   │   ├── Store.ts
│   │   │   │   └── Trade.ts
│   │   │   ├── repositories/
│   │   │   └── migrations/
│   │   ├── services/
│   │   │   ├── InventoryService.ts
│   │   │   ├── TradeService.ts
│   │   │   ├── AnalyticsService.ts
│   │   │   └── NotificationService.ts
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   ├── validation.ts
│   │   │   └── helpers.ts
│   │   ├── config/
│   │   │   ├── database.ts
│   │   │   ├── redis.ts
│   │   │   └── gemini.ts
│   │   └── app.ts
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Layout.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── InventoryOverview.tsx
│   │   │   │   ├── TradeProposals.tsx
│   │   │   │   └── Analytics.tsx
│   │   │   ├── inventory/
│   │   │   │   ├── InventoryTable.tsx
│   │   │   │   ├── LocationMap.tsx
│   │   │   │   └── ProductDetails.tsx
│   │   │   └── trades/
│   │   │       ├── TradeList.tsx
│   │   │       ├── TradeApproval.tsx
│   │   │       └── TradeHistory.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useInventory.ts
│   │   │   └── useTrades.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── websocket.ts
│   │   │   └── auth.ts
│   │   ├── store/
│   │   │   ├── slices/
│   │   │   │   ├── inventorySlice.ts
│   │   │   │   ├── tradesSlice.ts
│   │   │   │   └── authSlice.ts
│   │   │   └── index.ts
│   │   ├── types/
│   │   │   ├── inventory.ts
│   │   │   ├── trades.ts
│   │   │   └── api.ts
│   │   ├── utils/
│   │   │   ├── formatters.ts
│   │   │   ├── constants.ts
│   │   │   └── helpers.ts
│   │   ├── styles/
│   │   │   ├── globals.css
│   │   │   └── components/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── tests/
│   └── package.json
├── data-generator/
│   ├── src/
│   │   ├── generators/
│   │   │   ├── InventoryGenerator.ts
│   │   │   ├── ProductGenerator.ts
│   │   │   └── StoreGenerator.ts
│   │   ├── scripts/
│   │   │   ├── generateTestData.ts
│   │   │   └── seedDatabase.ts
│   │   └── config/
│   └── package.json
├── infrastructure/
│   ├── docker/
│   │   ├── Dockerfile.backend
│   │   ├── Dockerfile.frontend
│   │   └── Dockerfile.data-generator
│   ├── kubernetes/
│   │   ├── backend-deployment.yaml
│   │   ├── frontend-deployment.yaml
│   │   └── services.yaml
│   ├── terraform/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── monitoring/
│       ├── grafana/
│       └── prometheus/
└── workflows/
    ├── n8n/
    │   ├── inventory-sync.json
    │   ├── trade-execution.json
    │   └── alert-management.json
    └── scripts/
        ├── deploy.sh
        ├── backup.sh
        └── monitor.sh
```

## Core Data Models

### Inventory Model
```typescript
interface Inventory {
  id: string;
  storeId: string;
  productId: string;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  cost: number;
  retailPrice: number;
  location: {
    latitude: number;
    longitude: number;
  };
  lastUpdated: Date;
  reorderPoint: number;
  maxCapacity: number;
  turnoverRate: number;
  demandForecast: {
    period: string;
    predictedDemand: number;
    confidence: number;
  }[];
}
```

### Trade Model
```typescript
interface Trade {
  id: string;
  status: 'proposed' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  fromStoreId: string;
  toStoreId: string;
  productId: string;
  sku: string;
  quantity: number;
  estimatedProfit: number;
  transportCost: number;
  urgencyScore: number;
  proposedBy: string; // Agent ID
  approvedBy?: string; // User ID
  proposedAt: Date;
  scheduledAt?: Date;
  completedAt?: Date;
  reasoning: string;
  constraints: {
    maxTransportCost: number;
    minProfitMargin: number;
    deliveryDeadline: Date;
  };
}
```

### Product Agent Model
```typescript
interface ProductAgent {
  id: string;
  productId: string;
  category: string;
  status: 'active' | 'paused' | 'stopped';
  config: {
    forecastHorizon: number;
    minProfitThreshold: number;
    maxTradesPerDay: number;
    cooldownPeriod: number;
  };
  performance: {
    totalTrades: number;
    successfulTrades: number;
    averageProfit: number;
    forecastAccuracy: number;
  };
  lastActivity: Date;
  currentObjectives: string[];
}
```

## API Specifications

### Core API Endpoints

#### Inventory Management
```
GET    /api/v1/inventory              # List all inventory
GET    /api/v1/inventory/:id          # Get specific inventory item
PUT    /api/v1/inventory/:id          # Update inventory
POST   /api/v1/inventory/bulk-update  # Bulk inventory updates
GET    /api/v1/inventory/search       # Search inventory with filters
GET    /api/v1/inventory/analytics    # Inventory analytics
```

#### Trade Management
```
GET    /api/v1/trades                 # List all trades
POST   /api/v1/trades                 # Create new trade proposal
GET    /api/v1/trades/:id             # Get trade details
PUT    /api/v1/trades/:id/approve     # Approve trade
PUT    /api/v1/trades/:id/reject      # Reject trade
GET    /api/v1/trades/pending         # Get pending approvals
GET    /api/v1/trades/analytics       # Trade analytics
```

#### AI Agents
```
GET    /api/v1/agents                 # List all agents
GET    /api/v1/agents/:id             # Get agent details
PUT    /api/v1/agents/:id/config      # Update agent configuration
POST   /api/v1/agents/:id/pause       # Pause agent
POST   /api/v1/agents/:id/resume      # Resume agent
GET    /api/v1/agents/:id/performance # Agent performance metrics
```

#### Analytics & Reporting
```
GET    /api/v1/analytics/dashboard    # Dashboard metrics
GET    /api/v1/analytics/inventory    # Inventory performance
GET    /api/v1/analytics/trades       # Trade performance
GET    /api/v1/analytics/agents       # Agent performance
GET    /api/v1/analytics/forecast     # Demand forecasts
POST   /api/v1/reports/generate       # Generate custom reports
```

## AI Agent Specifications

### Base Agent Interface
```typescript
interface BaseAgent {
  id: string;
  type: 'product' | 'location' | 'transport' | 'orchestrator';
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  processMessage(message: AgentMessage): Promise<void>;
  sendMessage(targetAgent: string, message: AgentMessage): Promise<void>;
  getStatus(): AgentStatus;
  getPerformanceMetrics(): AgentMetrics;
}
```

### Product Agent Capabilities
```typescript
class ProductAgent extends BaseAgent {
  // Core functions
  async forecastDemand(storeId: string, horizon: number): Promise<DemandForecast>;
  async calculateArbitrageOpportunity(fromStore: string, toStore: string): Promise<ArbitrageOpportunity>;
  async proposeTrade(opportunity: ArbitrageOpportunity): Promise<TradeProposal>;
  async evaluateTradeOutcome(tradeId: string): Promise<TradeEvaluation>;
  
  // Learning functions
  async updateForecastModel(newData: SalesData[]): Promise<void>;
  async adaptToMarketConditions(conditions: MarketConditions): Promise<void>;
  async learneFromTradeOutcomes(outcomes: TradeOutcome[]): Promise<void>;
}
```

## Database Schemas

### MongoDB Collections

#### Products Collection
```javascript
{
  _id: ObjectId,
  productId: String,
  name: String,
  category: String,
  subcategory: String,
  brand: String,
  description: String,
  attributes: {
    weight: Number,
    dimensions: Object,
    perishable: Boolean,
    seasonality: Array
  },
  pricing: {
    baseCost: Number,
    standardRetail: Number,
    marginTargets: Object
  },
  substitutes: Array,
  complements: Array,
  createdAt: Date,
  updatedAt: Date
}
```

#### Stores Collection
```javascript
{
  _id: ObjectId,
  storeId: String,
  name: String,
  location: {
    type: "Point",
    coordinates: [longitude, latitude]
  },
  address: Object,
  capacity: Number,
  operatingHours: Object,
  demographics: Object,
  seasonalPatterns: Array,
  transportConnections: Array,
  performanceMetrics: Object,
  createdAt: Date,
  updatedAt: Date
}
```

### KeyDB Data Structures

#### Real-time Inventory (Hash)
```
Key: inventory:{storeId}:{productId}
Fields:
  quantity: 150
  reserved: 25
  lastUpdated: 1625097600
  cost: 12.50
  retail: 18.99
  reorderPoint: 30
```

#### Agent Status (Hash)
```
Key: agent:{agentId}
Fields:
  status: active
  lastHeartbeat: 1625097600
  tasksInProgress: 3
  performance: 0.85
  config: {...}
```

#### Trade Queue (List)
```
Key: trades:pending
Values: [tradeId1, tradeId2, tradeId3, ...]
```

## Integration Specifications

### Gemini AI Integration
```typescript
class GeminiAgent {
  private client: GeminiClient;
  
  async generateForecast(data: InventoryData): Promise<DemandForecast> {
    const prompt = this.buildForecastPrompt(data);
    const response = await this.client.generateContent(prompt);
    return this.parseForecastResponse(response);
  }
  
  async evaluateTradeOpportunity(opportunity: TradeData): Promise<TradeDecision> {
    const prompt = this.buildTradeEvaluationPrompt(opportunity);
    const response = await this.client.generateContent(prompt);
    return this.parseTradeDecision(response);
  }
}
```

### WebSocket Event Types
```typescript
interface WebSocketEvents {
  // Inventory events
  'inventory:updated': InventoryUpdate;
  'inventory:lowStock': LowStockAlert;
  'inventory:overstock': OverstockAlert;
  
  // Trade events
  'trade:proposed': TradeProposal;
  'trade:approved': TradeApproval;
  'trade:completed': TradeCompletion;
  'trade:failed': TradeFailure;
  
  // Agent events
  'agent:status': AgentStatusUpdate;
  'agent:performance': AgentPerformanceUpdate;
  'agent:alert': AgentAlert;
  
  // System events
  'system:maintenance': MaintenanceNotification;
  'system:error': SystemError;
}
```

## Security Specifications

### Authentication & Authorization
```typescript
interface UserRoles {
  'admin': {
    permissions: ['*'];
  };
  'manager': {
    permissions: [
      'inventory:read',
      'trades:read',
      'trades:approve',
      'analytics:read'
    ];
  };
  'operator': {
    permissions: [
      'inventory:read',
      'trades:read',
      'analytics:read'
    ];
  };
  'viewer': {
    permissions: [
      'inventory:read',
      'analytics:read'
    ];
  };
}
```

### Data Encryption
- **At Rest**: AES-256 encryption for sensitive data
- **In Transit**: TLS 1.3 for all API communications
- **API Keys**: Stored in encrypted key vault
- **Database**: Field-level encryption for PII

## Monitoring & Alerting

### Key Metrics to Monitor
```typescript
interface SystemMetrics {
  // Performance metrics
  apiResponseTime: number;
  databaseQueryTime: number;
  agentProcessingTime: number;
  systemThroughput: number;
  
  // Business metrics
  inventoryTurnover: number;
  tradeSuccessRate: number;
  costSavings: number;
  stockoutReduction: number;
  
  // System health
  uptime: number;
  errorRate: number;
  agentHealth: AgentHealth[];
  resourceUtilization: ResourceUsage;
}
```

### Alert Conditions
```typescript
interface AlertConditions {
  critical: {
    systemDown: boolean;
    dataCorruption: boolean;
    securityBreach: boolean;
    agentMalfunction: boolean;
  };
  warning: {
    highLatency: number; // > 5 seconds
    lowAgentPerformance: number; // < 70%
    unusualTradePatterns: boolean;
    resourceThreshold: number; // > 80%
  };
  info: {
    deploymentComplete: boolean;
    maintenanceScheduled: boolean;
    performanceReport: boolean;
  };
}
```

This technical specification provides the detailed foundation needed to implement the AI Inventory Arbitrage Network system according to the requirements outlined in both reports.
