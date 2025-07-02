import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function fixTradeDecisionsCollection() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    logger.info('Connected to MongoDB Atlas');

    const db = mongoose.connection.db;
    
    // Drop the existing tradeDecisions collection to remove old indexes
    try {
      await db.collection('tradeDecisions').drop();
      logger.info('Dropped existing tradeDecisions collection');
    } catch (error: any) {
      if (error.codeName === 'NamespaceNotFound') {
        logger.info('tradeDecisions collection does not exist, skipping drop');
      } else {
        throw error;
      }
    }

    // The collection will be recreated automatically when the first document is inserted
    // with the correct indexes from the TradeDecision model
    
    logger.info('TradeDecisions collection reset successfully');
    
  } catch (error) {
    logger.error('Error fixing tradeDecisions collection:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the fix
fixTradeDecisionsCollection()
  .then(() => {
    logger.info('TradeDecisions collection fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('TradeDecisions collection fix failed:', error);
    process.exit(1);
  });
