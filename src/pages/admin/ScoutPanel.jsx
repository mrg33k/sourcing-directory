import React, { useState, useEffect, useRef } from 'react';

export default function ScoutPanel({ V, tenantId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [toolPills, setToolPills] = useState({}); // msgId -> [pill labels]
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');

    const userMsg = { id: Date.now(), role: 'user', text };
    const assistantId = Date.now() + 1;
    const assistantMsg = { id: assistantId, role: 'assistant', text: '', pills: [] };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const res = await fetch('/api/sourcing/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, mode: 'admin', tenantId: tenantId || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'text') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, text: m.text + event.text } : m
              ));
            } else if (event.type === 'tool_call') {
              const label = event.name.replace(/_/g, ' ');
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, pills: [...(m.pills || []), label] } : m
              ));
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, text: `Error: ${err.message}` } : m
      ));
    } finally {
      setStreaming(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Scout -- AI Directory Manager"
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
          width: 52, height: 52, borderRadius: '50%',
          background: '#E85D26', border: 'none',
          boxShadow: '0 4px 20px rgba(232,93,38,0.45)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(232,93,38,0.55)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(232,93,38,0.45)'; }}
      >
        {open ? (
          <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </button>

      {/* Drawer */}
      {open && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
          background: '#0F1117', borderLeft: '1px solid rgba(255,255,255,0.08)',
          zIndex: 999, display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#22C55E', boxShadow: '0 0 6px #22C55E',
            }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: "'Inter Tight', Inter, sans-serif", letterSpacing: '-0.01em' }}>
              Scout
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace", marginLeft: 2 }}>
              directory manager
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", textAlign: 'center', marginTop: 40, lineHeight: 1.6 }}>
                Tell me what to do.<br/>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                  "Create a directory and seed it with 15 companies"
                </span>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {/* Tool call pills */}
                {msg.role === 'assistant' && msg.pills && msg.pills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 2 }}>
                    {msg.pills.map((pill, i) => (
                      <span key={i} style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                        padding: '2px 8px', borderRadius: 3,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {pill}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{
                  maxWidth: '88%',
                  background: msg.role === 'user' ? '#E85D26' : 'rgba(255,255,255,0.05)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '3px 12px 12px 12px',
                  padding: '9px 13px',
                  fontSize: 13, color: '#fff',
                  fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.text || (msg.role === 'assistant' && streaming ? (
                    <span style={{ opacity: 0.5 }}>...</span>
                  ) : '')}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Tell Scout what to do..."
                rows={2}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, padding: '9px 12px',
                  color: '#fff', fontSize: 13,
                  fontFamily: "'Space Grotesk', sans-serif",
                  resize: 'none', lineHeight: 1.4, outline: 'none',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={streaming || !input.trim()}
                style={{
                  background: streaming || !input.trim() ? 'rgba(232,93,38,0.3)' : '#E85D26',
                  border: 'none', borderRadius: 8,
                  width: 38, height: 38, flexShrink: 0,
                  cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
              >
                <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
