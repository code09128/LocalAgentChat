import { useState, useEffect, useCallback } from 'react';

interface Permissions {
  executeTerminal: boolean;
  readFile: boolean;
  writeFile: boolean;
  internetAccess: boolean;
}

interface ProviderConfig {
  id: string;
  label: string;
  enabled: boolean;
  selectedModel: string;
  endpoint?: string;
}

// 每個 provider id 對應的固定視覺設定
const PROVIDER_STYLE: Record<string, { emoji: string; color: string; border: string; bg: string; text: string; glow: string; dot: string }> = {
  farobot:     { emoji: '🤖', color: 'gold',   border: 'border-yellow-400/40', bg: 'bg-yellow-400/8',  text: 'text-yellow-300', glow: 'shadow-[0_0_20px_rgba(255,183,0,0.15)]',   dot: '#ffb700' },
  azure_openai:{ emoji: '☁️', color: 'blue',   border: 'border-blue-400/40',   bg: 'bg-blue-400/8',   text: 'text-blue-300',   glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',  dot: '#3b82f6' },
  openai:      { emoji: '💡', color: 'green',  border: 'border-emerald-400/40',bg: 'bg-emerald-400/8',text: 'text-emerald-300',glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',  dot: '#10b981' },
  gemini:      { emoji: '✨', color: 'cyan',   border: 'border-cyan/40',       bg: 'bg-cyan/8',       text: 'text-cyan',       glow: 'shadow-[0_0_20px_rgba(0,240,255,0.15)]',   dot: '#00f0ff' },
  claude:      { emoji: '🧡', color: 'orange', border: 'border-orange-400/40', bg: 'bg-orange-400/8', text: 'text-orange-300', glow: 'shadow-[0_0_20px_rgba(251,146,60,0.15)]',  dot: '#fb923c' },
  ollama:      { emoji: '🦙', color: 'purple', border: 'border-purple/40',     bg: 'bg-purple/8',     text: 'text-purple',     glow: 'shadow-[0_0_20px_rgba(189,0,255,0.15)]',   dot: '#bd00ff' },
};

const DEFAULT_STYLE = { emoji: '🔌', color: 'slate', border: 'border-slate-500/40', bg: 'bg-slate-500/8', text: 'text-slate-300', glow: '', dot: '#94a3b8' };

const PERMISSIONS = [
  { key: 'executeTerminal' as keyof Permissions, label: '允許終端機命令執行', desc: 'Agent 可以執行 local-smart CLI 腳本與 bash 指令', icon: '⚡', risk: 'high' as const },
  { key: 'readFile'        as keyof Permissions, label: '允許讀取本機檔案',   desc: '允許讀取專案工作目錄底下的檔案與日誌',           icon: '📂', risk: 'low'  as const },
  { key: 'writeFile'       as keyof Permissions, label: '允許寫入本機檔案',   desc: '允許修改或寫入新的程式碼到工作目錄',             icon: '✏️', risk: 'high' as const },
  { key: 'internetAccess'  as keyof Permissions, label: '允許外部網絡請求',   desc: '允許調用第三方 API 服務與 MCP servers 伺服器',    icon: '🌐', risk: 'medium' as const },
] as const;

type ToastType = 'success' | 'error' | 'info';

function Toast({ msg, type, onDone }: { msg: string; type: ToastType; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  const colors: Record<ToastType, string> = {
    success: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
    error:   'bg-red-500/15 border-red-500/40 text-red-300',
    info:    'bg-cyan/10 border-cyan/30 text-cyan',
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl border text-sm font-medium shadow-xl backdrop-blur-md ${colors[type]}`}
      style={{ animation: 'fadeSlideUp 0.3s ease' }}>
      {msg}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, risk }: { checked: boolean; onChange: () => void; risk: 'low' | 'medium' | 'high' }) {
  const onColor = risk === 'high' ? 'bg-amber-500/30 border-amber-400/60' : risk === 'medium' ? 'bg-cyan/30 border-cyan/50' : 'bg-emerald-500/30 border-emerald-400/60';
  const thumbColor = risk === 'high' ? '#f59e0b' : risk === 'medium' ? '#00f0ff' : '#10b981';
  return (
    <button type="button" onClick={onChange} role="switch" aria-checked={checked}
      className={`w-11 h-6 flex items-center rounded-full px-0.5 border transition-all duration-300 cursor-pointer flex-shrink-0 ${
        checked ? `${onColor} justify-end` : 'bg-slate-800 border-white/10 justify-start'}`}>
      <div className="w-4 h-4 rounded-full shadow-md transition-all duration-200"
        style={{ background: checked ? thumbColor : '#64748b', boxShadow: checked ? `0 0 6px ${thumbColor}80` : 'none' }} />
    </button>
  );
}

interface ProviderParams {
  temperature: number;
  topP: number;
  systemPrompt: string;
}

export default function Agents() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);

  const [activeProfile, setActiveProfile] = useState<string>('');
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a helpful coding assistant designed to help developers build secure local desktop automation applications.'
  );
  const [permissions, setPermissions] = useState<Permissions>({
    executeTerminal: true, readFile: true, writeFile: false, internetAccess: true,
  });
  // 每個 provider 各自的參數快取
  const [providerSettings, setProviderSettings] = useState<Record<string, ProviderParams>>({});

  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [savedProfile, setSavedProfile] = useState<string>('');
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const DEFAULT_PARAMS: ProviderParams = { temperature: 0.7, topP: 0.9, systemPrompt: 'You are a helpful coding assistant designed to help developers build secure local desktop automation applications.' };

  // 載入 providers 和 profile 設定
  useEffect(() => {
    Promise.all([
      fetch('/api/providers').then(r => r.json()),
      fetch('/api/profile').then(r => r.json()),
    ]).then(([providerData, profileData]) => {
      if (Array.isArray(providerData)) setProviders(providerData);

      if (profileData) {
        const settings: Record<string, ProviderParams> = profileData.providerSettings || {};
        setProviderSettings(settings);

        if (profileData.activeProfile) {
          const pid = profileData.activeProfile;
          setActiveProfile(pid);
          setSavedProfile(pid);
          // 載入該 provider 的參數（有儲存的用儲存值，否則用 global 值）
          const ps = settings[pid];
          setTemperature(ps?.temperature ?? (profileData.temperature ?? 0.7));
          setTopP(ps?.topP ?? (profileData.topP ?? 0.9));
          setSystemPrompt(ps?.systemPrompt ?? (profileData.systemPrompt ?? DEFAULT_PARAMS.systemPrompt));
        }
        if (profileData.permissions) setPermissions(profileData.permissions);
      }
    }).catch(() => setToast({ msg: '載入設定失敗', type: 'error' }))
      .finally(() => setLoadingProviders(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = useCallback((msg: string, type: ToastType) => setToast({ msg, type }), []);

  // 切換 provider 時：把當前編輯中的參數存入快取，再載入新 provider 的參數
  const handleSelectProvider = (pid: string) => {
    // 先把目前畫面上的值存入快取
    setProviderSettings(prev => ({
      ...prev,
      [activeProfile]: { temperature, topP, systemPrompt },
    }));
    // 切換到新 provider，從快取讀取（若無則用預設）
    setProviderSettings(prev => {
      const next = { ...prev, [activeProfile]: { temperature, topP, systemPrompt } };
      const ps = next[pid];
      setTemperature(ps?.temperature ?? DEFAULT_PARAMS.temperature);
      setTopP(ps?.topP ?? DEFAULT_PARAMS.topP);
      setSystemPrompt(ps?.systemPrompt ?? DEFAULT_PARAMS.systemPrompt);
      return next;
    });
    setActiveProfile(pid);
    setIsDirty(true);
  };

  const markDirty = () => setIsDirty(true);

  // 修改參數時同步更新 providerSettings 快取
  const handleTemperatureChange = (val: number) => {
    setTemperature(val);
    setProviderSettings(prev => ({ ...prev, [activeProfile]: { ...prev[activeProfile], temperature: val, topP: prev[activeProfile]?.topP ?? topP, systemPrompt: prev[activeProfile]?.systemPrompt ?? systemPrompt } }));
    markDirty();
  };
  const handleTopPChange = (val: number) => {
    setTopP(val);
    setProviderSettings(prev => ({ ...prev, [activeProfile]: { ...prev[activeProfile], topP: val, temperature: prev[activeProfile]?.temperature ?? temperature, systemPrompt: prev[activeProfile]?.systemPrompt ?? systemPrompt } }));
    markDirty();
  };
  const handleSystemPromptChange = (val: string) => {
    setSystemPrompt(val);
    setProviderSettings(prev => ({ ...prev, [activeProfile]: { ...prev[activeProfile], systemPrompt: val, temperature: prev[activeProfile]?.temperature ?? temperature, topP: prev[activeProfile]?.topP ?? topP } }));
    markDirty();
  };

  const handleSave = async () => {
    setIsSaving(true);
    // 確保目前畫面值也存入快取
    const finalSettings = { ...providerSettings, [activeProfile]: { temperature, topP, systemPrompt } };
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeProfile, temperature, topP, systemPrompt, providerSettings: finalSettings, permissions }),
      });
      const data = await res.json();
      if (data.success) {
        setProviderSettings(finalSettings);
        setSavedProfile(activeProfile);
        setIsDirty(false);
        const label = providers.find(p => p.id === activeProfile)?.label || activeProfile;
        showToast(`✅ 已儲存 — 活躍 Agent: ${label}`, 'success');
      } else {
        showToast('❌ 儲存失敗: ' + (data.error || '未知錯誤'), 'error');
      }
    } catch {
      showToast('❌ 儲存失敗: 系統連線錯誤', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof Permissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
    markDirty();
  };

  // 所有 provider 都顯示（enabled 的標示 ONLINE，disabled 的可選但標示 OFFLINE）
  const enabledProviders = providers.filter(p => p.enabled);
  const disabledProviders = providers.filter(p => !p.enabled);

  const currentProvider = providers.find(p => p.id === activeProfile);
  const currentStyle = PROVIDER_STYLE[activeProfile] ?? DEFAULT_STYLE;

  return (
    <main className="chat-panel">
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <header className="panel-header">
        <div className="header-title-container">
          <h2>Profiles &amp; Agent Soul 設定</h2>
          <div className="active-connection">
            <span className="status-dot green animate-pulse" />
            <span className="status-label text-dim">
              Active:{' '}
              {currentProvider ? (
                <span className={`${currentStyle.text} font-semibold`}>
                  {PROVIDER_STYLE[activeProfile]?.emoji || '🔌'} {currentProvider.label}
                  {currentProvider.selectedModel && (
                    <span className="text-dim font-normal"> [{currentProvider.selectedModel}]</span>
                  )}
                </span>
              ) : (
                <span className="text-dim">未選擇</span>
              )}
            </span>
          </div>
        </div>
        {isDirty && (
          <div style={{ fontSize: '10px', color: '#f59e0b', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            未儲存的變更
          </div>
        )}
      </header>

      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">

        {/* Row 1: Provider Selector + Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Provider Cards */}
          <div className="glass-panel p-5 flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase pb-2 border-b border-white/5">
              選擇活躍 Agent Provider
            </h3>

            {loadingProviders ? (
              <div className="text-xs text-dim font-mono text-center py-6">載入 Providers 中...</div>
            ) : providers.length === 0 ? (
              <div className="text-xs text-dim font-mono text-center py-6 italic">尚未設定任何 Provider</div>
            ) : (
              <div className="flex flex-col gap-2">
                {/* Enabled providers first */}
                {enabledProviders.length > 0 && (
                  <>
                    <div className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-widest mb-1">● 已啟用</div>
                    {enabledProviders.map(p => {
                      const style = PROVIDER_STYLE[p.id] ?? DEFAULT_STYLE;
                      const isActive = activeProfile === p.id;
                      const isSaved = savedProfile === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelectProvider(p.id)}
                          className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative ${
                            isActive ? `${style.border} ${style.bg} ${style.glow}` : 'border-white/5 bg-white/[0.01] hover:bg-white/5'}`}
                        >
                          {isSaved && (
                            <span className="absolute top-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded-full border"
                              style={{ color: style.dot, borderColor: style.dot + '50', background: style.dot + '12' }}>
                              ● ACTIVE
                            </span>
                          )}
                          <div className={`font-semibold text-sm ${isActive ? style.text : 'text-slate-300'}`}>
                            {style.emoji} {p.label}
                          </div>
                          <div className="text-[10px] text-dim mt-0.5 font-mono">{p.selectedModel || '(未選擇模型)'}</div>
                          {isActive && p.endpoint && (
                            <div className="text-[10px] text-slate-500 mt-1 truncate">{p.endpoint}</div>
                          )}
                        </button>
                      );
                    })}
                  </>
                )}

                {/* Disabled providers */}
                {disabledProviders.length > 0 && (
                  <>
                    <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mt-2 mb-1">○ 未啟用</div>
                    {disabledProviders.map(p => {
                      const style = PROVIDER_STYLE[p.id] ?? DEFAULT_STYLE;
                      const isActive = activeProfile === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelectProvider(p.id)}
                          className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer opacity-45 hover:opacity-70 ${
                            isActive ? `${style.border} ${style.bg}` : 'border-white/5 bg-white/[0.005]'}`}
                        >
                          <div className="font-medium text-xs text-slate-400">
                            {style.emoji} {p.label}
                          </div>
                          <div className="text-[10px] text-dim mt-0.5 font-mono">{p.selectedModel || '(未設定)'}</div>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Parameters */}
          <div className="glass-panel p-5 flex flex-col gap-5 md:col-span-2">
            <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase pb-2 border-b border-white/5">
              Agent 參數微調
              {currentProvider && (
                <span className={`ml-2 font-normal normal-case ${currentStyle.text}`}>
                  — {currentStyle.emoji} {currentProvider.label}
                </span>
              )}
            </h3>

            {/* Temperature */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300">Temperature <span className="text-dim">(隨機度 / 創意程度)</span></span>
                <span className="px-2 py-0.5 rounded-md border font-bold"
                  style={{ color: '#ffb700', borderColor: '#ffb70040', background: '#ffb70010' }}>
                  {temperature.toFixed(1)}
                </span>
              </div>
              <input type="range" min="0" max="1.5" step="0.1" value={temperature}
                onChange={e => handleTemperatureChange(parseFloat(e.target.value))}
                className="w-full accent-gold bg-white/5 rounded-lg h-2 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-dim font-mono">
                <span>0.0 嚴謹</span><span>0.7 平衡</span><span>1.5 創意</span>
              </div>
            </div>

            {/* Top P */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300">Top P <span className="text-dim">(採樣閥值 / 詞彙多樣性)</span></span>
                <span className="px-2 py-0.5 rounded-md border font-bold"
                  style={{ color: '#ffb700', borderColor: '#ffb70040', background: '#ffb70010' }}>
                  {topP.toFixed(2)}
                </span>
              </div>
              <input type="range" min="0.1" max="1.0" step="0.05" value={topP}
                onChange={e => handleTopPChange(parseFloat(e.target.value))}
                className="w-full accent-gold bg-white/5 rounded-lg h-2 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-dim font-mono">
                <span>0.1 精準</span><span>0.9 多樣</span><span>1.0 全詞彙</span>
              </div>
            </div>

            {/* System Prompt */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-300 font-mono">人格 / 系統指示詞 (System Prompt)</label>
                <span className="text-[10px] text-dim font-mono">{systemPrompt.length} chars</span>
              </div>
              <textarea
                value={systemPrompt}
                onChange={e => handleSystemPromptChange(e.target.value)}
                rows={5}
                placeholder="描述 Agent 的角色、行為邊界與回答風格..."
                className="bg-black/30 border border-white/10 rounded-xl p-3 text-slate-200 outline-none focus:border-cyan/50 text-sm resize-none font-mono leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Sandbox Permissions */}
        <div className="glass-panel p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              🛡️ 執行安全權限與沙箱 (SANDBOX PRIVILEGES)
            </h3>
            <div className="flex items-center gap-3 text-[10px] font-mono text-dim">
              {[
                { color: '#10b981', label: '低風險' },
                { color: '#00f0ff', label: '中風險' },
                { color: '#f59e0b', label: '高風險' },
              ].map(r => (
                <span key={r.label} className="flex items-center gap-1">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, display: 'inline-block' }} />
                  {r.label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PERMISSIONS.map(item => {
              const isOn = permissions[item.key];
              const riskColor = item.risk === 'high' ? '#f59e0b' : item.risk === 'medium' ? '#00f0ff' : '#10b981';
              return (
                <div
                  key={item.key}
                  onClick={() => handleToggle(item.key)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isOn ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-transparent opacity-60'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 text-sm"
                      style={{ background: riskColor + '18', border: `1px solid ${riskColor}30` }}>
                      {item.icon}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-slate-200">{item.label}</div>
                      <div className="text-[11px] text-dim mt-0.5 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                  <ToggleSwitch checked={isOn} onChange={() => handleToggle(item.key)} risk={item.risk} />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/5">
            <p className="text-[10px] text-dim font-mono">
              ⚠️ 高風險權限開啟後，Agent 具備實際修改系統能力，請謹慎授權
            </p>
            <button
              id="save-soul-btn"
              onClick={handleSave}
              disabled={isSaving}
              className="glass-btn btn-sm px-6 bg-gold/10 border-gold/30! text-gold font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <span style={{ width: 12, height: 12, border: '2px solid #ffb700', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                  儲存中...
                </>
              ) : '💾 儲存 Soul 設定'}
            </button>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </main>
  );
}
