import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { writeLog } from '../local_smart.js';
import { LOCAL_SMART_DIR } from '../config.js';

const MEMORY_FILE = path.join(LOCAL_SMART_DIR, 'memory.json');

const DEFAULT_MEMORY = {
  useLongTermMemory: true,
  dirs: [
    '/home/fard1/Dustin/ai_service',
    '/home/fard1/Dustin/local_ai_desktop'
  ]
};

function getMemoryConfig() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read memory config:', e);
    writeLog('ERROR', `Failed to read memory config: ${e}`);
  }
  return DEFAULT_MEMORY;
}

function saveMemoryConfig(config: any) {
  try {
    fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(config, null, 2), 'utf-8');
    writeLog('INFO', `System: Memory config updated (LongTermMemory: ${config.useLongTermMemory}, Directories count: ${config.dirs?.length})`);
  } catch (e) {
    console.error('Failed to save memory config:', e);
    writeLog('ERROR', `Failed to save memory config: ${e}`);
  }
}

const router = Router();

router.get('/memory', (_req, res) => {
  res.json(getMemoryConfig());
});

router.post('/memory', (req, res) => {
  const config = req.body;
  if (!config) {
    return res.status(400).json({ error: 'Invalid memory payload' });
  }
  saveMemoryConfig(config);
  res.json({ success: true });
});

export default router;
