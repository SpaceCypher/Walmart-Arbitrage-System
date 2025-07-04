import express from 'express';
import { getOverview } from '../controllers/analyticsController';

const router = express.Router();

router.get('/overview', getOverview);

export default router;
