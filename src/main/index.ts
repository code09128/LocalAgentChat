import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { PORT, LOG_FILE } from './config.js';
import { ensureLogFile } from './local_smart.js';

// ── Route modules ──────────────────────────────────────────────────────
import profileRouter from './routes/profile.js';
import sessionsRouter from './routes/sessions.js';
import systemRouter from './routes/system.js';
import miscRouter from './routes/misc.js';
import chatRouter from './routes/chat.js';
import gatewayRouter from './routes/gateway.js';
import memoryRouter from './routes/memory.js';
import pythonRouter from './routes/python.js';
import { pythonManager } from './python-manager.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

ensureLogFile();

// ── Mount routers ──────────────────────────────────────────────────────
app.use('/api', profileRouter);
app.use('/api', sessionsRouter);
app.use('/api', systemRouter);
app.use('/api', miscRouter);
app.use('/api', chatRouter);
app.use('/api', gatewayRouter);
app.use('/api', memoryRouter);
app.use('/api', pythonRouter);

// ── SSE Log Monitor ────────────────────────────────────────────────────
const ANSI_ESCAPE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

function cleanLogLine(line: string): string {
  return line.replace(ANSI_ESCAPE, '').replace(/\r/g, '').replace(/\n/g, '').trim();
}

let currentAgent = 'DeepSeek-v4-pro (🧠 主大腦)';
let activeTool = '待命';
let percentage = 0;

function parseLine(cleanLine: string) {
  const modelMatch = cleanLine.match(/model=([a-zA-Z0-9_\-.]+)/);
  if (modelMatch) {
    const m = modelMatch[1];
    if (m.includes('deepseek')) currentAgent = 'DeepSeek-v4-pro (🧠 主大腦)';
    else if (m.includes('codex') || m.includes('gpt-5.3-codex') || m.includes('gpt-5.4-mini')) currentAgent = 'gpt-5.3-codex (💻 程式解算器)';
    else if (m.includes('mistral')) currentAgent = 'mistral-large-3 (📄 長文本專家)';
    else currentAgent = `${m} (🤖 輔助運算)`;
  }

  let logMsg = '';
  if (cleanLine.includes('conversation_loop: conversation turn:')) {
    const msgMatch = cleanLine.match(/msg='(.*?)'/);
    let userMsg = msgMatch ? msgMatch[1] : '新任務啟動';
    if (userMsg.length > 25) userMsg = userMsg.slice(0, 22) + '...';
    activeTool = '處理新任務中'; percentage = 10; logMsg = `問: ${userMsg}`;
  } else if (cleanLine.includes('chat_completion_stream_request') || cleanLine.includes('OpenAI client created')) {
    activeTool = '深度推理中 (Pondering)'; percentage = 30; logMsg = '正在發送請求並等待 AI 推理...';
  } else if (cleanLine.includes('agent.tool_executor: tool')) {
    const toolMatch = cleanLine.match(/agent\.tool_executor:\s+tool\s+(\S+)\s+(completed|failed)/);
    if (toolMatch) {
      const [, toolName, status] = toolMatch;
      if (['execute_code', 'terminal_exec', 'run_command', 'bash'].includes(toolName)) currentAgent = 'gpt-5.3-codex (💻 程式解算器)';
      else if (['read_file', 'search_files', 'view_file'].includes(toolName)) currentAgent = 'mistral-large-3 (📄 長文本專家)';
      activeTool = `工具: ${toolName}`; percentage = 80;
      logMsg = `${toolName} ${status === 'completed' ? '執行成功' : '執行失敗'}`;
    } else {
      const runMatch = cleanLine.match(/agent\.tool_executor:\s+tool\s+(\S+)/);
      if (runMatch) { activeTool = `工具: ${runMatch[1]}`; percentage = 60; logMsg = `正在執行 ${runMatch[1]}...`; }
      else logMsg = cleanLine;
    }
  } else if (cleanLine.includes('Turn ended:')) {
    const reasonMatch = cleanLine.match(/reason=([^\s,]+)/);
    activeTool = '待命'; percentage = 100; logMsg = `任務完成 (${reasonMatch ? reasonMatch[1] : '正常結束'})`;
  } else {
    const parts = cleanLine.split(/\s+(INFO|WARNING|ERROR|DEBUG)\s+/);
    logMsg = parts.length >= 3 ? parts[2] : cleanLine;
  }

  return { agent: currentAgent, tool: activeTool, percentage, log: logMsg };
}

app.get('/api/monitor/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendLogEvent = (line: string) => {
    const parsed = parseLine(line);
    const timeOnly = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    res.write(`event: log\ndata: ${JSON.stringify({ ...parsed, timestamp: timeOnly })}\n\n`);
  };

  let currentSize = 0;
  if (fs.existsSync(LOG_FILE)) {
    try {
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      const last30 = content.split('\n').filter(Boolean).slice(-30);
      last30.forEach(l => { const c = cleanLogLine(l); if (c && c.length >= 3 && !c.includes('Goodbye')) sendLogEvent(c); });
      currentSize = fs.statSync(LOG_FILE).size;
    } catch (e) { console.error(e); }
  }

  let fd: number | null = null;
  try { if (fs.existsSync(LOG_FILE)) fd = fs.openSync(LOG_FILE, 'r'); } catch (e) { console.error(e); }

  const intervalId = setInterval(() => {
    if (!fs.existsSync(LOG_FILE)) return;
    try {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > currentSize) {
        if (fd === null) fd = fs.openSync(LOG_FILE, 'r');
        const bufSize = stats.size - currentSize;
        const buf = Buffer.alloc(bufSize);
        fs.readSync(fd, buf, 0, bufSize, currentSize);
        currentSize = stats.size;
        buf.toString('utf-8').split('\n').filter(Boolean).forEach(l => {
          const c = cleanLogLine(l);
          if (c && c.length >= 3 && !c.includes('Goodbye')) sendLogEvent(c);
        });
      } else if (stats.size < currentSize) {
        currentSize = stats.size;
      }
    } catch (err) { console.error('Tailing error:', err); }
  }, 200);

  req.on('close', () => {
    clearInterval(intervalId);
    if (fd !== null) { try { fs.closeSync(fd); } catch { /* ignore */ } }
  });
});

// ── Process exit cleanup ───────────────────────────────────────────────
process.on('SIGINT', () => {
  pythonManager.stop();
  process.exit(0);
});
process.on('SIGTERM', () => {
  pythonManager.stop();
  process.exit(0);
});

// ── Start server ───────────────────────────────────────────────────────
const isElectron = Boolean(process.versions.electron || process.env.IS_ELECTRON === 'true');

async function launchDesktopWindow() {
  const { app: electronApp } = await import('electron');
  const { createDesktopWindow, setupDesktopLifecycle } = await import('./desktop.js');
  setupDesktopLifecycle();
  electronApp.whenReady().then(() => {
    createDesktopWindow();
  });
}

const server = app.listen(PORT, async () => {
  console.log(`Backend server started on http://localhost:${PORT}`);
  pythonManager.autoStartIfEnabled();

  if (isElectron) {
    launchDesktopWindow();
  }
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Backend] Port ${PORT} already in use. Assuming backend server is already running.`);
    if (isElectron) {
      console.log(`[Desktop] Reusing running backend on port ${PORT} and opening window...`);
      launchDesktopWindow();
    } else {
      console.error(`Port ${PORT} is busy. Stop other server or set PORT in .env`);
      process.exit(1);
    }
  } else {
    console.error('[Backend] Server listen error:', err);
  }
});
