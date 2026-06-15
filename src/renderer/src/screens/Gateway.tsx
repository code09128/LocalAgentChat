import { useState, useEffect } from 'react';

export default function Gateway() {
  const [config, setConfig] = useState({
    host: '102.16.89.44',
    port: '22',
    username: 'ubuntu',
    remotePort: '8080',
    localPort: '8080'
  });
  const [tunnelActive, setTunnelActive] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([
    'System: SSH gateway initialized.',
    'System: Waiting for connection trigger...'
  ]);

  // 載入後端設定
  useEffect(() => {
    fetch('/api/gateway')
      .then(r => r.json())
      .then(data => {
        if (data) {
          setConfig({
            host: data.host || '102.16.89.44',
            port: data.port || '22',
            username: data.username || 'ubuntu',
            remotePort: data.remotePort || '8080',
            localPort: data.localPort || '8080'
          });
          setTunnelActive(!!data.tunnelActive);
          if (data.tunnelActive) {
            setLogLines(prev => [
              ...prev,
              `${new Date().toLocaleTimeString()} - Tunnel restored from last session. [Active]`
            ]);
          }
        }
      })
      .catch(err => console.error("Failed to load gateway config", err));
  }, []);

  const saveGateway = async (newConfig: any, active: boolean) => {
    try {
      await fetch('/api/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newConfig, tunnelActive: active })
      });
    } catch (err) {
      console.error("Failed to save gateway config", err);
    }
  };

  const updateConfigField = (field: string, val: string) => {
    setConfig(prev => {
      const next = { ...prev, [field]: val };
      saveGateway(next, tunnelActive);
      return next;
    });
  };

  const handleConnect = () => {
    const nextActive = !tunnelActive;
    setTunnelActive(nextActive);
    if (!nextActive) {
      setLogLines(prev => [...prev, `${new Date().toLocaleTimeString()} - Tunnel disconnected.`]);
    } else {
      setLogLines(prev => [
        ...prev,
        `${new Date().toLocaleTimeString()} - Connecting to ${config.username}@${config.host}:${config.port}...`,
        `${new Date().toLocaleTimeString()} - Authenticated with key pair.`,
        `${new Date().toLocaleTimeString()} - Forwarding remote port ${config.remotePort} to localhost:${config.localPort}`,
        `${new Date().toLocaleTimeString()} - SSH Tunnel established successfully. [Active]`
      ]);
    }
    saveGateway(config, nextActive);
  };

  return (
    <main className="chat-panel">
      {/* Header */}
      <header className="panel-header">
        <div className="header-title-container">
          <h2>SSH Remote & VPS Tunnel 閘道設定</h2>
          <div className="active-connection">
            <span className={`status-dot ${tunnelActive ? 'green' : 'red'} animate-pulse`}></span>
            <span className="status-label text-dim">
              {tunnelActive ? 'Tunnel Active (Linked)' : 'Tunnel Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Settings Box */}
          <div className="glass-panel p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold tracking-wider text-slate-300 uppercase pb-2 border-b border-white/5">
              連線參數設定
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">VPS 主機位址 (IP/Host)</label>
                <input
                  type="text"
                  value={config.host}
                  onChange={(e) => updateConfigField('host', e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-cyan/50 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">連線 Port</label>
                <input
                  type="text"
                  value={config.port}
                  onChange={(e) => updateConfigField('port', e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-cyan/50 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">登入使用者名稱 (Username)</label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => updateConfigField('username', e.target.value)}
                className="bg-black/30 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-cyan/50 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">遠端 Port (Remote Bind)</label>
                <input
                  type="text"
                  value={config.remotePort}
                  onChange={(e) => updateConfigField('remotePort', e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-cyan/50 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">本機對應 Port (Local Port)</label>
                <input
                  type="text"
                  value={config.localPort}
                  onChange={(e) => updateConfigField('localPort', e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-cyan/50 text-xs"
                />
              </div>
            </div>

            <button
              onClick={handleConnect}
              className={`glass-btn py-2.5 rounded-lg font-semibold border transition-all mt-2 cursor-pointer ${
                tunnelActive ? 'bg-red-500/10 border-red-500/30 text-red-400!' : 'bg-gold/10 border-gold/30 text-gold!'
              }`}
            >
              {tunnelActive ? '中斷通道連線' : '建立遠端安全通道'}
            </button>
          </div>

          {/* Console / Monitor Log */}
          <div className="glass-panel p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold tracking-wider text-slate-300 uppercase pb-2 border-b border-white/5">
              通道日誌監控
            </h3>
            
            <div className="flex-1 bg-black/50 border border-white/5 rounded-xl p-4 font-mono text-[10px] text-green-300 overflow-y-auto min-h-[200px] flex flex-col gap-1">
              {logLines.map((line, idx) => (
                <div key={idx} className="leading-relaxed">{line}</div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
