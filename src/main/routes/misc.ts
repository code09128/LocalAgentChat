import { Router } from 'express';
import http from 'http';
import https from 'https';
import { getTasks, saveTasks, TaskItem } from '../task.js';
import { ProviderConfig, DEFAULT_PROVIDERS } from '../../shared/model-providers.js';
import fs from 'fs';
import path from 'path';
import { writeLog } from '../local_smart.js';
import { LOCAL_SMART_DIR } from '../config.js';

const PROVIDERS_FILE = path.join(LOCAL_SMART_DIR, 'providers.json');

export function getProviders(): ProviderConfig[] {
  try {
    if (fs.existsSync(PROVIDERS_FILE)) {
      return JSON.parse(fs.readFileSync(PROVIDERS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read providers file:', e);
    writeLog('ERROR', `Failed to read providers file: ${e}`);
  }
  return DEFAULT_PROVIDERS;
}

function saveProviders(providers: ProviderConfig[]): void {
  fs.mkdirSync(path.dirname(PROVIDERS_FILE), { recursive: true });
  fs.writeFileSync(PROVIDERS_FILE, JSON.stringify(providers, null, 2), 'utf-8');
  const active = providers.find(p => p.enabled);
  if (active) {
    writeLog('INFO', `System: Active LLM Provider switched to ${active.label} (Model: ${active.selectedModel || 'Default'})`);
  } else {
    writeLog('INFO', 'System: All LLM Providers disabled. Demo simulation active.');
  }
}

const router = Router();

// ── Providers ──
router.get('/providers', (_req, res) => {
  res.json(getProviders());
});

router.post('/providers', (req, res) => {
  const providers: ProviderConfig[] = req.body;
  if (!Array.isArray(providers)) {
    return res.status(400).json({ error: 'Expected array of providers' });
  }
  saveProviders(providers);
  res.json({ success: true });
});

// ── Ollama Models ──
router.get('/ollama/models', (req, res) => {
  const ollamaHost: string = (req.query.host as string) || 'http://localhost:11434';
  let url: URL;
  try { url = new URL(`${ollamaHost}/api/tags`); } catch {
    return res.status(400).json({ error: 'Invalid Ollama host URL' });
  }
  const client = url.protocol === 'https:' ? https : http;
  const apiReq = client.get(url.toString(), { timeout: 5000 }, (apiRes) => {
    let body = '';
    apiRes.on('data', (chunk) => body += chunk);
    apiRes.on('end', () => {
      try {
        const data = JSON.parse(body);
        const models = (data.models || []).map((m: { name: string; size?: number; modified_at?: string }) => ({
          id: m.name, name: m.name, size: m.size, modified: m.modified_at,
        }));
        res.json({ models });
      } catch {
        res.status(502).json({ error: 'Failed to parse Ollama response' });
      }
    });
  });
  apiReq.on('error', (err: Error) => res.status(503).json({ error: `Ollama unreachable: ${err.message}` }));
  apiReq.on('timeout', () => { apiReq.destroy(); res.status(504).json({ error: 'Ollama request timed out' }); });
});

// ── Tasks (Kanban) ──
router.get('/tasks', (_req, res) => res.json(getTasks()));

router.post('/tasks', (req, res) => {
  const { title, description, status, priority } = req.body;
  const tasks = getTasks();
  const newTask: TaskItem = {
    id: String(Date.now()),
    title: title || 'New Task',
    description: description || '',
    status: status || 'todo',
    priority: priority || 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.push(newTask);
  saveTasks(tasks);
  res.status(201).json(newTask);
});

router.put('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const tasks = getTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });
  tasks[idx] = { ...tasks[idx], ...req.body, updatedAt: new Date().toISOString() };
  saveTasks(tasks);
  res.json(tasks[idx]);
});

router.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;
  saveTasks(getTasks().filter(t => t.id !== id));
  res.json({ success: true });
});

// ── Tool Exec ──
import { exec } from 'child_process';

router.post('/tools/exec', async (req, res) => {
  const { command, workdir, timeout } = req.body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ success: false, output: '缺少 command 參數', exitCode: -1 });
  }
  const dangerous = [
    /rm\s+-rf\s+\//, /mkfs/, /dd\s+if=/, />\s*\/dev\//,
    /curl.*\|.*sh/, /wget.*\|.*sh/, /:\(\)\s*\{/,
  ];
  for (const pattern of dangerous) {
    if (pattern.test(command)) {
      writeLog('WARN', `Blocked dangerous command: ${command}`);
      return res.json({ success: false, output: '此指令已被安全策略阻擋', exitCode: -1 });
    }
  }
  const cwd = workdir || process.cwd();
  const maxTimeout = Math.min(timeout || 15000, 30000);
  writeLog('INFO', `agent.tool_executor: tool execute command='${command}'`);
  try {
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
      exec(command, { cwd, timeout: maxTimeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        resolve({ stdout: stdout || '', stderr: stderr || '', exitCode: error ? (error as any).code || 1 : 0 });
      });
    });
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    const success = result.exitCode === 0;
    writeLog('INFO', `agent.tool_executor: tool execute ${success ? 'completed' : 'failed'} (exit=${result.exitCode})`);
    res.json({ success, output: output || '(無輸出)', exitCode: result.exitCode });
  } catch (err: any) {
    writeLog('ERROR', `agent.tool_executor: tool execute failed: ${err.message}`);
    res.json({ success: false, output: `執行錯誤: ${err.message}`, exitCode: -1 });
  }
});

export default router;
