import { useState, useEffect, useCallback } from 'react';
import type { ProviderConfig, ModelDefinition, ModelCategory } from '../../../shared/model-providers';
import { FAROBOT_MODELS, DEFAULT_PROVIDERS } from '../../../shared/model-providers';

// ── Category badge colour map ─────────────────────────────────────────────────
const CATEGORY_COLORS: Record<ModelCategory, string> = {
  chat:      'rgba(0,240,255,0.15)',
  reasoning: 'rgba(189,0,255,0.15)',
  code:      'rgba(57,255,20,0.12)',
  image:     'rgba(255,183,0,0.12)',
  embedding: 'rgba(255,56,56,0.12)',
  ocr:       'rgba(255,255,255,0.08)',
};
const CATEGORY_TEXT: Record<ModelCategory, string> = {
  chat:      '#00f0ff',
  reasoning: '#bd00ff',
  code:      '#39ff14',
  image:     '#ffb700',
  embedding: '#ff3838',
  ocr:       '#94a3b8',
};

// ── Provider icon SVGs ────────────────────────────────────────────────────────
const ICONS: Record<string, React.ReactNode> = {
  farobot: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
    </svg>
  ),
  azure_openai: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  openai: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><circle cx="12" cy="17" r=".5" fill="currentColor" />
    </svg>
  ),
  gemini: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polygon points="12 2 19 7 19 17 12 22 5 17 5 7" /><line x1="12" y1="2" x2="12" y2="22" />
    </svg>
  ),
  claude: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" /><path d="M8 12h8M12 8v8" />
    </svg>
  ),
  ollama: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ellipse cx="12" cy="9" rx="5" ry="6" /><path d="M7 15c-2.5 1-4 2.5-4 4h18c0-1.5-1.5-3-4-4" />
    </svg>
  ),
};

const PROVIDER_ACCENT: Record<string, string> = {
  farobot:     '#ffb700',
  azure_openai:'#00f0ff',
  openai:      '#10b981',
  gemini:      '#818cf8',
  claude:      '#bd00ff',
  ollama:      '#39ff14',
};

// ── Ollama model row type ─────────────────────────────────────────────────────
interface OllamaModel { id: string; name: string; size?: number; modified?: string; }

function formatBytes(b?: number) {
  if (!b) return '';
  const gb = b / 1_073_741_824;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(b / 1_048_576).toFixed(0)} MB`;
}

interface ModelsProps {
  isTabMode?: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Models({ isTabMode = false }: ModelsProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>(DEFAULT_PROVIDERS);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    farobot: true,
    openai: true,
    gemini: true,
    claude: true,
    azure_openai: false,
    ollama: false
  });
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Ollama state
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaFetching, setOllamaFetching] = useState(false);
  const [ollamaError, setOllamaError] = useState('');

  // FArobot model filter
  const [modelCategory, setModelCategory] = useState<'all' | ModelCategory>('all');

  // Load from backend on mount
  useEffect(() => {
    fetch('/api/providers')
      .then(r => r.json())
      .then((data: ProviderConfig[]) => {
        if (Array.isArray(data)) {
          setProviders(data);
          // auto expand enabled ones
          setExpanded(prev => {
            const next = { ...prev };
            data.forEach(p => {
              if (p.enabled) {
                next[p.id] = true;
              }
            });
            return next;
          });
        }
      })
      .catch(() => {/* use defaults */});
  }, []);

  const updateProvider = (id: string, patch: Partial<ProviderConfig>) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(providers),
      });
      setSaveStatus(res.ok ? 'saved' : 'error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  const fetchOllamaModels = useCallback(async () => {
    const ollama = providers.find(p => p.id === 'ollama');
    const host = ollama?.ollamaHost || 'http://localhost:11434';
    setOllamaFetching(true);
    setOllamaError('');
    try {
      const res = await fetch(`/api/ollama/models?host=${encodeURIComponent(host)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setOllamaModels(data.models || []);
      // auto-select first if none selected
      if ((!ollama?.selectedModel) && data.models?.length > 0) {
        updateProvider('ollama', { selectedModel: data.models[0].id });
      }
    } catch (e: unknown) {
      setOllamaError(e instanceof Error ? e.message : String(e));
    } finally {
      setOllamaFetching(false);
    }
  }, [providers]);

  const farobotModels = FAROBOT_MODELS.filter(
    m => modelCategory === 'all' || m.category === modelCategory
  );

  const activeProvider = providers.find(p => p.enabled) || providers[0];
  const accent = PROVIDER_ACCENT[activeProvider?.id] || '#00f0ff';

  return (
    <main className="chat-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      {!isTabMode ? (
        <header className="panel-header">
          <div className="header-title-container">
            <h2>LLM Providers &amp; Model 設定</h2>
            <div className="active-connection">
              <span className="status-dot green animate-pulse" />
              <span className="status-label text-dim">
                Active: {activeProvider?.label || '—'}
              </span>
            </div>
          </div>
          <button
            id="models-save-all"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            style={{
              background: saveStatus === 'saved' ? 'rgba(57,255,20,0.12)' : saveStatus === 'error' ? 'rgba(255,56,56,0.12)' : `rgba(${accent === '#ffb700' ? '255,183,0' : '0,240,255'},.1)`,
              border: `1px solid ${saveStatus === 'saved' ? '#39ff14' : saveStatus === 'error' ? '#ff3838' : accent}`,
              color: saveStatus === 'saved' ? '#39ff14' : saveStatus === 'error' ? '#ff3838' : accent,
              padding: '8px 20px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {saveStatus === 'saving' ? '💾 儲存中...' : saveStatus === 'saved' ? '✅ 已儲存' : saveStatus === 'error' ? '❌ 錯誤' : '💾 儲存所有設定'}
          </button>
        </header>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
          <button
            id="models-save-all"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            style={{
              background: saveStatus === 'saved' ? 'rgba(57,255,20,0.12)' : saveStatus === 'error' ? 'rgba(255,56,56,0.12)' : `rgba(${accent === '#ffb700' ? '255,183,0' : '0,240,255'},.1)`,
              border: `1px solid ${saveStatus === 'saved' ? '#39ff14' : saveStatus === 'error' ? '#ff3838' : accent}`,
              color: saveStatus === 'saved' ? '#39ff14' : saveStatus === 'error' ? '#ff3838' : accent,
              padding: '8px 20px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}
          >
            {saveStatus === 'saving' ? '💾 儲存中...' : saveStatus === 'saved' ? '✅ 已儲存' : saveStatus === 'error' ? '❌ 錯誤' : '💾 儲存所有設定'}
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* ── Provider cards ── */}
        {providers.map(p => {
          const isOpen = !!expanded[p.id];
          const acc = PROVIDER_ACCENT[p.id] || '#00f0ff';
          return (
            <div
              key={p.id}
              className="glass-panel"
              style={{
                borderColor: isOpen ? acc : undefined,
                boxShadow: isOpen ? `0 0 20px ${acc}22` : undefined,
                transition: 'all 0.35s ease',
                overflow: 'hidden',
              }}
            >
              {/* Card header (always visible) */}
              <div
                id={`provider-header-${p.id}`}
                onClick={() => setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '16px 20px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ color: acc }}>{ICONS[p.id]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{p.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {p.selectedModel || (p.id === 'ollama' ? '尚未選擇模型' : '未設定')}
                  </div>
                </div>
                {/* enabled toggle */}
                <label
                  id={`provider-toggle-${p.id}`}
                  onClick={e => e.stopPropagation()}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <div
                    onClick={() => updateProvider(p.id, { enabled: !p.enabled })}
                    style={{
                      width: '40px', height: '22px',
                      background: p.enabled ? acc : 'rgba(255,255,255,0.08)',
                      borderRadius: '11px',
                      position: 'relative',
                      transition: 'background 0.3s',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '3px',
                      left: p.enabled ? '21px' : '3px',
                      width: '16px', height: '16px',
                      background: '#fff',
                      borderRadius: '50%',
                      transition: 'left 0.3s',
                      boxShadow: `0 0 6px ${acc}88`,
                    }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: p.enabled ? acc : 'var(--text-dim)' }}>
                    {p.enabled ? '啟用' : '停用'}
                  </span>
                </label>
                <svg
                  viewBox="0 0 24 24" width="16" height="16" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s', color: 'var(--text-dim)' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Expandable body */}
              {isOpen && (
                <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ height: '1px', background: 'var(--border-light)' }} />

                  {/* ── Endpoint ── */}
                  {p.id !== 'ollama' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Endpoint URL</label>
                      <input
                        id={`endpoint-${p.id}`}
                        type="text"
                        value={p.endpoint}
                        onChange={e => updateProvider(p.id, { endpoint: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  )}

                  {/* ── API Key ── */}
                  {p.id !== 'ollama' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>API Key</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          id={`apikey-${p.id}`}
                          type={showKey[p.id] ? 'text' : 'password'}
                          value={p.apiKey}
                          placeholder="sk-..."
                          onChange={e => updateProvider(p.id, { apiKey: e.target.value })}
                          style={{ ...inputStyle, paddingRight: '42px', flex: 1 }}
                        />
                        <button
                          id={`toggle-key-${p.id}`}
                          onClick={() => setShowKey(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                          style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px' }}
                        >
                          {showKey[p.id] ? '🙈' : '👁'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Azure extras ── */}
                  {p.id === 'azure_openai' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deployment Name</label>
                        <input
                          id="azure-deployment"
                          type="text"
                          value={p.deploymentName || ''}
                          onChange={e => updateProvider(p.id, { deploymentName: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>API Version</label>
                        <input
                          id="azure-apiversion"
                          type="text"
                          value={p.apiVersion || ''}
                          onChange={e => updateProvider(p.id, { apiVersion: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── FArobot model picker ── */}
                  {p.id === 'farobot' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Category filter tabs */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(['all', 'chat', 'reasoning', 'code', 'image', 'embedding', 'ocr'] as const).map(cat => (
                          <button
                            key={cat}
                            id={`farobot-cat-${cat}`}
                            onClick={() => setModelCategory(cat)}
                            style={{
                              padding: '4px 12px',
                              borderRadius: '20px',
                              border: modelCategory === cat ? `1px solid ${acc}` : '1px solid rgba(255,255,255,0.08)',
                              background: modelCategory === cat ? `${acc}18` : 'transparent',
                              color: modelCategory === cat ? acc : 'var(--text-dim)',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                              transition: 'all 0.2s',
                            }}
                          >
                            {cat === 'all' ? '全部' : cat}
                          </button>
                        ))}
                      </div>

                      {/* Model grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                        {farobotModels.map((m: ModelDefinition) => (
                          <div
                            key={m.id}
                            id={`farobot-model-${m.id}`}
                            onClick={() => updateProvider('farobot', { selectedModel: m.id })}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: p.selectedModel === m.id
                                ? `1px solid ${acc}`
                                : '1px solid rgba(255,255,255,0.06)',
                              background: p.selectedModel === m.id ? `${acc}12` : 'rgba(255,255,255,0.02)',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.8rem', color: p.selectedModel === m.id ? acc : 'var(--text-primary)' }}>
                                {m.name}
                              </span>
                              <span style={{
                                fontSize: '0.65rem', fontWeight: 700,
                                padding: '2px 8px', borderRadius: '8px',
                                background: CATEGORY_COLORS[m.category],
                                color: CATEGORY_TEXT[m.category],
                              }}>
                                {m.category}
                              </span>
                            </div>
                            {m.note && <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{m.note}</div>}
                            {m.requiresMinTokens && (
                              <div style={{ fontSize: '0.65rem', color: '#ffb700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ⚠ min_tokens ≥ {m.requiresMinTokens}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Ollama section ── */}
                  {p.id === 'ollama' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ollama Host URL</label>
                          <input
                            id="ollama-host-input"
                            type="text"
                            value={p.ollamaHost || 'http://localhost:11434'}
                            onChange={e => updateProvider(p.id, { ollamaHost: e.target.value })}
                            style={inputStyle}
                          />
                        </div>
                        <button
                          id="ollama-fetch-btn"
                          onClick={fetchOllamaModels}
                          disabled={ollamaFetching}
                          style={{
                            padding: '10px 18px',
                            borderRadius: '10px',
                            border: `1px solid ${acc}`,
                            background: `${acc}18`,
                            color: acc,
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: ollamaFetching ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {ollamaFetching ? (
                            <><span className="animate-pulse">⏳</span> 讀取中...</>
                          ) : (
                            <>🔄 取得本地模型</>
                          )}
                        </button>
                      </div>

                      {ollamaError && (
                        <div style={{ background: 'rgba(255,56,56,0.1)', border: '1px solid rgba(255,56,56,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', color: '#ff8888' }}>
                          ❌ {ollamaError}
                        </div>
                      )}

                      {ollamaModels.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {ollamaModels.length} 個本地模型
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                            {ollamaModels.map(m => (
                              <div
                                key={m.id}
                                id={`ollama-model-${m.id.replace(/[^a-z0-9]/gi, '_')}`}
                                onClick={() => updateProvider('ollama', { selectedModel: m.id })}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '10px 14px',
                                  borderRadius: '10px',
                                  border: p.selectedModel === m.id
                                    ? `1px solid ${acc}`
                                    : '1px solid rgba(255,255,255,0.06)',
                                  background: p.selectedModel === m.id ? `${acc}12` : 'rgba(255,255,255,0.02)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontSize: '1.1rem' }}>🦙</span>
                                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: p.selectedModel === m.id ? acc : 'var(--text-primary)' }}>
                                    {m.name}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  {m.size && <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{formatBytes(m.size)}</span>}
                                  {p.selectedModel === m.id && (
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: acc, background: `${acc}20`, padding: '2px 8px', borderRadius: '6px' }}>
                                      使用中
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {ollamaModels.length === 0 && !ollamaFetching && !ollamaError && (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                          點擊「取得本地模型」掃描 Ollama 已安裝的模型
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Non-FArobot, non-Ollama model input ── */}
                  {p.id !== 'farobot' && p.id !== 'ollama' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>預設模型名稱</label>
                      <input
                        id={`model-name-${p.id}`}
                        type="text"
                        value={p.selectedModel}
                        placeholder={p.id === 'gemini' ? 'gemini-1.5-pro' : p.id === 'claude' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o'}
                        onChange={e => updateProvider(p.id, { selectedModel: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Quick Reference Table ── */}
        <div className="glass-panel" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            FArobot 模型速查表
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['模型 ID', '類型', '備註'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--text-dim)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FAROBOT_MODELS.map(m => (
                  <tr
                    key={m.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}
                    onClick={() => {
                      updateProvider('farobot', { selectedModel: m.id });
                      setExpanded(prev => ({ ...prev, farobot: true }));
                    }}
                  >
                    <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{m.id}</td>
                    <td style={{ padding: '7px 12px' }}>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700,
                        padding: '2px 8px', borderRadius: '8px',
                        background: CATEGORY_COLORS[m.category],
                        color: CATEGORY_TEXT[m.category],
                      }}>
                        {m.category}
                      </span>
                    </td>
                    <td style={{ padding: '7px 12px', color: 'var(--text-dim)' }}>
                      {m.note}
                      {m.requiresMinTokens && <span style={{ color: '#ffb700', marginLeft: '6px' }}>⚠ min {m.requiresMinTokens}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  padding: '9px 14px',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '0.85rem',
  width: '100%',
  fontFamily: 'var(--font-mono)',
  transition: 'border-color 0.2s',
};
