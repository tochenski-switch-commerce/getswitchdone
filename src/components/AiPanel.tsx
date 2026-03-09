'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BotMessageSquare, Send, X, Sparkles, Loader, BarChart3, Trash2 } from '@/components/BoardIcons';
import { hapticLight } from '@/lib/haptics';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function AiPanel({
  boardId,
  boardTitle,
  accessToken,
  onClose,
  onBoardChanged,
}: {
  boardId: string;
  boardTitle: string;
  accessToken: string;
  onClose: () => void;
  onBoardChanged?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, []);

  useEffect(scrollToBottom, [messages, scrollToBottom]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    setInput('');
    hapticLight();

    const userMsg: ChatMessage = { role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          boardId,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: `Error: ${errText || res.statusText}` };
          return copy;
        });
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const content = accumulated;
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'assistant', content };
            return copy;
          });
        }
      }

      // If the AI performed tool calls that mutated the board, refresh
      if (accumulated.includes('✅') || accumulated.includes('success') || accumulated.includes('added') || accumulated.includes('moved')) {
        onBoardChanged?.();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: 'Failed to get response. Please try again.' };
        return copy;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: 'Board Analytics', icon: <BarChart3 size={14} />, prompt: 'Give me a full analytics breakdown of this board with actionable insights.' },
    { label: 'Overdue Cards', icon: <Sparkles size={14} />, prompt: 'What cards are overdue? Suggest how to handle them.' },
    { label: 'Help', icon: <BotMessageSquare size={14} />, prompt: 'What can you help me with? Show me your capabilities.' },
  ];

  return (
    <>
      <div className="kb-ai-backdrop" onClick={onClose} />
      <div className="kb-ai-panel">
        <style>{aiStyles}</style>

        {/* Header */}
        <div className="kb-ai-header">
          <div className="kb-ai-header-left">
            <div className="kb-ai-logo">
              <Sparkles size={16} />
            </div>
            <div className="kb-ai-header-text">
              <span className="kb-ai-title">GSD AI</span>
              <span className="kb-ai-board-badge">{boardTitle}</span>
            </div>
          </div>
          <div className="kb-ai-header-actions">
            {messages.length > 0 && (
              <button
                className="kb-ai-action-btn"
                onClick={() => { setMessages([]); hapticLight(); }}
                title="Clear chat"
              >
                <Trash2 size={14} /> New Chat
              </button>
            )}
            <button className="kb-ai-close-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="kb-ai-messages" ref={listRef}>
          {messages.length === 0 ? (
            <div className="kb-ai-empty">
              <div className="kb-ai-empty-icon">
                <Sparkles size={28} />
              </div>
              <p className="kb-ai-empty-title">How can I help?</p>
              <p className="kb-ai-empty-sub">I can manage cards, analyze your board, suggest checklists, and more.</p>
              <div className="kb-ai-quick-actions">
                {quickActions.map(a => (
                  <button
                    key={a.label}
                    className="kb-ai-quick-btn"
                    onClick={() => sendMessage(a.prompt)}
                  >
                    {a.icon}
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`kb-ai-msg kb-ai-msg-${m.role}`}>
                {m.role === 'assistant' && (
                  <div className="kb-ai-msg-avatar">
                    <Sparkles size={12} />
                  </div>
                )}
                <div className="kb-ai-msg-bubble">
                  {m.role === 'assistant' && !m.content && streaming ? (
                    <div className="kb-ai-typing">
                      <span className="kb-ai-typing-dot" />
                      <span className="kb-ai-typing-dot" />
                      <span className="kb-ai-typing-dot" />
                    </div>
                  ) : (
                    <div className="kb-ai-msg-content" dangerouslySetInnerHTML={{ __html: formatMarkdown(m.content) }} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="kb-ai-input-area">
          <div className="kb-ai-input-row">
            <textarea
              ref={inputRef}
              className="kb-ai-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              disabled={streaming}
            />
            <button
              className="kb-ai-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || streaming}
            >
              {streaming ? <Loader size={18} style={{ animation: 'kb-spin 1s linear infinite' }} /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Simple markdown → HTML for AI responses ── */
function formatMarkdown(text: string): string {
  if (!text) return '';
  return text
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    // Bullet lists
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    .replace(/<p><\/p>/g, '');
}

const aiStyles = `
  /* ── Backdrop ── */
  .kb-ai-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 999;
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
  }

  /* ── Panel: full-screen on mobile, floating card on desktop ── */
  .kb-ai-panel {
    position: fixed;
    inset: 0;
    background: #111318;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* iOS safe area */
    padding-top: env(safe-area-inset-top, 0px);
  }

  /* ── Header ── */
  .kb-ai-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
    min-height: 56px;
  }
  .kb-ai-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .kb-ai-logo {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .kb-ai-header-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .kb-ai-title {
    font-size: 15px;
    font-weight: 700;
    color: #f9fafb;
    line-height: 1.2;
  }
  .kb-ai-board-badge {
    font-size: 12px;
    color: #6b7280;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.3;
  }
  .kb-ai-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .kb-ai-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    font-weight: 600;
    color: #9ca3af;
    background: rgba(255,255,255,0.06);
    border: none;
    padding: 7px 12px;
    border-radius: 8px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .kb-ai-action-btn:active { background: rgba(255,255,255,0.12); }
  .kb-ai-close-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(255,255,255,0.06);
    color: #9ca3af;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .kb-ai-close-btn:active { background: rgba(255,255,255,0.12); color: #f9fafb; }

  /* ── Messages ── */
  .kb-ai-messages {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Empty / Welcome state ── */
  .kb-ai-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    flex: 1;
    padding: 32px 20px;
  }
  .kb-ai-empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2));
    color: #818cf8;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }
  .kb-ai-empty-title {
    font-size: 20px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0 0 8px;
  }
  .kb-ai-empty-sub {
    font-size: 14px;
    color: #6b7280;
    margin: 0 0 28px;
    max-width: 300px;
    line-height: 1.55;
  }
  .kb-ai-quick-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 280px;
  }
  .kb-ai-quick-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 600;
    color: #c4b5fd;
    background: rgba(99,102,241,0.1);
    border: 1px solid rgba(99,102,241,0.2);
    padding: 12px 16px;
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.15s;
    -webkit-tap-highlight-color: transparent;
    text-align: left;
  }
  .kb-ai-quick-btn:active {
    background: rgba(99,102,241,0.25);
    border-color: rgba(99,102,241,0.4);
  }

  /* ── Message bubbles ── */
  .kb-ai-msg {
    display: flex;
    gap: 10px;
    max-width: 100%;
  }
  .kb-ai-msg-user {
    justify-content: flex-end;
  }
  .kb-ai-msg-avatar {
    width: 28px;
    height: 28px;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2));
    color: #818cf8;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .kb-ai-msg-bubble {
    padding: 12px 16px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.6;
    max-width: 88%;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  .kb-ai-msg-user .kb-ai-msg-bubble {
    background: #4f46e5;
    color: #f9fafb;
    border-bottom-right-radius: 6px;
  }
  .kb-ai-msg-assistant .kb-ai-msg-bubble {
    background: rgba(255,255,255,0.05);
    color: #e2e8f0;
    border: 1px solid rgba(255,255,255,0.08);
    border-bottom-left-radius: 6px;
  }

  /* ── Typing indicator (three-dot bounce) ── */
  .kb-ai-typing {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 0;
  }
  .kb-ai-typing-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #818cf8;
    animation: kb-bounce 1.2s infinite ease-in-out;
  }
  .kb-ai-typing-dot:nth-child(2) { animation-delay: 0.15s; }
  .kb-ai-typing-dot:nth-child(3) { animation-delay: 0.3s; }
  @keyframes kb-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-5px); opacity: 1; }
  }

  /* ── Message content formatting ── */
  .kb-ai-msg-content h3, .kb-ai-msg-content h4 {
    font-size: 14px;
    font-weight: 700;
    color: #f9fafb;
    margin: 10px 0 4px;
  }
  .kb-ai-msg-content h3:first-child, .kb-ai-msg-content h4:first-child { margin-top: 0; }
  .kb-ai-msg-content p { margin: 4px 0; }
  .kb-ai-msg-content ul { margin: 6px 0; padding-left: 20px; }
  .kb-ai-msg-content li { margin: 3px 0; }
  .kb-ai-msg-content strong { color: #f9fafb; }
  .kb-ai-msg-content code {
    background: rgba(255,255,255,0.08);
    padding: 2px 6px;
    border-radius: 5px;
    font-size: 13px;
  }
  .kb-ai-msg-content pre {
    background: rgba(0,0,0,0.35);
    border-radius: 10px;
    padding: 12px 14px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin: 8px 0;
  }
  .kb-ai-msg-content pre code {
    background: none;
    padding: 0;
    font-size: 13px;
  }

  /* ── Input area ── */
  .kb-ai-input-area {
    flex-shrink: 0;
    padding: 12px 16px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid rgba(255,255,255,0.08);
    background: #111318;
  }
  .kb-ai-input-row {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 14px;
    padding: 6px 6px 6px 16px;
  }
  .kb-ai-input-row:focus-within {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79,70,229,0.15);
  }
  .kb-ai-input {
    flex: 1;
    background: transparent;
    border: none;
    padding: 8px 0;
    color: #e2e8f0;
    font-size: 15px;
    line-height: 1.45;
    resize: none;
    outline: none;
    min-height: 24px;
    max-height: 120px;
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
  }
  .kb-ai-input::placeholder {
    color: #4b5563;
  }
  .kb-ai-send-btn {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: #4f46e5;
    color: #fff;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, transform 0.1s;
  }
  .kb-ai-send-btn:active:not(:disabled) { background: #4338ca; transform: scale(0.93); }
  .kb-ai-send-btn:disabled { opacity: 0.3; cursor: default; }

  @keyframes kb-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Desktop: floating card instead of full-screen ── */
  @media (min-width: 640px) {
    .kb-ai-panel {
      inset: auto;
      top: calc(env(safe-area-inset-top, 0px) + 8px);
      right: 8px;
      width: 440px;
      height: calc(100vh - env(safe-area-inset-top, 0px) - 16px);
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      padding-top: 0;
    }
    .kb-ai-quick-actions {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      max-width: 360px;
    }
    .kb-ai-quick-btn {
      flex: 0 0 auto;
      padding: 8px 14px;
      font-size: 13px;
    }
    .kb-ai-msg-bubble {
      font-size: 13px;
    }
    .kb-ai-input {
      font-size: 14px;
    }
  }
`;
