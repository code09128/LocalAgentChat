import { Router } from 'express';
import { pythonManager } from '../python-manager.js';

const router = Router();

router.get('/python/status', (_req, res) => {
  res.json(pythonManager.getStatus());
});

router.post('/python/start', async (_req, res) => {
  const result = await pythonManager.start();
  res.json(result);
});

router.post('/python/stop', (_req, res) => {
  const result = pythonManager.stop();
  res.json(result);
});

export default router;
