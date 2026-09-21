#!/usr/bin/env bash
# ==============================================================================
# Local Smart Desktop - 新環境一鍵快速安裝與啟動腳本
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

MODE="${1:-desktop}"
WITH_PYTHON="${2:-}"

# 若第一個參數是 --with-python，預設啟動模式為 desktop
if [ "$MODE" == "--with-python" ]; then
  MODE="desktop"
  WITH_PYTHON="--with-python"
fi

# Python AI 後端專案路徑 (far_swarm_ai_local)
PYTHON_DIR="${PYTHON_PROJECT_DIR:-$(cd "$PROJECT_DIR/../swarm_core_ai/far_swarm_ai_local" 2>/dev/null && pwd || echo "$PROJECT_DIR/../swarm_core_ai/far_swarm_ai_local")}"

echo "========================================================"
echo "🚀 Local Smart Desktop 快速啟動與環境管理"
echo "📂 前端/桌面路徑: $PROJECT_DIR"
echo "🐍 Python後端路徑: $PYTHON_DIR"
echo "🎯 運行模式: $MODE"
echo "========================================================"

# ------------------------------------------------------------------------------
# 1. 檢查與安裝 Node.js 前端 / 桌面環境
# ------------------------------------------------------------------------------
if ! command -v node &> /dev/null; then
  echo "❌ 找不到 Node.js，請先安裝 Node.js (推薦 v18+ 或 v20+)"
  exit 1
fi
echo "✅ Node.js 版本: $(node -v)"

if [ ! -d "node_modules" ]; then
  echo "📦 [Node] 偵測到尚未安裝依賴，正在執行 npm install..."
  npm install
  echo "✅ [Node] npm 套件安裝完成！"
fi

if [ ! -f "dist-backend/main/index.js" ]; then
  echo "🔨 [Node] 正在編譯後端 (TypeScript)..."
  npm run build:backend
  echo "✅ [Node] 後端編譯完成！"
fi

# ------------------------------------------------------------------------------
# 2. Python AI 後端環境管理 (.venv 與 requirements.txt)
# ------------------------------------------------------------------------------
setup_python_env() {
  if [ ! -d "$PYTHON_DIR" ]; then
    echo "⚠️  [Python] 找不到 Python 後端目錄: $PYTHON_DIR，略過 Python 環境安裝。"
    return 0
  fi

  if ! command -v python3 &> /dev/null; then
    echo "⚠️  [Python] 系統未安裝 python3，無法建立虛擬環境。"
    return 1
  fi

  VENV_DIR="$PYTHON_DIR/.venv"
  REQ_FILE="$PYTHON_DIR/requirements.txt"

  if [ ! -d "$VENV_DIR" ]; then
    echo "🐍 [Python] 未偵測到虛擬環境，正在為 $PYTHON_DIR 建立 .venv..."
    python3 -m venv "$VENV_DIR"
    echo "✅ [Python] .venv 虛擬環境建立成功！"
    INSTALL_REQ=true
  else
    echo "✅ [Python] 偵測到現有虛擬環境: $VENV_DIR"
  fi

  # 檢查 requirements.txt 並安裝
  if [ -f "$REQ_FILE" ] && [ "$INSTALL_REQ" == "true" ]; then
    echo "📥 [Python] 正在安裝 requirements.txt 依賴至 .venv (可能需要數分鐘)..."
    "$VENV_DIR/bin/pip" install --upgrade pip
    "$VENV_DIR/bin/pip" install -r "$REQ_FILE"
    echo "✅ [Python] requirements.txt 安裝完成！"
  elif [ -f "$REQ_FILE" ] && [ "$1" == "--force" ]; then
    echo "📥 [Python] 強制更新 requirements.txt 依賴..."
    "$VENV_DIR/bin/pip" install -r "$REQ_FILE"
  fi

  export PYTHON_PATH="$VENV_DIR/bin/python"
  export PYTHON_PROJECT_DIR="$PYTHON_DIR"
}

# 若使用者執行 ./start.sh setup 或 install，只做全環境安裝
if [ "$MODE" == "setup" ] || [ "$MODE" == "install" ]; then
  echo "⚙️  執行完整環境初始化 (Node.js + Python .venv)..."
  setup_python_env --force
  echo "🎉 全部環境安裝與編譯完成！可執行 ./start.sh 啟動應用。"
  exit 0
fi

# ------------------------------------------------------------------------------
# 3. 處理 Python 後端啟動旗標
# ------------------------------------------------------------------------------
if [ "$WITH_PYTHON" == "--with-python" ]; then
  setup_python_env
  export ENABLE_PYTHON_BACKEND=true
  echo "🐍 已啟用 Python 後端同步啟動 (Port: 8002)"
fi

# ------------------------------------------------------------------------------
# 4. Port 狀態偵測
# ------------------------------------------------------------------------------
PORT_8000_PID=$(lsof -ti :8000 || true)
if [ -n "$PORT_8000_PID" ] && [ "$MODE" != "window" ]; then
  echo "ℹ️  Port 8000 已在運行 (PID: $PORT_8000_PID)，桌面模式將自動復用現有後端服務。"
fi

# ------------------------------------------------------------------------------
# 5. 依指定模式啟動
# ------------------------------------------------------------------------------
case "$MODE" in
  web)
    echo "🌐 啟動瀏覽器網頁模式 (Web Mode)..."
    npm run dev
    ;;
  window)
    echo "🪟 僅喚起原生桌面視窗 (Desktop Window)..."
    npm run desktop:window
    ;;
  desktop|*)
    echo "🖥️  啟動完整桌面模式 (Electron + Vite)..."
    npm run dev:desktop
    ;;
esac
