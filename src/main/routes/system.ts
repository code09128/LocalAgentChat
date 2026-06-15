import { Router } from 'express';
import os from 'os';
import { exec } from 'child_process';
import { mcpServers } from '../mcp-servers.js';

function getCpuUsage(): Promise<number> {
  const start = os.cpus();
  return new Promise((resolve) => {
    setTimeout(() => {
      const end = os.cpus();
      let idleDiff = 0;
      let totalDiff = 0;
      for (let i = 0; i < start.length; i++) {
        const s = start[i];
        const e = end[i];
        const sTotal = s.times.user + s.times.nice + s.times.sys + s.times.idle + s.times.irq;
        const eTotal = e.times.user + e.times.nice + e.times.sys + e.times.idle + e.times.irq;
        idleDiff += e.times.idle - s.times.idle;
        totalDiff += eTotal - sTotal;
      }
      if (totalDiff === 0) return resolve(0);
      resolve(Math.min(100, Math.max(0, 100 - (100 * idleDiff) / totalDiff)));
    }, 100);
  });
}

interface GpuDetails {
  name: string;
  usage: number;
  vram: { used: string; total: string; percentage: number };
}

function getGpuDetails(): Promise<GpuDetails> {
  return new Promise((resolve) => {
    exec(
      'nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits',
      (err, stdout) => {
        if (!err && stdout) {
          const parts = stdout.split(',').map(p => p.trim());
          if (parts.length >= 4) {
            const usedMb = parseInt(parts[2]) || 0;
            const totalMb = parseInt(parts[3]) || 1;
            return resolve({
              name: parts[0],
              usage: parseInt(parts[1]) || 0,
              vram: {
                used: (usedMb / 1024).toFixed(2),
                total: (totalMb / 1024).toFixed(1),
                percentage: parseFloat(((usedMb / totalMb) * 100).toFixed(1)),
              },
            });
          }
        }
        if (process.platform === 'win32') {
          exec('wmic path win32_VideoController get name', (wmicErr, wmicOut) => {
            const lines = (wmicOut || '').split('\n').map(l => l.trim()).filter(Boolean);
            resolve({ name: lines[1] || 'GPU (待命)', usage: 0, vram: { used: '0.00', total: '4.0', percentage: 0 } });
          });
        } else {
          resolve({ name: 'Integrated Graphics', usage: 0, vram: { used: '0.00', total: '2.0', percentage: 0 } });
        }
      }
    );
  });
}

const router = Router();

router.get('/system/usage', async (_req, res) => {
  try {
    const cpu = await getCpuUsage();
    const totalMem = os.totalmem();
    const usedMem = totalMem - os.freemem();
    const gpu = await getGpuDetails();
    res.json({
      cpu: parseFloat(cpu.toFixed(1)),
      memory: {
        used: (usedMem / 1024 / 1024 / 1024).toFixed(1),
        total: (totalMem / 1024 / 1024 / 1024).toFixed(1),
        percentage: parseFloat(((usedMem / totalMem) * 100).toFixed(1)),
      },
      gpu,
    });
  } catch {
    res.status(500).json({ error: 'Failed to retrieve system status' });
  }
});

router.get('/mcp/status', async (_req, res) => {
  const results = await Promise.all(
    mcpServers.map(async (srv) => {
      if (!srv.enabled) return { name: srv.name, url: srv.url, status: 'OFFLINE' };
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 1500);
        const r = await fetch(srv.url, { signal: controller.signal }).catch(() => null);
        clearTimeout(tid);
        if (r && (r.ok || r.status < 500)) return { name: srv.name, url: srv.url, status: 'ONLINE' };
      } catch { /* ignore */ }
      return { name: srv.name, url: srv.url, status: 'OFFLINE' };
    })
  );
  res.json(results);
});

export default router;
