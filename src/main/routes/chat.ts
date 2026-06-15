import { Router } from 'express';
import type { Request, Response } from 'express';
import { exec } from 'child_process';
import path from 'path';
import { writeLog } from '../local_smart.js';
import { getProfile, getActiveProviderParams } from './profile.js';
import { getProviders } from './misc.js';
import { getSessions, saveSessions } from './sessions.js';

// ── SSE helper ────────────────────────────────────────────────────────
function makeSender(res: Response) {
  return (event: string, data: object) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── Chunk line parser per provider ────────────────────────────────────
function parseChunkLine(providerId: string, line: string): string | null {
  if (['openai', 'azure_openai', 'farobot'].includes(providerId)) {
    if (!line.startsWith('data:')) return null;
    const raw = line.substring(5).trim();
    if (raw === '[DONE]') return null;
    try { return JSON.parse(raw).choices?.[0]?.delta?.content || null; } catch { return null; }
  }
  if (providerId === 'claude') {
    if (!line.startsWith('data:')) return null;
    try {
      const json = JSON.parse(line.substring(5).trim());
      return json.type === 'content_block_delta' ? json.delta?.text || null : null;
    } catch { return null; }
  }
  if (providerId === 'ollama') {
    try { return JSON.parse(line.startsWith('data:') ? line.substring(5).trim() : line).message?.content || null; }
    catch { return null; }
  }
  return null;
}

// ── Intent detection + tool execution ────────────────────────────────
interface ToolAction { command: string; label: string; workdir?: string }

async function runTools(
  prompt: string,
  permissions: { readFile: boolean; executeTerminal: boolean },
  sendEvent: (event: string, data: object) => void
): Promise<string> {
  const lower = prompt.toLowerCase();
  const resolvedWorkdir = process.cwd();
  const dirPathMatch = prompt.match(/[/~][^\s]+/);
  const targetDir = dirPathMatch ? dirPathMatch[0] : resolvedWorkdir;
  const toolActions: ToolAction[] = [];
  let toolContext = '';

  const hasExploreVerb = ['解析', '分析', '探索', '看看', '檢查', '查看', '列出'].some(kw => prompt.includes(kw));
  const hasDirNoun = ['資料夾', '目錄', '專案', '結構', 'dir', 'folder', 'project'].some(kw => lower.includes(kw));
  const hasPathFileQuery = !!dirPathMatch && ['哪些檔案', '有什麼', '下面有', '裡面有', '什麼檔案', '列出', 'list', 'ls'].some(kw => lower.includes(kw));

  if ((hasExploreVerb && hasDirNoun) || hasPathFileQuery) {
    if (!permissions.readFile) {
      toolContext += '\n\n--- 系統提示 ---\n⚠️ 「允許讀取本機檔案」權限未開啟，無法列出目錄。請至 Settings → 執行安全權限與沙箱 開啟此權限。';
    } else {
      toolActions.push({ command: `ls -lah "${targetDir}" 2>/dev/null | head -80`, label: `列出目錄: ${targetDir}`, workdir: resolvedWorkdir });
      toolActions.push({
        command: `find "${targetDir}" -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/__pycache__/*' -not -path '*/.venv/*' -not -path '*/venv/*' 2>/dev/null | sort | head -100`,
        label: `掃描檔案樹: ${targetDir}`, workdir: resolvedWorkdir,
      });
    }
  }

  const readMatch = prompt.match(/(?:讀取|讀|打開|開啟|cat|open)\s+([/.\w][^\s]+)/);
  if (readMatch) {
    if (!permissions.readFile) {
      toolContext += '\n\n--- 系統提示 ---\n⚠️ 「允許讀取本機檔案」權限未開啟，無法讀取檔案。請至 Settings → 執行安全權限與沙箱 開啟此權限。';
    } else {
      const fp = readMatch[1];
      const full = fp.startsWith('/') ? fp : path.join(resolvedWorkdir, fp);
      toolActions.push({ command: `cat "${full}" 2>/dev/null | head -200`, label: `讀取檔案: ${fp}`, workdir: resolvedWorkdir });
    }
  }

  const runMatch = prompt.match(/(?:執行|跑|run)\s+(.+)/i);
  if (runMatch) {
    if (!permissions.executeTerminal) {
      toolContext += '\n\n--- 系統提示 ---\n⚠️ 「允許終端機命令執行」權限未開啟，無法執行指令。請至 Settings → 執行安全權限與沙箱 開啟此權限。';
    } else {
      toolActions.push({ command: runMatch[1].trim(), label: '執行指令', workdir: resolvedWorkdir });
    }
  }

  for (const action of toolActions) {
    writeLog('INFO', `agent.tool_executor: tool execute command='${action.command}'`);
    sendEvent('status', { text: `正在執行: ${action.label}...` });
    await new Promise(r => setTimeout(r, 300));
    try {
      const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve) => {
        exec(action.command, { cwd: action.workdir || resolvedWorkdir, timeout: 15000, maxBuffer: 1024 * 1024 }, (_, out, err) =>
          resolve({ stdout: out || '', stderr: err || '' })
        );
      });
      const output = [stdout, stderr].filter(Boolean).join('\n').trim() || '(無輸出)';
      toolContext += `\n\n--- 工具: ${action.label} ---\n${output}`;
      writeLog('INFO', `agent.tool_executor: tool execute completed: ${action.label}`);
      sendEvent('status', { text: `${action.label} 完成` });
    } catch (err: any) {
      toolContext += `\n\n--- 工具: ${action.label} ---\n執行失敗: ${err.message}`;
      writeLog('ERROR', `agent.tool_executor: tool execute failed: ${err.message}`);
      sendEvent('status', { text: `${action.label} 失敗` });
    }
    await new Promise(r => setTimeout(r, 200));
  }

  return toolContext;
}

// ── Router ────────────────────────────────────────────────────────────
const router = Router();

router.post('/chat/stream', async (req: Request, res: Response) => {
  const { prompt, sessionId, images } = req.body;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = makeSender(res);
  const profile = getProfile();
  const { temperature: pTemp, topP: pTopP, systemPrompt: pSystemPrompt } = getActiveProviderParams(profile);

  writeLog('INFO', `conversation_loop: conversation turn: msg='${prompt}'`);
  sendEvent('status', { text: '任務已啟動' });
  await new Promise(r => setTimeout(r, 500));

  writeLog('INFO', 'chat_completion_stream_request');
  sendEvent('status', { text: '思考中...' });
  await new Promise(r => setTimeout(r, 500));

  // Tool execution
  const toolContext = await runTools(prompt, profile.permissions, sendEvent);
  const enhancedPrompt = toolContext
    ? `${prompt}\n\n以下是我從系統中讀取的真實資訊，請根據這些資訊來分析和回答：\n${toolContext}`
    : prompt;

  const providers = getProviders();
  const active = providers.find(p => p.enabled);
  let replyAccumulated = '';

  const runFallback = async (reasonMsg: string) => {
    writeLog('INFO', 'model=gpt-5.4-mini');
    sendEvent('status', { text: '正在接收 AI 回覆...' });
    await new Promise(r => setTimeout(r, 200));
    const text = `🤖 [模擬回覆 - 活躍人格: ${profile.activeProfile}]: 您好！我收到了您的訊息: "${enhancedPrompt}".\n\n目前系統運行在展示模式下（原因: ${reasonMsg}），本機已啟用 **local_smart** API 端點。\n已套用 System Prompt: "${pSystemPrompt}" (Temp: ${pTemp})`;
    replyAccumulated = text;
    for (let i = 0; i < text.length; i++) {
      sendEvent('chunk', { text: text[i] });
      await new Promise(r => setTimeout(r, 8));
    }
  };

  if (!active || (!active.apiKey && active.id !== 'ollama')) {
    await runFallback(active ? '啟用中的 Provider 未填寫 API Key' : '尚未啟用任何 AI Provider');
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
    let fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    let fetchBody: any = {};

    if (active.id === 'farobot') {
      if (modelName === 'gpt-5.3-codex') {
        fetchUrl = `${active.endpoint || 'https://ai-foundry.farobottech.com:4443'}/v1/responses`;
        fetchHeaders['Authorization'] = `Bearer ${active.apiKey}`;
        fetchBody = { model: 'gpt-5.3-codex', input: `System: ${pSystemPrompt}\nUser: ${enhancedPrompt}`, max_output_tokens: 2000 };
      } else {
        fetchUrl = `${active.endpoint || 'https://ai-foundry.farobottech.com:4443'}/v1/chat/completions`;
        fetchHeaders['Authorization'] = `Bearer ${active.apiKey}`;
        let userContent: any = enhancedPrompt;
        if (images && images.length > 0) {
          userContent = [{ type: 'text', text: enhancedPrompt }];
          for (const img of images) {
            userContent.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } });
          }
        }
        fetchBody = { model: modelName, messages: [{ role: 'system', content: pSystemPrompt }, { role: 'user', content: userContent }], stream: true, temperature: pTemp, top_p: pTopP };
      }
    } else if (active.id === 'azure_openai') {
      fetchUrl = `${active.endpoint}/openai/deployments/${active.deploymentName}/chat/completions?api-version=${active.apiVersion}`;
      fetchHeaders['api-key'] = active.apiKey;
      let userContent: any = enhancedPrompt;
      if (images && images.length > 0) {
        userContent = [{ type: 'text', text: enhancedPrompt }];
        for (const img of images) {
          userContent.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } });
        }
      }
      fetchBody = { messages: [{ role: 'system', content: pSystemPrompt }, { role: 'user', content: userContent }], stream: true, temperature: pTemp, top_p: pTopP };
    } else if (active.id === 'openai') {
      fetchUrl = `${active.endpoint || 'https://api.openai.com'}/v1/chat/completions`;
      fetchHeaders['Authorization'] = `Bearer ${active.apiKey}`;
      let userContent: any = enhancedPrompt;
      if (images && images.length > 0) {
        userContent = [{ type: 'text', text: enhancedPrompt }];
        for (const img of images) {
          userContent.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } });
        }
      }
      fetchBody = { model: modelName, messages: [{ role: 'system', content: pSystemPrompt }, { role: 'user', content: userContent }], stream: true, temperature: pTemp, top_p: pTopP };
    } else if (active.id === 'gemini') {
      fetchUrl = `${active.endpoint || 'https://generativelanguage.googleapis.com'}/v1beta/models/${modelName}:generateContent?key=${active.apiKey}`;
      let parts: any[] = [{ text: enhancedPrompt }];
      if (images && images.length > 0) {
        for (const img of images) {
          parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
        }
      }
      fetchBody = { contents: [{ parts }], systemInstruction: { parts: [{ text: pSystemPrompt }] }, generationConfig: { temperature: pTemp, topP: pTopP } };
    } else if (active.id === 'claude') {
      fetchUrl = `${active.endpoint || 'https://api.anthropic.com'}/v1/messages`;
      fetchHeaders['x-api-key'] = active.apiKey;
      fetchHeaders['anthropic-version'] = '2023-06-01';
      let userContent: any = enhancedPrompt;
      if (images && images.length > 0) {
        userContent = [{ type: 'text', text: enhancedPrompt }];
        for (const img of images) {
          userContent.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } });
        }
      }
      fetchBody = { model: modelName, max_tokens: 4096, system: pSystemPrompt, messages: [{ role: 'user', content: userContent }], stream: true, temperature: pTemp, top_p: pTopP };
    } else if (active.id === 'ollama') {
      const host = active.ollamaHost || active.endpoint || 'http://localhost:11434';
      fetchUrl = `${host}/api/chat`;
      let userMsg: any = { role: 'user', content: enhancedPrompt };
      if (images && images.length > 0) {
        userMsg.images = images.map((img: any) => img.base64);
      }
      fetchBody = { model: modelName, messages: [{ role: 'system', content: pSystemPrompt }, userMsg], stream: true, options: { temperature: pTemp, top_p: pTopP } };
    }

    const isNonStream = active.id === 'gemini' || (active.id === 'farobot' && modelName === 'gpt-5.3-codex');
    const response = await fetch(fetchUrl, { method: 'POST', headers: fetchHeaders, body: JSON.stringify(fetchBody) });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API 伺服器回傳狀態 ${response.status}: ${errText.slice(0, 150)}`);
    }

    if (isNonStream) {
      const resData: any = await response.json();
      let text = '';
      if (active.id === 'gemini') {
        text = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        for (const item of resData.output || []) {
          if (item.type === 'message') for (const c of item.content || []) if (c.type === 'output_text') text = c.text;
        }
      }
      if (!text) throw new Error('API 回傳內容為空');
      replyAccumulated = text;
      for (let i = 0; i < text.length; i++) {
        sendEvent('chunk', { text: text[i] });
        await new Promise(r => setTimeout(r, 6));
      }
    } else {
      const body = response.body;
      if (!body) throw new Error('API 未回傳響應流');
      let buffer = '';
      const decoder = new TextDecoder('utf-8');
      for await (const chunk of body as any) {
        buffer += decoder.decode(chunk);
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const content = parseChunkLine(active.id, trimmed);
          if (content) { sendEvent('chunk', { text: content }); replyAccumulated += content; }
        }
      }
      if (buffer.trim()) {
        const content = parseChunkLine(active.id, buffer.trim());
        if (content) { sendEvent('chunk', { text: content }); replyAccumulated += content; }
      }
    }

    writeLog('INFO', 'Turn ended: reason=stop');
  } catch (err: any) {
    const errMsg = err.message || String(err);
    writeLog('ERROR', `API呼叫失敗: ${errMsg}`);
    sendEvent('status', { text: 'API 呼叫失敗，啟用展示模式 fallback...' });
    await new Promise(r => setTimeout(r, 1000));
    await runFallback(`真實 API 連線失敗 - ${errMsg}`);
    writeLog('INFO', 'Turn ended: reason=stop');
  } finally {
    if (sessionId && replyAccumulated) {
      try {
        const sessions = getSessions();
        const existing = sessions.find(s => s.id === sessionId);
        const timeStr = new Date().toLocaleString('zh-TW', { hour12: false });
        const dbUserImages = images && images.length > 0
          ? images.map((img: any) => `data:${img.mimeType};base64,${img.base64}`)
          : undefined;

        if (existing) {
          const last = existing.messages[existing.messages.length - 1];
          if (!last || last.text !== replyAccumulated) {
            existing.messages.push(
              { id: String(Date.now()), role: 'user', text: prompt, images: dbUserImages },
              { id: String(Date.now() + 1), role: 'ai', text: replyAccumulated }
            );
            existing.preview = replyAccumulated.slice(0, 100) + (replyAccumulated.length > 100 ? '...' : '');
            existing.date = timeStr;
          }
        } else {
          sessions.push({
            id: sessionId,
            title: prompt.length > 30 ? prompt.slice(0, 27) + '...' : prompt,
            date: timeStr,
            preview: replyAccumulated.slice(0, 100) + (replyAccumulated.length > 100 ? '...' : ''),
            messages: [
              { id: String(Date.now()), role: 'user', text: prompt, images: dbUserImages },
              { id: String(Date.now() + 1), role: 'ai', text: replyAccumulated }
            ]
          });
        }
        saveSessions(sessions);
      } catch (e) { console.error('Save session failed:', e); }
    }
    res.write('event: done\ndata: \n\n');
    res.end();
  }
});

export default router;
