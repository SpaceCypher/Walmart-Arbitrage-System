import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { keydb } from '../config/keydb';

const router = Router();

// Health check endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    const healthCheck = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        mongodb: {
          status: 'unknown',
          connected: false,
        },
        keydb: {
          status: 'unknown',
          connected: false,
        },
      },
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      },
      cpu: {
        usage: process.cpuUsage(),
      },
    };

    // Check MongoDB connection
    try {
      if (db.isConnectionReady()) {
        healthCheck.services.mongodb.status = 'connected';
        healthCheck.services.mongodb.connected = true;
      } else {
        healthCheck.services.mongodb.status = 'disconnected';
        healthCheck.services.mongodb.connected = false;
      }
    } catch (error) {
      healthCheck.services.mongodb.status = 'error';
      healthCheck.services.mongodb.connected = false;
    }

    // Check KeyDB connection
    try {
      if (keydb.isConnected()) {
        await keydb.ping();
        healthCheck.services.keydb.status = 'connected';
        healthCheck.services.keydb.connected = true;
      } else {
        healthCheck.services.keydb.status = 'disconnected';
        healthCheck.services.keydb.connected = false;
      }
    } catch (error) {
      healthCheck.services.keydb.status = 'error';
      healthCheck.services.keydb.connected = false;
    }

    // Determine overall status
    const allServicesHealthy = Object.values(healthCheck.services).every(
      service => service.status === 'connected'
    );

    if (!allServicesHealthy) {
      healthCheck.status = 'DEGRADED';
      return res.status(503).json(healthCheck);
    }

    res.status(200).json(healthCheck);
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const detailedHealth = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: {
        process: process.uptime(),
        system: require('os').uptime(),
      },
      memory: {
        process: process.memoryUsage(),
        system: {
          total: require('os').totalmem(),
          free: require('os').freemem(),
        },
      },
      cpu: {
        usage: process.cpuUsage(),
        load: require('os').loadavg(),
      },
      services: {
        mongodb: {
          status: 'unknown',
          readyState: 0,
          host: process.env.MONGODB_URI ? 'configured' : 'not configured',
        },
        keydb: {
          status: 'unknown',
          host: `${process.env.KEYDB_HOST || 'localhost'}:${process.env.KEYDB_PORT || 6379}`,
        },
      },
    };

    // MongoDB detailed check
    try {
      const connection = db.getConnection();
      detailedHealth.services.mongodb.readyState = connection.readyState;
      detailedHealth.services.mongodb.status = db.isConnectionReady() ? 'connected' : 'disconnected';
    } catch (error) {
      detailedHealth.services.mongodb.status = 'error';
    }

    // KeyDB detailed check
    try {
      const pingResult = await keydb.ping();
      detailedHealth.services.keydb.status = pingResult === 'PONG' ? 'connected' : 'error';
    } catch (error) {
      detailedHealth.services.keydb.status = 'error';
    }

    res.status(200).json(detailedHealth);
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
