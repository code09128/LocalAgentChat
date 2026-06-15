# Local-SMART 本地 AI 桌面控制台 (Local AI Desktop Controller)

歡迎使用 **Local-SMART**！這是一個專為本地 AI 工作流與自主代理（Agent）設計的科幻風格桌面圖形控制面板（Desktop Controller）。

本專案將 React 19 + Tailwind CSS v4 前端與 Express 後端服務深度整合，核心特色是常駐於右側的 **Office 監控中心**，其透過 Server-Sent Events (SSE) 實時 tail 後台運行日誌，可視化展現 AI 代理（如 DeepSeek-v4-pro, gpt-5.3-codex 等）的思維規劃、工具執行進度與實時終端日誌。

---

## 📚 專案功能與架構文檔導覽

為了幫助您與開發者快速掌握 Local-SMART 的架構與實現細節，我們建立了以下詳細說明文檔：

1. **[專案總覽 (Overview)](file:///e:/AI/local_ai_desktop/local_ai_desktop/docs/overview.md) | [相對路徑](docs/overview.md)**
   - 介紹設計理念、前端與後端的技術棧（Vite, React 19, Tailwind v4, Express, tsx）以及介面的三欄式科幻佈局。
   - 包含 **[UI 佈局示意圖](file:///e:/AI/local_ai_desktop/local_ai_desktop/docs/images/ui_dashboard_layout.svg)**。

2. **[系統架構與前後端通訊 (Architecture)](file:///e:/AI/local_ai_desktop/local_ai_desktop/docs/architecture.md) | [相對路徑](docs/architecture.md)**
   - 解密後端如何監控本地日誌文件變更，並通過 Server-Sent Events (SSE) `/api/monitor/stream` 將進度與日誌實時串流推送至前端。
   - 包含 **[系統資料流架構圖](file:///e:/AI/local_ai_desktop/local_ai_desktop/docs/images/system_architecture.svg)**。

3. **[功能模組說明 (Features)](file:///e:/AI/local_ai_desktop/local_ai_desktop/docs/features.md) | [相對路徑](docs/features.md)**
   - 深入介紹每一個操作畫面（Chat 對話區、Sessions 歷程、Office 系統診斷、Settings 系統設定中心）的對應前端代碼、API 端口及配置細節。

4. **[AI 代理人工作流與工具鏈調度 (Workflow)](file:///e:/AI/local_ai_desktop/local_ai_desktop/docs/workflow.md) | [相對路徑](docs/workflow.md)**
   - 詳述 AI Conductor 接收任務、大腦思維規劃、調用外部工具與 MCP 服務、日誌攔截至前端實時渲染的資料閉環。
   - 包含 **[Agent 工具調用工作流圖](file:///e:/AI/local_ai_desktop/local_ai_desktop/docs/images/agent_tool_workflow.svg)**。

---

## 🛠️ 本地開發與啟動 (Local Development)

### 1. 安裝依賴
```bash
npm install
```

### 2. 啟動開發伺服器
專案使用 `concurrently` 同時啟動前端 Vite 伺服器與後端 tsx 監控伺服器：
```bash
npm run dev
```
* **前端**：預設運行於 [http://localhost:5173](http://localhost:5173)
* **後端**：預設運行於 [http://localhost:8000](http://localhost:8000)

### 3. 生產環境建置
```bash
npm run build
```
