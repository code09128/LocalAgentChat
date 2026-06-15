import { useState, useEffect } from 'react';

export default function Tools() {
  const [tools, setTools] = useState([
    { id: 'execute_code', name: 'execute_code', category: 'Code Interpreter', desc: 'Allows the agent to write and execute Python code locally.', enabled: true },
    { id: 'read_file', name: 'read_file', category: 'File System', desc: 'Allows reading plain text, json, and markdown source files.', enabled: true },
    { id: 'write_file', name: 'write_file', category: 'File System', desc: 'Allows creating and editing project source code.', enabled: false },
    { id: 'web_search', name: 'web_search', category: 'Web Browser', desc: 'Queries public search engines for external documentation.', enabled: true },
    { id: 'git_command', name: 'git_command', category: 'System CLI', desc: 'Executes git stage, commit, branch, and status operations.', enabled: false }
  ]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        if (data && data.permissions) {
          setTools(prev => prev.map(t => {
            let enabled = false;
            if (t.id === 'execute_code') enabled = data.permissions.executeTerminal;
            else if (t.id === 'read_file') enabled = data.permissions.readFile;
            else if (t.id === 'write_file') enabled = data.permissions.writeFile;
            else if (t.id === 'web_search') enabled = data.permissions.internetAccess;
            else if (t.id === 'git_command') enabled = data.permissions.executeGit;
            return { ...t, enabled };
          }));
        }
      })
      .catch(err => console.error("Failed to load profile in Tools settings", err));
  }, []);

  const handleToggle = async (id: string) => {
    if (!profile) return;
    
    const nextTools = tools.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t);
    setTools(nextTools);
    
    const nextPermissions = { ...profile.permissions };
    if (id === 'execute_code') nextPermissions.executeTerminal = !nextPermissions.executeTerminal;
    else if (id === 'read_file') nextPermissions.readFile = !nextPermissions.readFile;
    else if (id === 'write_file') nextPermissions.writeFile = !nextPermissions.writeFile;
    else if (id === 'web_search') nextPermissions.internetAccess = !nextPermissions.internetAccess;
    else if (id === 'git_command') nextPermissions.executeGit = !nextPermissions.executeGit;
    
    const nextProfile = { ...profile, permissions: nextPermissions };
    setProfile(nextProfile);
    
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextProfile)
      });
    } catch (err) {
      console.error("Failed to save profile on tool toggle", err);
    }
  };

  return (
    <main className="chat-panel">
      {/* Header */}
      <header className="panel-header">
        <div className="header-title-container">
          <h2>Agent Tools & Skills 技能庫</h2>
          <div className="active-connection">
            <span className="status-dot green animate-pulse"></span>
            <span className="status-label text-dim">5 tools registered in manifest</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
        <p className="text-sm text-slate-400">
          設定 Agent 在解算指令時可使用的外部工具。已被禁用的工具將不會被放入 System Prompt 供 LLM 調用。
        </p>

        <div className="flex flex-col gap-3">
          {tools.map(tool => (
            <div
              key={tool.id}
              onClick={() => handleToggle(tool.id)}
              className="glass-panel p-4 flex items-center justify-between border-white/5 bg-white/[0.01] hover:bg-white/5 transition-all cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="bg-purple-500/10 text-purple-400 p-2.5 rounded-xl border border-purple-500/20 text-xs font-semibold uppercase tracking-wider h-10 w-10 flex items-center justify-center">
                  {tool.category[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-100">{tool.name}</span>
                    <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5">
                      {tool.category}
                    </span>
                  </div>
                  <p className="text-xs text-dim mt-1">{tool.desc}</p>
                </div>
              </div>

              {/* Toggle Switch */}
              <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${
                tool.enabled ? 'bg-cyan/30 border border-cyan/50 justify-end' : 'bg-slate-800 border border-white/10 justify-start'
              }`}>
                <div className="bg-white w-4 h-4 rounded-full shadow-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
