# 系統架構與前後端通訊 (System Architecture & SSE Stream)

Local-SMART 採用了輕量級的前後端分離架構，旨在提供極低的本地延遲與實時的日誌反饋。下圖展示了系統的主要模組與資料流向：

![系統架構與資料流](images/system_architecture.svg)

---

## 🏗️ 後端架構與目錄結構 (Backend Service)

後端基於 Express 構建，入口點為 [src/main/index.ts](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/main/index.ts)。它掛載了多個功能模組化路由，並管理與本地 Log 文件的連接。

### 1. 主要路由模組
後端路由在 [src/main/routes](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/main/routes) 目錄中定義：
* `profile.ts`：管理 AI 代理設定檔（System Prompt, Name 等）。
* `sessions.ts`：會話歷程儲存、讀取與清空。
* `system.ts`：提供系統硬體診斷（CPU 負載、記憶體使用率、GPU 與 VRAM 狀態）以及 MCP 伺服器的狀態檢測。
* `misc.ts`：模型 Providers 配置等雜項 API。
* `chat.ts`：對話發送、與 AI 模型進行 API 串接。
* `gateway.ts`：設定 SSH 閘道。
* `memory.ts`：AI 記憶/知識庫資料夾配置。

### 2. 實時日誌監控機制 (SSE Log Monitor)
後端實現了一個高性能的 **Server-Sent Events (SSE)** 服務，其核心邏輯如下：

1. **連線建立**：
   - 前端 React 透過瀏覽器內建的 `EventSource('/api/monitor/stream')` 向後端發起持久連線。
   - 後端將 Response Header 設為 `'Content-Type': 'text/event-stream'`，並保持連線暢通。
2. **歷史日誌讀取**：
   - 連線建立之初，後端會主動讀取 [local-smart.log](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/main/config.ts) 檔案的最後 30 行，進行解析並推送給前端，確保前端初始化時有歷史日誌可看。
3. **實時 Tail 監控**：
   - 後端使用定時器（每 200ms）獲取日誌文件的大小（`fs.statSync`）。
   - 當發現文件大小增加時，後端開啟檔案指針（File Descriptor）從上次的位置讀取新增的字元（Buffer），藉此實現輕量級的日誌 Tail 效果，而無需引入額外的 OS 依賴。
4. **日誌解析與狀態提取 (Regex)**：
   - 後端利用正規表達式（Regex）對日誌的每一行進行模式匹配：
     * **偵測 AI 大腦模型**：匹配 `model=...`，自動歸類並切換頭像（如 `DeepSeek-v4-pro`、`gpt-5.3-codex`、`mistral-large-3`）。
     * **偵測工具調用與狀態**：匹配 `agent.tool_executor: tool [tool_name] [completed|failed]`，提取當前運行的工具並更新進度百分比（如發送請求 30%、工具執行 80%、任務完成 100%）。
   - 後端將解析後的 JSON 對象以 SSE `event: log` 格式推送到前端。

---

## ⚛️ 前端實時接收與渲染 (Frontend Reactive UI)

在前端 [src/renderer/src/App.tsx](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/renderer/src/App.tsx) 中，SSE 的數據流被無縫對接到 React 狀態中：

```typescript
useEffect(() => {
  if (showSplash) return;

  const connectSSE = () => {
    const sse = new EventSource('/api/monitor/stream');

    sse.addEventListener('log', (event) => {
      const data = JSON.parse(event.data);
      if (data.agent) setAgentName(data.agent);
      if (data.tool) setActiveTool(data.tool);
      if (typeof data.percentage === 'number') setPercentage(data.percentage);
      if (data.log) {
        setLogLines(prev => [...prev, { id: ..., msg: data.log }].slice(-150));
      }
    });

    return sse;
  };

  const activeSSE = connectSSE();
  return () => activeSSE.close();
}, [showSplash]);
```

### 渲染優化與防抖：
* **滾動定位**：使用 React `useRef` 指向日誌 Terminal 容器，當新日誌加入時，自動平滑滾動到最下方。
* **日誌緩存控制**：前端僅在記憶體中保留最新的 150 行日誌，防止長時間運行造成網頁記憶體溢出。
