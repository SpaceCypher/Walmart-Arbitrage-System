import { Router, Request, Response, NextFunction } from 'express';
import { Store } from '../models/Store';

const router = Router();

// Get all stores
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 50,
      city,
      state,
      active = 'true'
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const query: any = {};

    if (city) query['address.city'] = city;
    if (state) query['address.state'] = state;
    if (active !== 'all') query.isActive = active === 'true';

    const stores = await Store.find(query)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Store.countDocuments(query);

    res.json({
      success: true,
      data: {
        stores,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get store by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const store = await Store.findOne({
      $or: [
        { _id: req.params.id },
        { storeId: req.params.id }
      ]
    });
    
    if (!store) {
      return res.status(404).json({
        success: false,
        error: { message: 'Store not found' },
      });
    }

    res.json({
      success: true,
      data: store,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
