import { Router, type Request, type Response } from 'express';
import { metrics } from '../lib/metrics.js';

export const metricsRouter = Router();

metricsRouter.get('/', (req: Request, res: Response) => {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${token}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics.render());
});
