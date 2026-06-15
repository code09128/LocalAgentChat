# 專案總覽 (Project Overview)

**Local-SMART** 是一個專為本地 AI 工作流與自主代理（Agent）設計的桌面圖形控制面板（Local AI Desktop Controller）。它集成了本地模型、雲端 LLM API、Model Context Protocol (MCP) 外掛工具，並提供一個極具未來科技感的儀表板介面，方便使用者實時監控 AI 代理的思維過程、工具調用進度與背景日誌。

---

## 🚀 技術棧 (Technology Stack)

本專案採用現代 Web 技術構建，分為前端渲染層與本地後端服務層：

### 1. 前端渲染層 (Frontend)
* **核心框架**：[React 19](file:///e:/AI/local_ai_desktop/local_ai_desktop/package.json#L17) 與 [Vite](file:///e:/AI/local_ai_desktop/local_ai_desktop/package.json#L38)
* **樣式工具**：[Tailwind CSS v4](file:///e:/AI/local_ai_desktop/local_ai_desktop/package.json#L22) (搭配 `@tailwindcss/vite` 插件)
* **特點**：
  - **Glassmorphism 玻璃擬物風格**：使用半透明背景、霓虹發光邊框與流暢的動態微交互。
  - **科幻儀表板**：常駐右側的監控中心，具有旋轉星軌 Avatar、動態進度環與實時終端日誌。

### 2. 後端服務層 (Backend)
* **核心框架**：[Express](file:///e:/AI/local_ai_desktop/local_ai_desktop/package.json#L16)
* **運行環境**：Node.js 22 + [tsx](file:///e:/AI/local_ai_desktop/local_ai_desktop/package.json#L35) (以 TypeScript 模式直接熱重載運行)
* **通訊機制**：
  - **REST APIs**：用於儲存設定、管理會話、加載模型等。
  - **Server-Sent Events (SSE)**：實時串流推送後台運行日誌與 Agent 執行進度。

---

## 🖥️ 介面佈局說明 (Interface Layout)

Local-SMART 介面採用極速響應的**三欄式佈局**，將導覽、工作區與實時監控完美整合：

![UI 佈局示意圖](images/ui_dashboard_layout.svg)

### 1. 左側導覽列 (Sidebar Navigation)
* 快速切換主功能版面。
* **對話區 (Chat)**、**會話歷程 (Sessions)**、**代理人設定檔 (Profiles)**、**診斷儀表板 (Office)**、**系統設定 (Settings)**。
* 底部實時顯示後端連線狀態與版本號。

### 2. 中間工作區 (Center Workspace Panel)
* 根據導覽列選擇動態渲染對應的畫面：
  - **Chat 畫面**：提供與 AI 進行日常對話或分派複雜 Agent 任務的對話框。
  - **Sessions 歷程**：以網格卡片呈現所有歷史會話的日期、ID 與內容預覽。
  - **Agents 畫面**：設定 AI 代理人的 System Prompt 以及角色定位。
  - **Office 儀表板**：展示 CPU 負載、記憶體與 GPU/VRAM 實時使用率，以及 MCP 外掛伺服器狀態。
  - **Settings 設定**：管理 LLM Providers (OpenAI, Gemini 等)、SSH 網關、Tools 工具與知識庫。

### 3. 右側監控中心 (Right Dashboard Monitoring Panel)
* **常駐於畫面右側**，為使用者提供上帝視角（Conductor Mode）：
  - **Conductor 指揮部**：顯示當前主導的 AI 模型。根據當前運算的模型，以不同的科幻圖樣發光動態顯示（例如 DeepSeek 大腦圖、Codex 程式解算器、Mistral 文檔專家等）。
  - **工具監控**：顯示圓形進度環與總進度條，實時反饋 AI 正在執行的工具（如 `read_file`、`run_command`）與進度百分比。
  - **即時日誌攔截**：攔截並格式化顯示後端 Agent 產生的日誌。

---

> [!TIP]
> 當您點擊 Sidebar 的各個項目時，中間工作區會瞬間切換，但**右側監控面板會保持常駐**，確保不論您在進行何種操作，均能實時掌握背景 Agent 的執行狀態。
