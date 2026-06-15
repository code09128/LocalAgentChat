import { useState, useEffect, useRef } from 'react';
import Setup from './screens/Setup.js';
import Chat from './screens/Chat.js';
import Task from './screens/Task.js';
import Agents from './screens/Agents.js';
import Models from './screens/Models.js';
import Gateway from './screens/Gateway.js';
import Tools from './screens/Tools.js';
import Memory from './screens/Memory.js';

type Screen = 'chat' | 'sessions' | 'profiles' | 'office' | 'task' | 'models' | 'settings';
type SettingsTab = 'llm' | 'gateway' | 'tools' | 'memory' | 'general';

interface LogEntry {
  id: string;
  timestamp: string;
  msg: string;
}

const tabIcons = {
  llm: (
    <svg viewBox="0 0 24 24" className="tab-icon">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  ),
  gateway: (
    <svg viewBox="0 0 24 24" className="tab-icon">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  ),
  tools: (
    <svg viewBox="0 0 24 24" className="tab-icon">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  memory: (
    <svg viewBox="0 0 24 24" className="tab-icon">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  general: (
    <svg viewBox="0 0 24 24" className="tab-icon">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeScreen, setActiveScreen] = useState<Screen>('chat');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('llm');

  // System usage diagnostics
  const [systemUsage, setSystemUsage] = useState<any>({
    cpu: 0,
    memory: { used: '0', total: '0', percentage: 0 },
    gpu: {
      name: '偵測中...',
      usage: 0,
      vram: { used: '0.00', total: '0.0', percentage: 0 }
    }
  });
  const [mcpStatus, setMcpStatus] = useState<any[]>([]);

  // Session & conversation history states
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [dbSessions, setDbSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    if (activeScreen === 'sessions') {
      setLoadingSessions(true);
      fetch('/api/sessions')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setDbSessions(data);
          }
        })
        .catch(err => console.error("Fetch sessions error", err))
        .finally(() => setLoadingSessions(false));
    }
  }, [activeScreen]);

  useEffect(() => {
    if (activeScreen === 'office') {
      const fetchUsage = () => {
        fetch('/api/system/usage')
          .then(r => r.json())
          .then(data => {
            if (data && data.memory) {
              setSystemUsage(data);
            }
          })
          .catch(err => console.error("Fetch system usage error", err));

        fetch('/api/mcp/status')
          .then(r => r.json())
          .then(data => {
            if (Array.isArray(data)) {
              setMcpStatus(data);
            }
          })
          .catch(err => console.error("Fetch MCP status error", err));
      };

      fetchUsage();
      const tid = setInterval(fetchUsage, 2000);
      return () => clearInterval(tid);
    }
  }, [activeScreen]);


  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    setActiveScreen('chat');
  };

  const handleResetSessions = async () => {
    if (confirm("確定要重置並清空所有對話歷史紀錄嗎？此動作無法復原。")) {
      try {
        const res = await fetch('/api/sessions', { method: 'DELETE' });
        if (res.ok) {
          setDbSessions([]);
          setCurrentSessionId(null);
          alert('對話歷史紀錄已全部重設清空。');
        } else {
          alert('清除失敗，請稍後再試。');
        }
      } catch (err) {
        console.error("Failed to delete sessions", err);
        alert('連線失敗，請檢查後端服務。');
      }
    }
  };

  // Conductor monitoring states
  const [agentName, setAgentName] = useState('DeepSeek-v4-pro (🧠 主大腦)');
  const [activeTool, setActiveTool] = useState('待命');
  const [percentage, setPercentage] = useState(0);
  const [logLines, setLogLines] = useState<LogEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  const logTerminalRef = useRef<HTMLDivElement>(null);

  // Global log monitor SSE connection
  useEffect(() => {
    if (showSplash) return; // Wait until onboarding ends

    const connectSSE = () => {
      setConnectionStatus('connecting');
      const sse = new EventSource('/api/monitor/stream');

      sse.onopen = () => {
        setConnectionStatus('connected');
      };

      sse.onerror = () => {
        setConnectionStatus('disconnected');
        // Retry connection after 5 seconds
        setTimeout(connectSSE, 5000);
      };

      sse.addEventListener('log', (event: any) => {
        try {
          const data = JSON.parse(event.data);

          if (data.agent) setAgentName(data.agent);
          if (data.tool) setActiveTool(data.tool);
          if (typeof data.percentage === 'number') setPercentage(data.percentage);

          if (data.log) {
            setLogLines(prev => {
              const updated = [
                ...prev,
                {
                  id: String(Math.random() + Date.now()),
                  timestamp: data.timestamp || new Date().toLocaleTimeString(),
                  msg: data.log
                }
              ];
              // Keep last 150 lines
              return updated.slice(-150);
            });
          }
        } catch (e) {
          console.error("SSE parse error", e);
        }
      });

      return sse;
    };

    const activeSSE = connectSSE();

    return () => {
      activeSSE.close();
    };
  }, [showSplash]);

  // Auto-scroll log console to bottom
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [logLines]);

  const copyLogs = () => {
    const text = logLines.map(line => `[${line.timestamp}] ${line.msg}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      alert('日誌已複製到剪貼簿！');
    }).catch(err => {
      console.error(err);
    });
  };

  const clearLogs = () => {
    setLogLines([]);
  };

  // Determine avatar active status based on current agent name
  const isDeepseek = agentName.toLowerCase().includes('deepseek');
  const isCodex = agentName.toLowerCase().includes('codex') || agentName.toLowerCase().includes('程式解算器') || agentName.toLowerCase().includes('gpt-5.3');
  const isMistral = agentName.toLowerCase().includes('mistral') || agentName.toLowerCase().includes('長文本專家');
  const isDefault = !isDeepseek && !isCodex && !isMistral;

  // Math for circular progress ring (radius=40, circumference=251.2)
  const strokeDashoffset = 251.2 - (251.2 * percentage) / 100;

  if (showSplash) {
    return <Setup onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="app-container">

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-area">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="url(#appLogoGrad)" />
            <path d="M2 17L12 22L22 17" stroke="url(#appLogoGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="url(#appLogoGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="appLogoGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffb700" />
                <stop offset="100%" stopColor="#ff7700" />
              </linearGradient>
            </defs>
          </svg>
          <span className="logo-text">Local-SMART</span>
        </div>

        <nav className="sidebar-nav">
          <button
            onClick={() => setActiveScreen('chat')}
            className={`nav-item cursor-pointer text-left w-full ${activeScreen === 'chat' ? 'active' : ''}`}
          >
            <svg viewBox="0 0 24 24" className="nav-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            <span>Chat 對話區</span>
          </button>

          <button
            onClick={() => setActiveScreen('sessions')}
            className={`nav-item cursor-pointer text-left w-full ${activeScreen === 'sessions' ? 'active' : ''}`}
          >
            <svg viewBox="0 0 24 24" className="nav-icon">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span>Sessions 歷程</span>
          </button>

          <button
            onClick={() => setActiveScreen('profiles')}
            className={`nav-item cursor-pointer text-left w-full ${activeScreen === 'profiles' ? 'active' : ''}`}
          >
            <svg viewBox="0 0 24 24" className="nav-icon">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Profiles 設定檔</span>
          </button>

          <button
            onClick={() => setActiveScreen('office')}
            className={`nav-item cursor-pointer text-left w-full ${activeScreen === 'office' ? 'active' : ''}`}
          >
            <svg viewBox="0 0 24 24" className="nav-icon">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Office 儀表板</span>
          </button>



          <button
            onClick={() => setActiveScreen('settings')}
            className={`nav-item cursor-pointer text-left w-full ${activeScreen === 'settings' ? 'active' : ''}`}
          >
            <svg viewBox="0 0 24 24" className="nav-icon">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings 設定</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <span className="version-text">v1.0</span>
          <span className="status-badge-container">
            <span className={`status-dot ${connectionStatus === 'connected' ? 'green' : 'red'} animate-pulse`}></span>
            <span className="status-label">SYS OK</span>
          </span>
        </div>
      </aside>

      {/* Center Panel (Dynamically Switched) */}
      {activeScreen === 'chat' && (
        <Chat sessionId={currentSessionId} onSessionChange={setCurrentSessionId} />
      )}

      {activeScreen === 'sessions' && (
        <main className="chat-panel">
          <header className="panel-header">
            <div className="header-title-container">
              <h2>Sessions 對話歷程</h2>
              <div className="active-connection">
                <span className="status-dot green animate-pulse"></span>
                <span className="status-label text-dim">{dbSessions.length} sessions found</span>
              </div>
            </div>
            <div className="header-actions">
              <button
                onClick={() => {
                  setCurrentSessionId(null);
                  setActiveScreen('chat');
                }}
                className="glass-btn btn-sm cursor-pointer flex items-center gap-1.5 font-medium"
                title="開啟新對話"
              >
                <svg viewBox="0 0 24 24" className="btn-icon">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>開啟新對話</span>
              </button>
            </div>
          </header>
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
            {loadingSessions ? (
              <div className="text-center p-8 text-dim font-mono text-xs">讀取歷史紀錄中...</div>
            ) : dbSessions.length === 0 ? (
              <div className="text-center p-8 text-dim font-mono text-xs italic">無歷史對話紀錄</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dbSessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className="glass-panel p-4 flex flex-col gap-2 border-white/5 bg-white/[0.01] hover:bg-white/5 cursor-pointer transition-all"
                  >
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-gold">{s.date}</span>
                      <span className="text-slate-500">ID: {s.id.slice(-6)}</span>
                    </div>
                    <h4 className="font-semibold text-sm text-slate-100 line-clamp-1">{s.title}</h4>
                    <p className="text-xs text-dim line-clamp-2 mt-1">{s.preview}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {activeScreen === 'profiles' && <Agents />}

      {activeScreen === 'office' && (
        <main className="chat-panel">
          <header className="panel-header">
            <div className="header-title-container">
              <h2>Office 系統運算診斷儀表板</h2>
              <div className="active-connection">
                <span className="status-dot green animate-pulse"></span>
                <span className="status-label text-dim">Diagnostics Link OK</span>
              </div>
            </div>
          </header>
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="glass-panel p-4 flex flex-col gap-1 border-white/5 bg-white/[0.01]">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">系統負載</span>
                <span className="text-xl font-bold text-cyan mt-1">{systemUsage.cpu} %</span>
                <span className="text-xs text-dim mt-0.5">CPU Load</span>
              </div>
              <div className="glass-panel p-4 flex flex-col gap-1 border-white/5 bg-white/[0.01]">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">記憶體使用率</span>
                <span className="text-xl font-bold text-purple mt-1">{systemUsage.memory.percentage} %</span>
                <span className="text-xs text-dim mt-0.5">{systemUsage.memory.used}GB / {systemUsage.memory.total}GB</span>
              </div>
              <div className="glass-panel p-4 flex flex-col gap-1 border-white/5 bg-white/[0.01]">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">GPU 使用率</span>
                <span className="text-xl font-bold text-emerald-400 mt-1">{systemUsage.gpu.usage} %</span>
                <span className="text-xs text-dim mt-0.5 line-clamp-1" title={systemUsage.gpu.name}>{systemUsage.gpu.name}</span>
                <span className="text-[10px] text-gold font-mono mt-1">VRAM: {systemUsage.gpu.vram.used}GB / {systemUsage.gpu.vram.total}GB ({systemUsage.gpu.vram.percentage}%)</span>
              </div>
              <div className="glass-panel p-4 flex flex-col gap-1 border-white/5 bg-white/[0.01]">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">本機埠口綁定</span>
                <span className="text-xl font-bold text-gold mt-1">Port 8000</span>
                <span className="text-xs text-dim mt-0.5">Express SSE App</span>
              </div>
              <div className="glass-panel p-4 flex flex-col gap-1 border-white/5 bg-white/[0.01]">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">連線狀態</span>
                <span className="text-xl font-bold text-green mt-1">Active</span>
                <span className="text-xs text-dim mt-0.5">127.0.0.1 link</span>
              </div>
            </div>
            <div className="glass-panel p-5 border-white/5 flex flex-col gap-3">
              <h3 className="text-sm font-semibold tracking-wider text-slate-200 uppercase">MCP Server 工具狀態</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mcpStatus.length === 0 ? (
                  <div className="text-xs text-dim font-mono italic p-2 col-span-2">未偵測到 MCP 伺服器</div>
                ) : (
                  mcpStatus.map((srv, idx) => {
                    const isOnline = srv.status === 'ONLINE';
                    return (
                      <div key={idx} className="border border-white/5 p-3 rounded-lg flex items-center justify-between text-xs bg-white/[0.005]">
                        <div>
                          <span className="font-semibold text-slate-300">{srv.name}</span>
                          <div className="text-[10px] text-dim mt-0.5">{srv.url}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] ${
                          isOnline
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border border-white/5'
                        }`}>
                          {srv.status}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {activeScreen === 'task' && <Task />}

      {activeScreen === 'settings' && (
        <main className="chat-panel">
          <header className="panel-header">
            <div className="header-title-container">
              <h2>Settings 系統設定中心</h2>
              <div className="active-connection">
                <span className="status-dot green animate-pulse"></span>
                <span className="status-label text-dim">Configuration portal active</span>
              </div>
            </div>
          </header>

          {/* Sub Tab Navigation */}
          <div className="sci-fi-tabs">
            {[
              { id: 'llm', label: 'LLM API 設定', icon: tabIcons.llm },
              { id: 'gateway', label: 'SSH Gateway 閘道', icon: tabIcons.gateway },
              { id: 'tools', label: 'Tools 外掛工具', icon: tabIcons.tools },
              { id: 'memory', label: 'Memory 知識庫', icon: tabIcons.memory },
              { id: 'general', label: '一般設定', icon: tabIcons.general }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSettingsTab(tab.id as any)}
                className={`sci-fi-tab-btn ${settingsTab === tab.id ? 'active' : ''}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {settingsTab === 'llm' && <Models isTabMode={true} />}
            {settingsTab === 'gateway' && <Gateway />}
            {settingsTab === 'tools' && <Tools />}
            {settingsTab === 'memory' && <Memory />}
            {settingsTab === 'general' && (
              <div className="p-6 flex flex-col gap-6">
                <div className="glass-panel p-5 flex flex-col gap-4">
                  <h3 className="text-sm font-semibold tracking-wider text-slate-200 uppercase pb-2 border-b border-white/5">
                    一般偏好設定
                  </h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="font-semibold text-slate-300">重置對話歷程</span>
                        <p className="text-[10px] text-dim mt-0.5">清空 local-smart 快取儲存的對話</p>
                      </div>
                      <button onClick={handleResetSessions} className="glass-btn btn-xs px-4 py-1 text-red border-red-500/20! bg-red-500/5 cursor-pointer font-medium">重置</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Right Dashboard Monitoring Panel */}
      <aside className="dashboard-panel">
        <header className="panel-header">
          <h2>Office 監控中心</h2>
          <div className="monitor-mode-badge flex items-center gap-1.5 bg-white/2 px-2 py-0.5 rounded-full border border-white/5">
            <span className={`status-dot ${connectionStatus === 'connected' ? 'green' : 'red'} animate-pulse`}></span>
            <span className="text-[10px] font-mono font-medium">Tail Active</span>
          </div>
        </header>

        <div className="dashboard-content">

          {/* Section 1: Conductor Card */}
          <section className="dashboard-card conductor-card glass-panel">
            <div className="card-header">
              <h3>🏢 Conductor 指揮部</h3>
              <span className={`card-status-badge ${activeTool === '待命' ? 'neon-green' : 'neon-green'}`}>
                {activeTool === '待命' ? 'ACTIVE (IDLE)' : 'RUNNING'}
              </span>
            </div>

            <div className="hologram-viewport">
              <div className="hologram-glow"></div>
              <div className="avatar-container">

                {/* Avatar 1: Deepseek - Brain topology (Cyan glow) */}
                <div className={`avatar-wrapper ${isDeepseek ? 'active' : ''} ${activeTool !== '待命' ? 'busy' : 'idle'}`}>
                  <svg className="avatar-svg" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" stroke="url(#gradCyan)" strokeWidth="2" fill="none" className="orbit-line-slow" />
                    <circle cx="50" cy="50" r="38" stroke="url(#gradCyan)" strokeWidth="1" strokeDasharray="8 6" fill="none" className="orbit-line-fast" />
                    <path d="M50 25 C40 25, 30 35, 35 50 C30 60, 42 70, 50 75 C58 70, 70 60, 65 50 C70 35, 60 25, 50 25 Z" fill="none" stroke="url(#gradCyan)" strokeWidth="2.5" className="brain-path" />
                    <circle cx="50" cy="35" r="3" fill="#00f0ff" />
                    <circle cx="38" cy="48" r="3" fill="#00f0ff" />
                    <circle cx="62" cy="48" r="3" fill="#00f0ff" />
                    <circle cx="50" cy="62" r="3" fill="#00f0ff" />
                    <line x1="50" y1="35" x2="38" y2="48" stroke="url(#gradCyan)" strokeWidth="1" />
                    <line x1="50" y1="35" x2="62" y2="48" stroke="url(#gradCyan)" strokeWidth="1" />
                    <line x1="38" y1="48" x2="50" y2="62" stroke="url(#gradCyan)" strokeWidth="1" />
                    <line x1="62" y1="48" x2="50" y2="62" stroke="url(#gradCyan)" strokeWidth="1" />
                    <defs>
                      <linearGradient id="gradCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00f0ff" />
                        <stop offset="100%" stopColor="#0072ff" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                {/* Avatar 2: Codex - Matrix rectangle (Green glow) */}
                <div className={`avatar-wrapper ${isCodex ? 'active' : ''} ${activeTool !== '待命' ? 'busy' : 'idle'}`}>
                  <svg className="avatar-svg" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" stroke="url(#gradGreen)" strokeWidth="2" fill="none" className="orbit-line-slow" />
                    <rect x="25" y="25" width="50" height="50" rx="8" stroke="url(#gradGreen)" strokeWidth="2" fill="none" className="matrix-rect" />
                    <path d="M35 45 L42 50 L35 55 M65 45 L58 50 L65 55" stroke="url(#gradGreen)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="47" y1="58" x2="53" y2="42" stroke="url(#gradGreen)" strokeWidth="2" strokeLinecap="round" />
                    <defs>
                      <linearGradient id="gradGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#39ff14" />
                        <stop offset="100%" stopColor="#00aa00" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                {/* Avatar 3: Mistral - Paper document (Purple glow) */}
                <div className={`avatar-wrapper ${isMistral ? 'active' : ''} ${activeTool !== '待命' ? 'busy' : 'idle'}`}>
                  <svg className="avatar-svg" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" stroke="url(#gradPurple)" strokeWidth="2" fill="none" className="orbit-line-slow" />
                    <rect x="30" y="28" width="40" height="44" rx="4" stroke="url(#gradPurple)" strokeWidth="2" fill="none" className="document-rect" />
                    <line x1="38" y1="38" x2="62" y2="38" stroke="url(#gradPurple)" strokeWidth="2" strokeLinecap="round" className="doc-line" />
                    <line x1="38" y1="48" x2="62" y2="48" stroke="url(#gradPurple)" strokeWidth="2" strokeLinecap="round" className="doc-line" />
                    <line x1="38" y1="58" x2="54" y2="58" stroke="url(#gradPurple)" strokeWidth="2" strokeLinecap="round" className="doc-line" />
                    <defs>
                      <linearGradient id="gradPurple" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#bd00ff" />
                        <stop offset="100%" stopColor="#7209b7" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                {/* Avatar 4: Default - Core chip (Gold/Orange glow) */}
                <div className={`avatar-wrapper ${isDefault ? 'active' : ''} ${activeTool !== '待命' ? 'busy' : 'idle'}`}>
                  <svg className="avatar-svg" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" stroke="url(#gradGold)" strokeWidth="2" fill="none" className="orbit-line-slow" />
                    <circle cx="50" cy="50" r="34" stroke="url(#gradGold)" strokeWidth="1.5" strokeDasharray="6 4" fill="none" className="orbit-line-fast" />
                    <polygon points="50,32 68,50 50,68 32,50" stroke="url(#gradGold)" strokeWidth="2" fill="none" className="core-polygon" />
                    <circle cx="50" cy="50" r="6" fill="#ffb700" className="core-center-dot" />
                    <defs>
                      <linearGradient id="gradGold" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ffb700" />
                        <stop offset="100%" stopColor="#ff5500" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

              </div>
            </div>

            <div className="agent-info-display">
              <h4>{agentName}</h4>
              <p className="agent-status-subtext">{activeTool === '待命' ? '等待指令下達中...' : `正在進行：${activeTool}`}</p>
            </div>
          </section>

          {/* Section 2: Tool Monitor Progress */}
          <section className="dashboard-card tool-monitor-card glass-panel">
            <div className="card-header">
              <h3>🛠️ 工具監控</h3>
              <span className="tool-badge">{activeTool}</span>
            </div>

            <div className="progress-container">
              {/* Circular Progress Ring */}
              <div className="circular-progress-wrapper">
                <svg className="circular-progress" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" className="progress-bg"></circle>
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="progress-bar animate-pulse"
                    style={{ strokeDashoffset }}
                  ></circle>
                </svg>
                <div className="percentage-label">
                  <span>{percentage}</span>%
                </div>
              </div>

              {/* Horizontal Progress */}
              <div className="horizontal-progress-wrapper">
                <div className="progress-text">
                  <span className="text-dim">總進度調度</span>
                  <span>{percentage}%</span>
                </div>
                <div className="progress-track-bg">
                  <div
                    className="progress-track-fill"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Live Terminal Logs */}
          <section className="dashboard-card log-card glass-panel flex flex-col min-h-[220px]">
            <div className="card-header">
              <h3>📋 即時日誌攔截</h3>
              <div className="log-actions">
                <button onClick={copyLogs} className="glass-btn btn-xs cursor-pointer">複製</button>
                <button onClick={clearLogs} className="glass-btn btn-xs cursor-pointer">清空</button>
              </div>
            </div>

            <div className="log-terminal flex-1" ref={logTerminalRef}>
              <div className="log-content-area">
                {logLines.map(line => (
                  <div key={line.id} className="log-line">
                    <span className="log-timestamp">[{line.timestamp}]</span>
                    <span className="log-text-msg">{line.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>
      </aside>

    </div>
  );
}
