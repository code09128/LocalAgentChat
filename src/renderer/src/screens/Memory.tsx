import { useState, useEffect } from 'react';

export default function Memory() {
  const [useLongTermMemory, setUseLongTermMemory] = useState(true);
  const [dirs, setDirs] = useState<string[]>([]);
  const [newDir, setNewDir] = useState('');

  // 載入後端設定
  useEffect(() => {
    fetch('/api/memory')
      .then(r => r.json())
      .then(data => {
        if (data) {
          setUseLongTermMemory(data.useLongTermMemory !== false);
          setDirs(data.dirs || []);
        }
      })
      .catch(err => console.error("Failed to load memory config", err));
  }, []);

  const saveMemory = async (active: boolean, folders: string[]) => {
    try {
      await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useLongTermMemory: active, dirs: folders })
      });
    } catch (err) {
      console.error("Failed to save memory config", err);
    }
  };

  const handleToggle = () => {
    const nextActive = !useLongTermMemory;
    setUseLongTermMemory(nextActive);
    saveMemory(nextActive, dirs);
  };

  const handleAddDir = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDir.trim()) {
      const nextDirs = [...dirs, newDir.trim()];
      setDirs(nextDirs);
      setNewDir('');
      saveMemory(useLongTermMemory, nextDirs);
    }
  };

  const handleRemoveDir = (idx: number) => {
    const nextDirs = dirs.filter((_, i) => i !== idx);
    setDirs(nextDirs);
    saveMemory(useLongTermMemory, nextDirs);
  };

  return (
    <main className="chat-panel">
      {/* Header */}
      <header className="panel-header">
        <div className="header-title-container">
          <h2>Memory & Knowledge Base 知識庫</h2>
          <div className="active-connection">
            <span className="status-dot green animate-pulse"></span>
            <span className="status-label text-dim">{dirs.length} document folders indexed</span>
          </div>
        </div>
      </header>
 
      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        
        {/* Toggle Long Term Memory */}
        <div
          onClick={handleToggle}
          className="glass-panel p-4 flex items-center justify-between border-white/5 bg-white/[0.01] hover:bg-white/5 transition-all cursor-pointer animate-fadeIn"
        >
          <div>
            <h3 className="font-semibold text-sm text-slate-100">開啟 Agent 長期記憶體 (RAG Vector Store)</h3>
            <p className="text-xs text-dim mt-1">開啟後，Agent 會自動切片並嵌入所綁定的專案目錄，並在對話時檢索相關知識上下文。</p>
          </div>
          
          <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${
            useLongTermMemory ? 'bg-cyan/30 border border-cyan/50 justify-end' : 'bg-slate-800 border border-white/10 justify-start'
          }`}>
            <div className="bg-white w-4 h-4 rounded-full shadow-md" />
          </div>
        </div>

        {/* Directory List Box */}
        {useLongTermMemory && (
          <div className="glass-panel p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold tracking-wider text-slate-300 uppercase pb-2 border-b border-white/5">
              同步專案與文檔目錄 (Monitored Paths)
            </h3>

            {/* Input form */}
            <form onSubmit={handleAddDir} className="flex gap-2">
              <input
                type="text"
                value={newDir}
                onChange={(e) => setNewDir(e.target.value)}
                placeholder="輸入資料夾路徑 (例如 e:/AI/local_ai_desktop/docs)..."
                className="flex-1 bg-black/30 border border-white/10 rounded-lg p-2 text-slate-200 text-xs outline-none focus:border-cyan/50"
              />
              <button
                type="submit"
                className="glass-btn btn-xs px-4 text-gold border-gold/30 bg-gold/5 font-semibold cursor-pointer"
              >
                新增路徑
              </button>
            </form>

            {/* List */}
            <div className="flex flex-col gap-2 mt-2">
              {dirs.map((dir, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 bg-white/[0.005] text-xs"
                >
                  <span className="font-mono text-slate-300">{dir}</span>
                  <button
                    onClick={() => handleRemoveDir(idx)}
                    className="text-red-400 hover:text-red-300 font-bold px-2 cursor-pointer"
                    title="移除"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
