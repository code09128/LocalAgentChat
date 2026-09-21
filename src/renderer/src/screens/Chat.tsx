import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  isThinking?: boolean;
  isError?: boolean;
  images?: string[];
}

interface AttachedFile {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  previewUrl?: string;
  base64Data?: string;
  textContent?: string;
}

interface ChatProps {
  sessionId: string | null;
  onSessionChange: (id: string | null) => void;
}

export default function Chat({ sessionId, onSessionChange }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [statusText, setStatusText] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Load active session history when sessionId changes
  useEffect(() => {
    if (sessionId) {
      fetch(`/api/sessions/${sessionId}`)
        .then(r => r.json())
        .then(data => {
          if (data && Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        })
        .catch(err => console.error("Load session messages error", err));
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  // Auto-scroll to bottom of chat history on new messages
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTo({
        top: chatHistoryRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // Adjust input textarea height on text change
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputVal]);

  // 處理檔案與圖片
  const processFiles = async (files: FileList | File[]) => {
    const newFiles: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        try {
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                const commaIdx = reader.result.indexOf(',');
                if (commaIdx !== -1) {
                  resolve(reader.result.substring(commaIdx + 1));
                } else {
                  resolve(reader.result);
                }
              } else {
                reject(new Error('無法讀取圖片資料'));
              }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });

          newFiles.push({
            id,
            file,
            name: file.name,
            type: file.type,
            size: file.size,
            previewUrl,
            base64Data
          });
        } catch (err) {
          console.error("圖片讀取失敗:", err);
        }
      } else {
        if (file.size > 5 * 1024 * 1024) {
          alert(`檔案 ${file.name} 超過 5MB，請選擇較小的文字檔案。`);
          continue;
        }
        try {
          const textContent = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          });
          newFiles.push({
            id,
            file,
            name: file.name,
            type: 'text',
            size: file.size,
            textContent
          });
        } catch (err) {
          console.error("無法讀取文字檔:", err);
          alert(`無法讀取 ${file.name} 的內容。`);
        }
      }
    }
    setAttachedFiles(prev => [...prev, ...newFiles]);
  };

  useEffect(() => {
    return () => {
      attachedFiles.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, [attachedFiles]);

  const handleRemoveFile = (id: string) => {
    setAttachedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  // 解析 Markdown 表格為 HTML 表格
  const parseMarkdownTables = (text: string): string => {
    const lines = text.split('\n');
    let inTable = false;
    let tableHtml = '';
    const outputLines: string[] = [];
    let headers: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const isTableRow = line.startsWith('|') && line.endsWith('|') && line.split('|').length > 2;

      if (isTableRow) {
        if (!inTable) {
          inTable = true;
          headers = line.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          tableHtml = '<div class="table-container"><table class="sci-fi-table"><thead><tr>';
          headers.forEach(h => {
            tableHtml += `<th>${h}</th>`;
          });
          tableHtml += '</tr></thead><tbody>';

          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine.startsWith('|') && nextLine.endsWith('|') && nextLine.includes('-')) {
              i++;
            }
          }
        } else {
          const cells = line.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          tableHtml += '<tr>';

          for (let j = 0; j < headers.length; j++) {
            const cellVal = cells[j] || '';
            tableHtml += `<td>${cellVal}</td>`;
          }
          tableHtml += '</tr>';
        }
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += '</tbody></table></div>';
          outputLines.push(tableHtml);
          tableHtml = '';
        }
        outputLines.push(lines[i]);
      }
    }

    if (inTable) {
      tableHtml += '</tbody></table></div>';
      outputLines.push(tableHtml);
    }

    return outputLines.join('\n');
  };

  // Format simple markdown helper
  const formatMarkdown = (text: string) => {
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    html = parseMarkdownTables(html);

    html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${code}</code></pre>`;
    });

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const handleSend = async (textToSend?: string) => {
    let text = (textToSend || inputVal).trim();
    if ((!text && attachedFiles.length === 0) || isSending) return;

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      activeSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      onSessionChange(activeSessionId);
    }

    // 處理文字檔案附加至 prompt
    const textFiles = attachedFiles.filter(f => f.type === 'text');
    if (textFiles.length > 0) {
      let fileContext = '\n\n';
      for (const f of textFiles) {
        fileContext += `[附加文字檔案: ${f.name}]\n\`\`\`\n${f.textContent}\n\`\`\`\n\n`;
      }
      text += fileContext;
    }

    // 處理圖片 base64 負載與預覽
    const imageFiles = attachedFiles.filter(f => f.type.startsWith('image/'));
    const imagePayload = imageFiles.map(f => ({
      mimeType: f.type,
      base64: f.base64Data
    }));
    const userImages = imageFiles.map(f => `data:${f.type};base64,${f.base64Data}`);

    setInputVal('');
    // 清除附加檔案並釋放預覽 Blob URL
    attachedFiles.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setAttachedFiles([]);
    setIsSending(true);

    // Add user message
    const userMsgId = String(Date.now());
    const aiMsgId = String(Date.now() + 1);

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', text, images: userImages }
    ]);

    // Add initial AI typing indicator bubble
    setMessages(prev => [
      ...prev,
      { id: aiMsgId, role: 'ai', text: '', isThinking: true }
    ]);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, sessionId: activeSessionId, images: imagePayload })
      });

      if (!response.ok) {
        throw new Error(`伺服器錯誤: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('無法取得資料串流');

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';
      let currentEvent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.substring(6).trim();
          } else if (trimmed.startsWith('data:')) {
            const dataVal = trimmed.substring(5).trim();
            if (!dataVal) continue;

            try {
              const obj = JSON.parse(dataVal);
              if (currentEvent === 'chunk') {
                accumulatedText += obj.text;
                setStatusText(null); // clear status once we get actual AI text
                // Update specific AI bubble content
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === aiMsgId
                      ? { ...msg, text: accumulatedText, isThinking: false }
                      : msg
                  )
                );
              } else if (currentEvent === 'status') {
                setStatusText(obj.text);
              } else if (currentEvent === 'error') {
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === aiMsgId
                      ? { ...msg, text: `❌ 發生錯誤: ${obj.text}`, isThinking: false, isError: true }
                      : msg
                  )
                );
              }
            } catch (err) {
              console.error("Parse error:", err, dataVal);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Send error:", error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === aiMsgId
            ? { ...msg, text: `❌ 連線失敗: ${error.message}`, isThinking: false, isError: true }
            : msg
        )
      );
    } finally {
      setIsSending(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    if (confirm("確定要清空當前對話歷史嗎？")) {
      setMessages([]);
      onSessionChange(null);
      fetch('/api/sessions', { method: 'DELETE' }).catch(err => console.error(err));
    }
  };

  const fillInputAndSend = (text: string) => {
    setInputVal(text);
    handleSend(text);
  };

  return (
    <main
      className="chat-panel"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="file-drop-overlay">
          <div className="drop-overlay-content">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>將檔案拖曳至此處進行分析...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="panel-header">
        <div className="header-title-container">
          <h2>Local Agent Chat</h2>
          <div className="active-connection">
            <span className="status-dot green animate-pulse"></span>
            <span className="status-label text-dim">Gateway Connected (Port 8000)</span>
          </div>
        </div>
        <div className="header-actions flex gap-2">
          <button
            onClick={() => {
              setMessages([]);
              onSessionChange(null);
            }}
            className="glass-btn btn-sm cursor-pointer flex items-center gap-1.5 font-medium"
            title="新增對話"
          >
            <svg viewBox="0 0 24 24" className="btn-icon">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>新增對話</span>
          </button>
          <button onClick={clearChat} className="glass-btn btn-sm" title="清空對話">
            <svg viewBox="0 0 24 24" className="btn-icon">
              <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6m4-6v6" />
            </svg>
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="chat-history" id="chatHistory" ref={chatHistoryRef}>
        {messages.length === 0 ? (
          /* Welcome Card */
          <div className="welcome-card glass-panel">
            <div className="welcome-header">
              <h3>歡迎使用 Local-AGENT</h3>

            </div>
            <p>這是一個集成了 暗黑科技美學的單頁應用。您可以在此發送請求與 AI 對話，並在右側儀表板中實時監看 AI 的思考狀態、工具調用過程以及日誌攔截。</p>
            <div className="suggestion-chips">
              <button
                className="suggest-chip"
                onClick={() => fillInputAndSend('解析 /home/fard1/Dustin/ai_service 這個資料夾')}
              >
                📂 解析 ai_service 專案
              </button>
              <button
                className="suggest-chip"
                onClick={() => fillInputAndSend('幫我讀取 /home/fard1/Dustin/local_ai_desktop/package.json')}
              >
                📄 讀取 package.json
              </button>
              <button
                className="suggest-chip"
                onClick={() => fillInputAndSend('進行一次簡單的系統效能評估')}
              >
                🚀 系統效能評估
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tool status indicator */}
            {statusText && (
              <div className="tool-status-bubble">
                <span className="status-dot green animate-pulse"></span>
                <span className="tool-status-text">{statusText}</span>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`chat-bubble-wrapper ${msg.role} ${msg.isThinking ? 'thinking' : ''}`}>
                <div className="chat-bubble">
                  {msg.isThinking ? (
                    <div className="typing-indicator">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  ) : (
                    <>
                      {msg.images && msg.images.length > 0 && (
                        <div className="message-images flex gap-2 mb-2 flex-wrap">
                          {msg.images.map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt="Uploaded content"
                              className="max-w-[200px] max-h-[200px] rounded-lg border border-white/10"
                            />
                          ))}
                        </div>
                      )}
                      {formatMarkdown(msg.text)}
                    </>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="attached-files-container">
            {attachedFiles.map(f => (
              <div key={f.id} className="relative">
                {f.type === 'text' ? (
                  <div className="attached-file-text-chip">
                    <svg viewBox="0 0 24 24" className="file-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span className="file-name" title={f.name}>{f.name}</span>
                    <span className="file-size">({(f.size / 1024).toFixed(1)} KB)</span>
                    <button className="remove-file-btn" onClick={() => handleRemoveFile(f.id)}>×</button>
                  </div>
                ) : (
                  <div className="attached-file-preview">
                    <img src={f.previewUrl} alt={f.name} />
                    <button className="remove-file-btn" onClick={() => handleRemoveFile(f.id)}>×</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="input-glow-container">
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="附加檔案或圖片"
            disabled={isSending}
          >
            <svg viewBox="0 0 24 24" className="attach-icon">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          <textarea
            ref={textareaRef}
            id="chatInput"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="輸入您的指令或問題，或拖曳檔案至此... (例如：這張圖片在寫什麼...)"
            rows={1}
            disabled={isSending}
          />
          <button
            id="sendBtn"
            className="send-btn"
            onClick={() => handleSend()}
            disabled={(!inputVal.trim() && attachedFiles.length === 0) || isSending}
          >
            <svg viewBox="0 0 24 24" className="send-icon">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}
