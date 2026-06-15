# 功能模組說明 (Features & Modules)

Local-SMART 提供了多個功能專一、介面科幻且響應迅速的功能畫面，均在 [src/renderer/src/screens](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/renderer/src/screens) 下實作。

---

## 💬 Chat 對話區 (Chat Screen)
* **檔案路徑**：[Chat.tsx](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/renderer/src/screens/Chat.tsx)
* **核心功能**：
  - **多模型聊天**：支援與當前啟用的 LLM 模型進行流式或非流式對話。
  - **任務指派**：使用者可以直接在此向 AI 代理下達系統命令，AI 代理會調用 Tools 執行，並由右側監控面板顯示執行進度。
  - **附件與上下文**：支援檔案拖放或附件上傳，作為 AI 對話的脈絡參考。

## 🕒 Sessions 對話歷程 (Sessions Screen)
* **核心功能**：
  - **會話切換**：在主畫面加載並列出後端保存的所有會話卡片，方便使用者點擊切換、重啟歷史對話。
  - **快照預覽**：每張會話卡片皆顯示會話日期、簡短標題以及最後一則對話內容的縮略預覽。
  - **一鍵重設**：可在一般設定中清除並重置所有 SQLite/本地對話歷史。

## 📊 Office 系統診斷儀表板 (Office Dashboard)
* **核心功能**：
  - **系統負載監控**：每 2 秒向後端 `/api/system/usage` 請求一次硬體狀態，包含 CPU 使用率、記憶體（已用/總量）佔用比。
  - **GPU 診斷**：顯示當前 GPU 的名稱，以及 VRAM 的實時佔用大小與百分比，這對運行本地 Ollama 模型的開發者至關重要。
  - **MCP 狀態監控**：列出當前註冊的 Model Context Protocol 伺服器狀態（如 `ONLINE` 或 `OFFLINE`），並顯示其綁定 URL。

## 👤 Profiles 代理人設定 (Agents/Profiles Screen)
* **檔案路徑**：[Agents.tsx](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/renderer/src/screens/Agents.tsx)
* **核心功能**：
  - **角色扮演 (System Prompt)**：使用者可以定義或選擇不同的 Agent 角色，為其設定個性化的 system prompt（例如：程式專家、長文本分析師）。
  - **代理分配**：針對特定工作流自訂其偏好的主導模型與調用工具權限。

## ⚙️ Settings 系統設定中心 (Settings Screen)
設定中心採用子分頁（Sub Tabs）設計，涵蓋以下五大系統配置：

### 1. LLM API 設定 (Models)
* **檔案路徑**：[Models.tsx](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/renderer/src/screens/Models.tsx)
* **核心功能**：
  - **多供應商管理**：配置並啟用/停用 `OpenAI`、`Gemini`、`Claude`、`Azure OpenAI` 等。
  - **Ollama 本地模型發現**：提供一鍵「取得本地模型」功能，能直接通過 HTTP 請求向 Ollama 服務端取得已拉取的模型清單（如 `llama3`, `deepseek-coder`），並進行模型切換。
  - **FArobot 整合服務**：提供豐富的雲端模型速查表，並按類型（Chat, Reasoning, Code, Image, Embedding, OCR）進行過濾與快速切換。

### 2. SSH Gateway 閘道 (Gateway)
* **檔案路徑**：[Gateway.tsx](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/renderer/src/screens/Gateway.tsx)
* **核心功能**：
  - **遠端中繼連線**：配置 SSH 伺服器 Host、Port、Username 和密碼或私鑰。
  - **安全代理**：讓本地 AI Agent 可以透過加密隧道對遠端伺服器進行安全的代碼部署或運維指令執行。

### 3. Tools 外掛工具 (Tools)
* **檔案路徑**：[Tools.tsx](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/renderer/src/screens/Tools.tsx)
* **核心功能**：
  - **工具與 MCP 管理**：啟用或停用內建的沙盒工具（例如：Terminal Command 執行、檔案系統讀寫）。
  - **自訂 MCP 伺服器**：動態註冊外部 MCP 伺服器，將客製化 API（如搜尋引擎、資料庫查詢）作為 AI 代理的可用工具。

### 4. Memory 知識庫 (Memory)
* **檔案路徑**：[Memory.tsx](file:///e:/AI/local_ai_desktop/local_ai_desktop/src/renderer/src/screens/Memory.tsx)
* **核心功能**：
  - **長期記憶與 RAG**：指定本地資料夾或文字檔作為 AI 的外部知識庫。
  - **向量檢索**：使 AI 代理在回答問題時，自動檢索相關文檔，減少幻覺，提高精準度。
