import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { writeLog } from '../local_smart.js';
import { LOCAL_SMART_DIR } from '../config.js';

const GATEWAY_FILE = path.join(LOCAL_SMART_DIR, 'gateway.json');

const DEFAULT_GATEWAY = {
  host: '102.16.89.44',
  port: '22',
  username: 'ubuntu',
  remotePort: '8080',
  localPort: '8080',
  tunnelActive: false
};

function getGatewayConfig() {
  try {
    if (fs.existsSync(GATEWAY_FILE)) {
      return JSON.parse(fs.readFileSync(GATEWAY_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read gateway config:', e);
    writeLog('ERROR', `Failed to read gateway config: ${e}`);
  }
  return DEFAULT_GATEWAY;
}

function saveGatewayConfig(config: any) {
  try {
    fs.mkdirSync(path.dirname(GATEWAY_FILE), { recursive: true });
    fs.writeFileSync(GATEWAY_FILE, JSON.stringify(config, null, 2), 'utf-8');
    writeLog('INFO', `System: Gateway config updated (Tunnel Active: ${config.tunnelActive})`);
  } catch (e) {
    console.error('Failed to save gateway config:', e);
    writeLog('ERROR', `Failed to save gateway config: ${e}`);
  }
}

const router = Router();

router.get('/gateway', (_req, res) => {
  res.json(getGatewayConfig());
});

router.post('/gateway', (req, res) => {
  const config = req.body;
  if (!config) {
    return res.status(400).json({ error: 'Invalid gateway payload' });
  }
  saveGatewayConfig(config);
  res.json({ success: true });
});

export default router;
