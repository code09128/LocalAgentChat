# AI 代理人工作流與工具鏈調度 (Agent & Tool Workflow)

Local-SMART 的核心價值在於其高度自動化的**自主代理人 (Conductor)** 工作流。下圖展示了從使用者輸入任務到 AI 執行並回傳狀態的完整生命週期：

![AI 代理與工具調用工作流](images/agent_tool_workflow.svg)

---

## 🔄 工作流步驟詳解 (Workflow Steps)

### 1. 任務接收 (User Task Input)
* 使用者在 [Chat 面板](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/renderer/src/screens/Chat.tsx) 中輸入複雜任務指令（如：「在專案中建立一個 README.md 檔案並撰寫說明」）。
* 前端將任務包裝為 JSON 發送至後端 API `/api/chat`。

### 2. 思維規劃 (Conductor Planning)
* 後端 [src/main/routes/chat.ts](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/main/routes/chat.ts) 接收請求，調用當前啟用的 AI 大腦模型（例如 `DeepSeek-v4-pro` 或 `Claude-3.5-Sonnet`）。
* AI 大腦分析任務，啟動思維鏈（Thinking/Reasoning），決定是否需要使用外部工具來完成任務，並輸出步驟規劃。
* 同時，運行時會在日誌檔案 [local-smart.log](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/main/config.ts) 中寫入一條表示「任務啟動」的日誌：
  ```
  conversation_loop: conversation turn: msg='任務啟動...'
  ```
* 後台 SSE 監控器檢測到此日誌，前端接收並將進度條推至 `10%`。

### 3. 工具分派與執行 (Tool Dispatch & Execution)
* 當 AI 大腦輸出包含「工具調用 (Tool Call)」時，後端的 [task.ts](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/main/task.ts) 或執行器會接管：
  * **本地指令執行**：例如調用 `run_command` / `execute_code`，後端會在受控環境中執行 shell 指令。
  * **檔案系統操作**：例如調用 `write_file` / `read_file`，讀寫本地專案檔案。
  * **MCP 服務調用**：向 ONLINE 的 MCP 伺服器發送 JSON-RPC 請求，調用外部整合的 API。
* 後端會將此執行行為記錄於日誌：
  ```
  agent.tool_executor: tool write_file
  ```
* SSE 監控器檢測到日誌，將工具名稱提取，並將進度條更新至 `60%`。

### 4. 執行結果寫入與日誌攔截 (Log Capture)
* 工具執行完成或失敗後，系統會將結果及錯誤訊息（若有）寫入日誌：
  ```
  agent.tool_executor: tool write_file completed
  ```
* 如果是由程式解算器（如 `gpt-5.3-codex`）執行的代碼，日誌也會即時捕獲代碼輸出，寫入日誌中。
* SSE 監控器檢測到此事件，將進度更新至 `80%`，並將工具狀態標示為完成。

### 5. 實時回傳與 UI 更新 (SSE Streaming & Reactive UI)
* SSE 伺服器 tailing 到日誌的追加內容後，即時向所有已連線的前端推送格式化的 JSON 事件。
* 右側常駐監控面板的 **Conductor 卡片** 與 **即時日誌攔截器** 收到事件後，立刻觸發 React 的 state 更新：
  - 更新大腦發光頭像（如大腦 SVG 路徑的動畫速度與光效會隨執行狀態改變）。
  - 進度環更新（如從 `30%` -> `60%` -> `80%`）。
  - 日誌終端輸出最新的一行，並平滑滾動。

### 6. 任務結束 (Turn End)
* 當 AI 代理人認為所有任務均已完成時，會結束本次對話輪次（Turn），日誌記錄：
  ```
  Turn ended: reason=normal_stop
  ```
* 前端收到後，進度百分比拉至 `100%`，頭像回到靜態待命（Idle）狀態，日誌終端印出 `[ZH-TW] 任務完成 (正常結束)`。
