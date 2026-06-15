import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import os from 'os';
import { exec } from 'child_process';
import { PORT, LOG_FILE, LOCAL_SMART_DIR } from './config.js';
import { ensureLogFile, writeLog } from './local_smart.js';
import { getTasks, saveTasks } from './task.js';
import { DEFAULT_PROVIDERS } from '../shared/model-providers.js';
import { mcpServers } from './mcp-servers.js';
const PROVIDERS_FILE = path.join(LOCAL_SMART_DIR, 'providers.json');
const SESSIONS_FILE = path.join(LOCAL_SMART_DIR, 'sessions.json');
const PROFILE_FILE = path.join(LOCAL_SMART_DIR, 'profile.json');
const DEFAULT_PROFILE = {
    activeProfile: 'deepseek',
    temperature: 0.7,
    topP: 0.9,
    systemPrompt: "You are a helpful coding assistant designed to help developers build secure local desktop automation applications.",
    permissions: {
        executeTerminal: true,
        readFile: true,
        writeFile: false,
        internetAccess: true
    }
};
function getProfile() {
    try {
        if (fs.existsSync(PROFILE_FILE)) {
            return JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf-8'));
        }
    }
    catch (e) {
        console.error("Failed to read profile file:", e);
        writeLog('ERROR', `Failed to read profile file: ${e}`);
    }
    return DEFAULT_PROFILE;
}
function saveProfile(profile) {
    fs.mkdirSync(path.dirname(PROFILE_FILE), { recursive: true });
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf-8');
    writeLog('INFO', `System: Agent profile updated (Active Profile: ${profile.activeProfile})`);
}
function getSessions() {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
        }
    }
    catch (e) {
        console.error("Failed to read sessions file:", e);
        writeLog('ERROR', `Failed to read sessions file: ${e}`);
    }
    return [];
}
function saveSessions(sessions) {
    fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
}
function getProviders() {
    try {
        if (fs.existsSync(PROVIDERS_FILE)) {
            return JSON.parse(fs.readFileSync(PROVIDERS_FILE, 'utf-8'));
        }
    }
    catch (e) {
        console.error("Failed to read providers file:", e);
        writeLog('ERROR', `Failed to read providers file: ${e}`);
    }
    return DEFAULT_PROVIDERS;
}
function saveProviders(providers) {
    fs.mkdirSync(path.dirname(PROVIDERS_FILE), { recursive: true });
    fs.writeFileSync(PROVIDERS_FILE, JSON.stringify(providers, null, 2), 'utf-8');
    const active = providers.find(p => p.enabled);
    if (active) {
        writeLog('INFO', `System: Active LLM Provider switched to ${active.label} (Model: ${active.selectedModel || 'Default'})`);
    }
    else {
        writeLog('INFO', `System: All LLM Providers disabled. Demo simulation active.`);
    }
}
const app = express();
app.use(cors());
app.use(express.json());
ensureLogFile();
const ANSI_ESCAPE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
function cleanLogLine(line) {
    return line.replace(ANSI_ESCAPE, '').replace(/\r/g, '').replace(/\n/g, '').trim();
}
let currentAgent = "DeepSeek-v4-pro (🧠 主大腦)";
let activeTool = "待命";
let percentage = 0;
function parseLine(cleanLine) {
    // Update Model Name
    const modelMatch = cleanLine.match(/model=([a-zA-Z0-9_\-]+)/);
    if (modelMatch) {
        const modelName = modelMatch[1];
        if (modelName.includes('deepseek')) {
            currentAgent = "DeepSeek-v4-pro (🧠 主大腦)";
        }
        else if (modelName.includes('codex') || modelName.includes('gpt-5.3-codex') || modelName.includes('gpt-5.4-mini')) {
            currentAgent = "gpt-5.3-codex (💻 程式解算器)";
        }
        else if (modelName.includes('mistral')) {
            currentAgent = "mistral-large-3 (📄 長文本專家)";
        }
        else {
            currentAgent = `${modelName} (🤖 輔助運算)`;
        }
    }
    let logMsg = '';
    if (cleanLine.includes("conversation_loop: conversation turn:")) {
        const msgMatch = cleanLine.match(/msg='(.*?)'/);
        let userMsg = msgMatch ? msgMatch[1] : "新任務啟動";
        if (userMsg.length > 25) {
            userMsg = userMsg.slice(0, 22) + "...";
        }
        activeTool = "處理新任務中";
        percentage = 10;
        logMsg = `問: ${userMsg}`;
    }
    else if (cleanLine.includes("chat_completion_stream_request") || cleanLine.includes("OpenAI client created")) {
        activeTool = "深度推理中 (Pondering)";
        percentage = 30;
        logMsg = "正在發送請求並等待 AI 推理...";
    }
    else if (cleanLine.includes("agent.tool_executor: tool")) {
        const toolMatch = cleanLine.match(/agent\.tool_executor:\s+tool\s+(\S+)\s+(completed|failed)/);
        if (toolMatch) {
            const toolName = toolMatch[1];
            const status = toolMatch[2];
            const statusDesc = status === "completed" ? "執行成功" : "執行失敗";
            if (['execute_code', 'terminal_exec', 'run_command', 'bash'].includes(toolName)) {
                currentAgent = "gpt-5.3-codex (💻 程式解算器)";
            }
            else if (['read_file', 'search_files', 'view_file'].includes(toolName)) {
                currentAgent = "mistral-large-3 (📄 長文本專家)";
            }
            activeTool = `工具: ${toolName}`;
            percentage = 80;
            logMsg = `${toolName} ${statusDesc}`;
        }
        else {
            const toolRunMatch = cleanLine.match(/agent\.tool_executor:\s+tool\s+(\S+)/);
            if (toolRunMatch) {
                const toolName = toolRunMatch[1];
                activeTool = `工具: ${toolName}`;
                percentage = 60;
                logMsg = `正在執行 {toolName}...`.replace('{toolName}', toolName);
            }
            else {
                logMsg = cleanLine;
            }
        }
    }
    else if (cleanLine.includes("Turn ended:")) {
        const reasonMatch = cleanLine.match(/reason=([^\s,]+)/);
        const reason = reasonMatch ? reasonMatch[1] : "正常結束";
        activeTool = "待命";
        percentage = 100;
        logMsg = `任務完成 (${reason})`;
    }
    else {
        // extract short log msg
        const logParts = cleanLine.split(/\s+(INFO|WARNING|ERROR|DEBUG)\s+/);
        logMsg = logParts.length >= 3 ? logParts[2] : cleanLine;
    }
    return { agent: currentAgent, tool: activeTool, percentage, log: logMsg };
}
// ── Provider Config API ────────────────────────────────────────────────
app.get('/api/providers', (_req, res) => {
    res.json(getProviders());
});
app.post('/api/providers', (req, res) => {
    const providers = req.body;
    if (!Array.isArray(providers)) {
        return res.status(400).json({ error: 'Expected array of providers' });
    }
    saveProviders(providers);
    res.json({ success: true });
});
// ── Profile API ───────────────────────────────────────────────────────────
app.get('/api/profile', (_req, res) => {
    res.json(getProfile());
});
app.post('/api/profile', (req, res) => {
    const profile = req.body;
    if (!profile || typeof profile.activeProfile !== 'string') {
        return res.status(400).json({ error: 'Invalid profile payload' });
    }
    saveProfile(profile);
    res.json({ success: true });
});
// Helper functions for system usage
function getCpuUsage() {
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
            if (totalDiff === 0)
                resolve(0);
            const usage = 100 - (100 * idleDiff) / totalDiff;
            resolve(Math.min(100, Math.max(0, usage)));
        }, 100);
    });
}
function getGpuDetails() {
    return new Promise((resolve) => {
        // 優先使用 nvidia-smi 獲取精準數據
        exec('nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits', (err, stdout) => {
            if (!err && stdout) {
                const parts = stdout.split(',').map(p => p.trim());
                if (parts.length >= 4) {
                    const name = parts[0];
                    const usage = parseInt(parts[1]) || 0;
                    const usedMb = parseInt(parts[2]) || 0;
                    const totalMb = parseInt(parts[3]) || 1;
                    const usedGb = (usedMb / 1024).toFixed(2);
                    const totalGb = (totalMb / 1024).toFixed(1);
                    const vramPercentage = parseFloat(((usedMb / totalMb) * 100).toFixed(1));
                    return resolve({
                        name,
                        usage,
                        vram: {
                            used: usedGb,
                            total: totalGb,
                            percentage: vramPercentage
                        }
                    });
                }
            }
            // Fallback: Windows 泛用顯卡名稱獲取
            if (process.platform === 'win32') {
                exec('wmic path win32_VideoController get name', (wmicErr, wmicStdout) => {
                    let name = 'GPU (待命)';
                    if (!wmicErr && wmicStdout) {
                        const lines = wmicStdout.split('\n').map(l => l.trim()).filter(Boolean);
                        if (lines.length > 1) {
                            name = lines[1];
                        }
                    }
                    resolve({
                        name,
                        usage: 0,
                        vram: {
                            used: '0.00',
                            total: '4.0',
                            percentage: 0
                        }
                    });
                });
            }
            else {
                resolve({
                    name: 'Integrated Graphics',
                    usage: 0,
                    vram: {
                        used: '0.00',
                        total: '2.0',
                        percentage: 0
                    }
                });
            }
        });
    });
}
// ── System Diagnostics API ───────────────────────────────────────────────────
app.get('/api/system/usage', async (_req, res) => {
    try {
        const cpu = await getCpuUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const gpuDetails = await getGpuDetails();
        res.json({
            cpu: parseFloat(cpu.toFixed(1)),
            memory: {
                used: (usedMem / 1024 / 1024 / 1024).toFixed(1),
                total: (totalMem / 1024 / 1024 / 1024).toFixed(1),
                percentage: parseFloat(((usedMem / totalMem) * 100).toFixed(1))
            },
            gpu: gpuDetails
        });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to retrieve system status' });
    }
});
// ── MCP Status API ──────────────────────────────────────────────────────────
app.get('/api/mcp/status', async (_req, res) => {
    const results = await Promise.all(mcpServers.map(async (srv) => {
        if (!srv.enabled) {
            return { name: srv.name, url: srv.url, status: 'OFFLINE' };
        }
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const r = await fetch(srv.url, { signal: controller.signal }).catch(() => null);
            clearTimeout(timeoutId);
            if (r && (r.ok || r.status < 500)) {
                return { name: srv.name, url: srv.url, status: 'ONLINE' };
            }
        }
        catch (e) { /* ignore */ }
        return { name: srv.name, url: srv.url, status: 'OFFLINE' };
    }));
    res.json(results);
});
// ── Sessions API ───────────────────────────────────────────────────────────
app.get('/api/sessions', (_req, res) => {
    res.json(getSessions());
});
app.get('/api/sessions/:id', (req, res) => {
    const { id } = req.params;
    const sessions = getSessions();
    const session = sessions.find(s => s.id === id);
    if (session) {
        res.json(session);
    }
    else {
        res.status(404).json({ error: 'Session not found' });
    }
});
app.delete('/api/sessions', (_req, res) => {
    saveSessions([]);
    res.json({ success: true });
});
// ── Ollama Local Model List ──────────────────────────────────────────────
app.get('/api/ollama/models', (req, res) => {
    const ollamaHost = req.query.host || 'http://localhost:11434';
    let url;
    try {
        url = new URL(`${ollamaHost}/api/tags`);
    }
    catch {
        return res.status(400).json({ error: 'Invalid Ollama host URL' });
    }
    const client = url.protocol === 'https:' ? https : http;
    const apiReq = client.get(url.toString(), { timeout: 5000 }, (apiRes) => {
        let body = '';
        apiRes.on('data', (chunk) => body += chunk);
        apiRes.on('end', () => {
            try {
                const data = JSON.parse(body);
                const models = (data.models || []).map((m) => ({
                    id: m.name,
                    name: m.name,
                    size: m.size,
                    modified: m.modified_at,
                }));
                res.json({ models });
            }
            catch {
                res.status(502).json({ error: 'Failed to parse Ollama response' });
            }
        });
    });
    apiReq.on('error', (err) => {
        res.status(503).json({ error: `Ollama unreachable: ${err.message}` });
    });
    apiReq.on('timeout', () => {
        apiReq.destroy();
        res.status(504).json({ error: 'Ollama request timed out' });
    });
});
// REST APIs for Kanban Task
app.get('/api/tasks', (req, res) => {
    res.json(getTasks());
});
app.post('/api/tasks', (req, res) => {
    const { title, description, status, priority } = req.body;
    const tasks = getTasks();
    const newTask = {
        id: String(Date.now()),
        title: title || 'New Task',
        description: description || '',
        status: status || 'todo',
        priority: priority || 'medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    tasks.push(newTask);
    saveTasks(tasks);
    res.status(201).json(newTask);
});
app.put('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const tasks = getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
        tasks[index] = {
            ...tasks[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        saveTasks(tasks);
        res.json(tasks[index]);
    }
    else {
        res.status(404).json({ error: 'Task not found' });
    }
});
app.delete('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const tasks = getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    saveTasks(filtered);
    res.json({ success: true });
});
function parseChunkLine(providerId, line) {
    if (providerId === 'openai' || providerId === 'azure_openai' || providerId === 'farobot') {
        if (line.startsWith('data:')) {
            const dataStr = line.substring(5).trim();
            if (dataStr === '[DONE]')
                return null;
            try {
                const json = JSON.parse(dataStr);
                return json.choices?.[0]?.delta?.content || null;
            }
            catch (e) {
                return null;
            }
        }
    }
    else if (providerId === 'claude') {
        if (line.startsWith('data:')) {
            const dataStr = line.substring(5).trim();
            try {
                const json = JSON.parse(dataStr);
                if (json.type === 'content_block_delta' && json.delta?.text) {
                    return json.delta.text;
                }
            }
            catch (e) {
                return null;
            }
        }
    }
    else if (providerId === 'ollama') {
        let cleanLine = line;
        if (cleanLine.startsWith('data:')) {
            cleanLine = cleanLine.substring(5).trim();
        }
        try {
            const json = JSON.parse(cleanLine);
            return json.message?.content || null;
        }
        catch (e) {
            return null;
        }
    }
    return null;
}
// SSE for Chat Streaming
app.post('/api/chat/stream', async (req, res) => {
    const { prompt, sessionId } = req.body;
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const profile = getProfile();
    // 1. Task Start
    writeLog('INFO', `conversation_loop: conversation turn: msg='${prompt}'`);
    sendEvent('status', { text: "任務已啟動" });
    await new Promise(resolve => setTimeout(resolve, 500));
    // 2. Thinking
    writeLog('INFO', 'chat_completion_stream_request');
    sendEvent('status', { text: "思考中..." });
    await new Promise(resolve => setTimeout(resolve, 500));
    // 3. Simulated Tool Call
    const lowerPrompt = (prompt || '').toLowerCase();
    const hasTool = ['code', 'run', 'exec', 'file', 'read', 'python', 'git', 'bash', 'command'].some(kw => lowerPrompt.includes(kw));
    if (hasTool) {
        const toolName = ['code', 'run', 'python'].some(kw => lowerPrompt.includes(kw)) ? 'execute_code' : 'read_file';
        writeLog('INFO', `agent.tool_executor: tool ${toolName}`);
        sendEvent('status', { text: `正在執行工具: ${toolName}...` });
        await new Promise(resolve => setTimeout(resolve, 1200));
        writeLog('INFO', `agent.tool_executor: tool ${toolName} completed`);
        sendEvent('status', { text: `工具 ${toolName} 執行成功` });
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    // 4. Determine Active Provider
    const providers = getProviders();
    const active = providers.find(p => p.enabled);
    let replyAccumulated = '';
    // Fallback function for simulated response
    const runFallback = async (reasonMsg) => {
        const deploymentName = "gpt-5.4-mini";
        writeLog('INFO', `model=${deploymentName}`);
        sendEvent('status', { text: "正在接收 AI 回覆..." });
        await new Promise(resolve => setTimeout(resolve, 200));
        const replyText = `🤖 [模擬回覆 - 活躍人格: ${profile.activeProfile}]: 您好！我收到了您的訊息: "${prompt}"。

目前系統運行在展示模式下（原因: ${reasonMsg}），本機已啟用 **local_smart** API 端點。
已套用 System Prompt: "${profile.systemPrompt}" (Temp: ${profile.temperature})

此介面右側的 **Office 監控中心** 正在即時攔截並解析 \`~/.local_smart/logs/agent.log\` 中的日誌。

您可以在上方側邊欄切換到不同功能頁面：
1. **Chat 對話區**: 與 Agent 進行對話互動。
2. **Sessions 歷程**: 檢視過往對話歷程。
3. **Profiles 設定檔**: 調整 AI Agent 身份與性格。
4. **Office 儀表板**: 檢視系統與 Agent 心跳數據。
5. **Settings 設定**: 系統與遠端 SSH Gateway 閘道設定。

請隨意點選或輸入指令，體驗我們為您打造的磨砂玻璃 sci-fi 科技美學桌面應用！`;
        replyAccumulated = replyText;
        for (let i = 0; i < replyText.length; i++) {
            sendEvent('chunk', { text: replyText[i] });
            await new Promise(resolve => setTimeout(resolve, 8));
        }
    };
    if (!active || (!active.apiKey && active.id !== 'ollama')) {
        await runFallback(active ? "啟用中的 Provider 未填寫 API Key" : "尚未啟用任何 AI Provider");
        writeLog('INFO', 'Turn ended: reason=stop');
        res.write('event: done\ndata: \n\n');
        res.end();
        return;
    }
    const modelName = active.selectedModel || (active.id === 'gemini' ? 'gemini-1.5-pro' : active.id === 'claude' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o');
    writeLog('INFO', `model=${modelName}`);
    sendEvent('status', { text: `連線至 ${active.label} [${modelName}]...` });
    try {
        let fetchUrl = '';
        let fetchHeaders = { 'Content-Type': 'application/json' };
        let fetchBody = {};
        if (active.id === 'farobot') {
            if (modelName === 'gpt-5.3-codex') {
                fetchUrl = `${active.endpoint || 'https://ai-foundry.farobottech.com:4443'}/v1/responses`;
                fetchHeaders['Authorization'] = `Bearer ${active.apiKey}`;
                fetchBody = {
                    model: 'gpt-5.3-codex',
                    input: `System: ${profile.systemPrompt}\nUser: ${prompt}`,
                    max_output_tokens: 2000
                };
            }
            else {
                fetchUrl = `${active.endpoint || 'https://ai-foundry.farobottech.com:4443'}/v1/chat/completions`;
                fetchHeaders['Authorization'] = `Bearer ${active.apiKey}`;
                fetchBody = {
                    model: modelName,
                    messages: [
                        { role: 'system', content: profile.systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    stream: true,
                    temperature: profile.temperature,
                    top_p: profile.topP
                };
            }
        }
        else if (active.id === 'azure_openai') {
            fetchUrl = `${active.endpoint}/openai/deployments/${active.deploymentName}/chat/completions?api-version=${active.apiVersion}`;
            fetchHeaders['api-key'] = active.apiKey;
            fetchBody = {
                messages: [
                    { role: 'system', content: profile.systemPrompt },
                    { role: 'user', content: prompt }
                ],
                stream: true,
                temperature: profile.temperature,
                top_p: profile.topP
            };
        }
        else if (active.id === 'openai') {
            fetchUrl = `${active.endpoint || 'https://api.openai.com'}/v1/chat/completions`;
            fetchHeaders['Authorization'] = `Bearer ${active.apiKey}`;
            fetchBody = {
                model: modelName,
                messages: [
                    { role: 'system', content: profile.systemPrompt },
                    { role: 'user', content: prompt }
                ],
                stream: true,
                temperature: profile.temperature,
                top_p: profile.topP
            };
        }
        else if (active.id === 'gemini') {
            fetchUrl = `${active.endpoint || 'https://generativelanguage.googleapis.com'}/v1beta/models/${modelName}:generateContent?key=${active.apiKey}`;
            fetchBody = {
                contents: [{ parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: profile.systemPrompt }] },
                generationConfig: {
                    temperature: profile.temperature,
                    topP: profile.topP
                }
            };
        }
        else if (active.id === 'claude') {
            fetchUrl = `${active.endpoint || 'https://api.anthropic.com'}/v1/messages`;
            fetchHeaders['x-api-key'] = active.apiKey;
            fetchHeaders['anthropic-version'] = '2023-06-01';
            fetchBody = {
                model: modelName,
                max_tokens: 4096,
                system: profile.systemPrompt,
                messages: [{ role: 'user', content: prompt }],
                stream: true,
                temperature: profile.temperature,
                top_p: profile.topP
            };
        }
        else if (active.id === 'ollama') {
            const host = active.ollamaHost || active.endpoint || 'http://localhost:11434';
            fetchUrl = `${host}/api/chat`;
            fetchBody = {
                model: modelName,
                messages: [
                    { role: 'system', content: profile.systemPrompt },
                    { role: 'user', content: prompt }
                ],
                stream: true,
                options: {
                    temperature: profile.temperature,
                    top_p: profile.topP
                }
            };
        }
        const isNonStreamSim = active.id === 'gemini' || (active.id === 'farobot' && modelName === 'gpt-5.3-codex');
        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: fetchHeaders,
            body: JSON.stringify(fetchBody)
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API 伺服器回傳狀態 ${response.status}: ${errText.slice(0, 150)}`);
        }
        if (isNonStreamSim) {
            const resData = await response.json();
            let text = '';
            if (active.id === 'gemini') {
                text = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }
            else {
                for (const item of resData.output || []) {
                    if (item.type === 'message') {
                        for (const content of item.content || []) {
                            if (content.type === 'output_text') {
                                text = content.text;
                            }
                        }
                    }
                }
            }
            if (!text) {
                throw new Error("API 回傳內容為空");
            }
            replyAccumulated = text;
            for (let i = 0; i < text.length; i++) {
                sendEvent('chunk', { text: text[i] });
                await new Promise(r => setTimeout(r, 6));
            }
        }
        else {
            const body = response.body;
            if (!body)
                throw new Error("API 未回傳響應流");
            let buffer = '';
            const decoder = new TextDecoder('utf-8');
            for await (const chunk of body) {
                buffer += decoder.decode(chunk);
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    const content = parseChunkLine(active.id, trimmed);
                    if (content) {
                        sendEvent('chunk', { text: content });
                        replyAccumulated += content;
                    }
                }
            }
            if (buffer.trim()) {
                const content = parseChunkLine(active.id, buffer.trim());
                if (content) {
                    sendEvent('chunk', { text: content });
                    replyAccumulated += content;
                }
            }
        }
        writeLog('INFO', 'Turn ended: reason=stop');
    }
    catch (err) {
        const errMsg = err.message || String(err);
        writeLog('ERROR', `API呼叫失敗: ${errMsg}`);
        sendEvent('status', { text: "API 呼叫失敗，啟用展示模式 fallback..." });
        await new Promise(r => setTimeout(r, 1000));
        await runFallback(`真實 API 連線失敗 - ${errMsg}`);
        writeLog('INFO', 'Turn ended: reason=stop');
    }
    finally {
        // 儲存對話到 sessions.json
        if (sessionId && replyAccumulated) {
            try {
                const sessions = getSessions();
                const existing = sessions.find(s => s.id === sessionId);
                const timeStr = new Date().toLocaleString('zh-TW', { hour12: false });
                if (existing) {
                    const lastMsg = existing.messages[existing.messages.length - 1];
                    if (!lastMsg || lastMsg.text !== replyAccumulated) {
                        existing.messages.push({ id: String(Date.now()), role: 'user', text: prompt }, { id: String(Date.now() + 1), role: 'ai', text: replyAccumulated });
                        existing.preview = replyAccumulated.slice(0, 100) + (replyAccumulated.length > 100 ? '...' : '');
                        existing.date = timeStr;
                    }
                }
                else {
                    sessions.push({
                        id: sessionId,
                        title: prompt.length > 30 ? prompt.slice(0, 27) + '...' : prompt,
                        date: timeStr,
                        preview: replyAccumulated.slice(0, 100) + (replyAccumulated.length > 100 ? '...' : ''),
                        messages: [
                            { id: String(Date.now()), role: 'user', text: prompt },
                            { id: String(Date.now() + 1), role: 'ai', text: replyAccumulated }
                        ]
                    });
                }
                saveSessions(sessions);
            }
            catch (e) {
                console.error("Save session failed:", e);
            }
        }
        res.write('event: done\ndata: \n\n');
        res.end();
    }
});
// SSE for Log Monitoring
app.get('/api/monitor/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    const sendLogEvent = (lineContent) => {
        const parsed = parseLine(lineContent);
        const timeOnly = new Date().toLocaleTimeString('zh-TW', { hour12: false });
        res.write(`event: log\ndata: ${JSON.stringify({
            ...parsed,
            timestamp: timeOnly
        })}\n\n`);
    };
    // 1. Read last 30 log lines
    let currentSize = 0;
    if (fs.existsSync(LOG_FILE)) {
        try {
            const content = fs.readFileSync(LOG_FILE, 'utf-8');
            const lines = content.split('\n').filter(Boolean);
            const last30 = lines.slice(-30);
            last30.forEach(line => {
                const cleaned = cleanLogLine(line);
                if (cleaned && cleaned.length >= 3 && !cleaned.includes('Goodbye')) {
                    sendLogEvent(cleaned);
                }
            });
            currentSize = fs.statSync(LOG_FILE).size;
        }
        catch (e) {
            console.error(e);
        }
    }
    // 2. Setup dynamic tailing interval
    let fileDescriptor = null;
    try {
        if (fs.existsSync(LOG_FILE)) {
            fileDescriptor = fs.openSync(LOG_FILE, 'r');
        }
    }
    catch (e) {
        console.error(e);
    }
    const intervalId = setInterval(() => {
        if (!fs.existsSync(LOG_FILE))
            return;
        try {
            const stats = fs.statSync(LOG_FILE);
            if (stats.size > currentSize) {
                if (fileDescriptor === null) {
                    fileDescriptor = fs.openSync(LOG_FILE, 'r');
                }
                const bufferSize = stats.size - currentSize;
                const buffer = Buffer.alloc(bufferSize);
                fs.readSync(fileDescriptor, buffer, 0, bufferSize, currentSize);
                currentSize = stats.size;
                const newContent = buffer.toString('utf-8');
                const lines = newContent.split('\n').filter(Boolean);
                lines.forEach(line => {
                    const cleaned = cleanLogLine(line);
                    if (cleaned && cleaned.length >= 3 && !cleaned.includes('Goodbye')) {
                        sendLogEvent(cleaned);
                    }
                });
            }
            else if (stats.size < currentSize) {
                // Log truncated or recreated
                currentSize = stats.size;
            }
        }
        catch (err) {
            console.error("Tailing error:", err);
        }
    }, 200);
    req.on('close', () => {
        clearInterval(intervalId);
        if (fileDescriptor !== null) {
            try {
                fs.closeSync(fileDescriptor);
            }
            catch (e) { }
        }
    });
});
app.listen(PORT, () => {
    console.log(`Backend server started on http://localhost:${PORT}`);
});
