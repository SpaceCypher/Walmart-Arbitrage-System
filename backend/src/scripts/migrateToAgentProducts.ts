import dotenv from 'dotenv';
import { db } from '../config/database';
import { Product } from '../models/Product';
import { AgentProduct } from '../models/AgentProduct';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

async function migrateProductsToAgentProducts() {
  try {
    logger.info('Starting migration from Products to AgentProducts...');

    // Connect to database
    await db.connect();
    logger.info('Database connected');

    // Get all existing products
    const products = await Product.find({ isActive: true });
    logger.info(`Found ${products.length} products to migrate`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const product of products) {
      try {
        // Check if AgentProduct already exists
        const existingAgent = await AgentProduct.findOne({ productId: product.productId });
        if (existingAgent) {
          logger.debug(`Skipping ${product.productId} - already exists as AgentProduct`);
          skipped++;
          continue;
        }

        // Create new AgentProduct
        const agentProduct = new AgentProduct({
          productId: product.productId,
          
          // Map product data
          productData: {
            name: product.name,
            category: product.category,
            subcategory: product.subcategory,
            brand: product.brand,
            description: product.description,
            attributes: product.attributes,
            pricing: product.pricing,
            substitutes: product.substitutes || [],
            complements: product.complements || [],
            tags: product.tags || []
          },
          
          // Initialize agent state
          agentState: {
            status: 'initializing',
            lastDecisionAt: new Date(),
            currentStrategy: 'balanced_optimization',
            performanceMetrics: {
              successfulTransfers: 0,
              totalProfitGenerated: 0,
              averageDecisionConfidence: 0.5,
              transferSuccessRate: 0
            },
            learningData: {
              decisionHistory: [],
              marketPatterns: new Map(),
              seasonalAdjustments: new Map()
            }
          },
          
          // Default agent configuration
          agentConfig: {
            decisionInterval: parseInt(process.env.AGENT_DECISION_INTERVAL || '60000'),
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
              updateInterval: parseInt(process.env.FORECAST_UPDATE_INTERVAL || '300000')
            }
          },
          
          // Initialize empty arrays
          activeActions: [],
          recentDecisions: [],
          
          isActive: true
        });

        await agentProduct.save();
        migrated++;

        logger.debug(`Migrated product ${product.productId} to AgentProduct`);

      } catch (error) {
        failed++;
        logger.error(`Failed to migrate product ${product.productId}:`, error);
      }
    }

    logger.info('Migration completed', {
      total: products.length,
      migrated,
      skipped,
      failed
    });

    // Start all agents
    logger.info('Starting all agent products...');
    const agentProducts = await AgentProduct.find({ isActive: true });
    
    let started = 0;
    for (const agent of agentProducts) {
      try {
        await agent.startAgent();
        started++;
      } catch (error) {
        logger.error(`Failed to start agent ${agent.productId}:`, error);
      }
    }

    logger.info(`Started ${started} agent products`);

    // Summary
    console.log('\n📊 MIGRATION SUMMARY:');
    console.log(`✅ Successfully migrated: ${migrated} products`);
    console.log(`⏭️  Skipped (already exists): ${skipped} products`);
    console.log(`❌ Failed: ${failed} products`);
    console.log(`🚀 Started agents: ${started} agents`);
    console.log('\n🎉 Products are now AI Agents!\n');

  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    await db.disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateProductsToAgentProducts()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateProductsToAgentProducts };
