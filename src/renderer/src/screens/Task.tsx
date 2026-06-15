import { useState, useEffect } from 'react';

interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

export default function Task() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      } else {
        setError('Failed to fetch tasks');
      }
    } catch (e: any) {
      setError(e.message || 'Error connecting to backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          status: 'todo',
          priority: newPriority
        })
      });
      if (response.ok) {
        const addedTask = await response.json();
        setTasks(prev => [...prev, addedTask]);
        setNewTitle('');
        setNewDesc('');
        setNewPriority('medium');
        setShowAddForm(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: TaskItem['status']) => {
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        const updated = await response.json();
        setTasks(prev => prev.map(t => t.id === id ? updated : t));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setTasks(prev => prev.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const columns: { key: TaskItem['status']; title: string; color: string }[] = [
    { key: 'todo', title: '待處理 (To Do)', color: 'border-glow-cyan' },
    { key: 'in_progress', title: '進行中 (In Progress)', color: 'border-yellow-500/30' },
    { key: 'review', title: '審查中 (Review)', color: 'border-purple-500/30' },
    { key: 'done', title: '已完成 (Done)', color: 'border-emerald-500/30' }
  ];

  const getPriorityBadgeColor = (p: TaskItem['priority']) => {
    switch (p) {
      case 'high': return 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.1)]';
      case 'medium': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'low': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    }
  };

  return (
    <main className="chat-panel">
      {/* Header */}
      <header className="panel-header">
        <div className="header-title-container">
          <h2>Task 看板管理</h2>
          <div className="active-connection">
            <span className="status-dot green animate-pulse"></span>
            <span className="status-label text-dim">Local Database Storage active</span>
          </div>
        </div>
        <div className="header-actions">
          <button
            onClick={() => setShowAddForm(prev => !prev)}
            className="glass-btn btn-sm px-4 flex items-center gap-2 text-gold border-gold/30!"
          >
            <span className="text-lg font-bold">+</span>
            <span>新增任務</span>
          </button>
        </div>
      </header>

      {/* Workspace Panel */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        
        {/* Add Form Overlay / Modal */}
        {showAddForm && (
          <div className="glass-panel p-6 border border-gold/20 shadow-2xl relative animate-fadeIn">
            <h3 className="text-lg font-semibold text-gold mb-4">🆕 建立新任務</h3>
            <form onSubmit={handleAddTask} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-dim">任務標題</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="輸入任務名稱..."
                    className="bg-black/30 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-cyan/50"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-dim">優先權</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="bg-black/30 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-cyan/50"
                  >
                    <option value="low">低 (Low)</option>
                    <option value="medium">中 (Medium)</option>
                    <option value="high">高 (High)</option>
                  </select>
                </div>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-sm text-dim">任務描述</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="輸入任務細節描述..."
                  rows={2}
                  className="bg-black/30 border border-white/10 rounded-lg p-2 text-white outline-none focus:border-cyan/50"
                />
              </div>

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="glass-btn btn-sm px-4"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="glass-btn btn-sm px-4 bg-gold/10 border-gold/30! text-gold font-semibold"
                >
                  確認建立
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-dim">載入任務數據中...</div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-400">Error: {error}</div>
        ) : (
          /* Kanban Board Layout */
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 min-h-[400px]">
            {columns.map(col => {
              const colTasks = tasks.filter(t => t.status === col.key);
              return (
                <div key={col.key} className="glass-panel p-4 flex flex-col gap-4 border-white/5 bg-white/[0.01]">
                  {/* Column Header */}
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <h3 className="font-semibold text-sm tracking-wider uppercase text-slate-300">
                      {col.title}
                    </h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Column Task Cards */}
                  <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-[250px]">
                    {colTasks.length === 0 ? (
                      <div className="flex-1 border-2 border-dashed border-white/2 rounded-xl flex items-center justify-center text-xs text-dim italic">
                        無任務卡片
                      </div>
                    ) : (
                      colTasks.map(task => (
                        <div
                          key={task.id}
                          className="glass-panel p-3 border-white/5 bg-white/[0.02] hover:bg-white/[0.04] flex flex-col gap-2 relative group"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-medium text-sm text-slate-100">{task.title}</h4>
                            <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-full ${getPriorityBadgeColor(task.priority)}`}>
                              {task.priority}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-xs text-slate-400 line-clamp-2">{task.description}</p>
                          )}
                          
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5 text-[10px]">
                            {/* Move Controls */}
                            <div className="flex gap-1 items-center">
                              {col.key !== 'todo' && (
                                <button
                                  onClick={() => {
                                    const states: TaskItem['status'][] = ['todo', 'in_progress', 'review', 'done'];
                                    const idx = states.indexOf(col.key);
                                    handleUpdateStatus(task.id, states[idx - 1]);
                                  }}
                                  className="text-dim hover:text-cyan px-1 font-bold"
                                  title="往左移"
                                >
                                  &larr;
                                </button>
                              )}
                              <span className="text-dim">移動</span>
                              {col.key !== 'done' && (
                                <button
                                  onClick={() => {
                                    const states: TaskItem['status'][] = ['todo', 'in_progress', 'review', 'done'];
                                    const idx = states.indexOf(col.key);
                                    handleUpdateStatus(task.id, states[idx + 1]);
                                  }}
                                  className="text-dim hover:text-cyan px-1 font-bold"
                                  title="往右移"
                                >
                                  &rarr;
                                </button>
                              )}
                            </div>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-red-400/60 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              title="刪除任務"
                            >
                              刪除
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
