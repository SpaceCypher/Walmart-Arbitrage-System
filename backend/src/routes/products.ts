import { Router, Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';

const router = Router();

// Get all products
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 50,
      category,
      brand,
      active = 'true',
      search
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const query: any = {};

    if (category) query.category = category;
    if (brand) query.brand = brand;
    if (active !== 'all') query.isActive = active === 'true';
    if (search) {
      query.$text = { $search: search as string };
    }

    const products = await Product.find(query)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: {
        products,
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

// Get product by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await Product.findOne({
      $or: [
        { _id: req.params.id },
        { productId: req.params.id }
      ]
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { message: 'Product not found' },
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
