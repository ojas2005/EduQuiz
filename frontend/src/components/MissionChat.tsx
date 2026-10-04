import { useEffect, useId, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageCircleQuestion, Send, Sparkles, History, Plus } from 'lucide-react';
import { api } from '../api';
import { Alert, Button, Modal } from './UI';

type Message = { role: 'user' | 'assistant'; content: string; demo?: boolean };
type ChatSession = { id: string; date: number; messages: Message[] };

export function MissionChat({ courseId, missionIndex, title }: { courseId: string; missionIndex: number; title: string }) {
  const [open, setOpen] = useState(false);
  const storageKey = `eduquiz:chats:${courseId}:${missionIndex}`;

  const [sessionId, setSessionId] = useState(() => Date.now().toString());
  const [messages, setMessages] = useState<Message[]>([]);
  const [savedSessions, setSavedSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const active = useRef(true), sending = useRef(false);
  const transcript = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setSavedSessions(JSON.parse(stored));
    } catch {}
  }, [storageKey]);
  
  useEffect(() => {
    if (messages.length === 0) return;
    setSavedSessions(prev => {
      const existing = prev.findIndex(s => s.id === sessionId);
      const updated = [...prev];
      if (existing >= 0) {
        updated[existing] = { ...updated[existing], messages };
      } else {
        updated.unshift({ id: sessionId, date: Date.now(), messages });
      }
      try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [messages, sessionId, storageKey]);

  useEffect(() => {
    const log = transcript.current;
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [messages, pending, open, showHistory]);

  async function send() {
    const text = question.trim();
    if (!text || sending.current) return;
    sending.current = true; setPending(text); setError('');
    try {
      const history = messages.filter(item => !item.demo).slice(-6).map(({ role, content }) => ({ role, content }));
      while (history.reduce((length, item) => length + item.content.length, 0) > 6000) history.shift();
      const answer = await api<{ reply: string; demo: boolean }>(`/courses/${courseId}/chat`, 'POST', {
        mission_index: missionIndex, question: text,
        history,
      });
      if (!active.current) return;
      setMessages(items => [...items, { role: 'user', content: text } as Message, { role: 'assistant', content: answer.reply, demo: answer.demo } as Message].slice(-20));
      setQuestion('');
    } catch (reason) {
      if (active.current) setError(reason instanceof Error ? reason.message : 'Could not send your question. Please try again.');
    } finally {
      sending.current = false;
      if (active.current) { setPending(''); input.current?.focus(); }
    }
  }

  function loadSession(id: string) {
    const session = savedSessions.find(s => s.id === id);
    if (session) {
      setSessionId(id);
      setMessages(session.messages);
      setShowHistory(false);
    }
  }

  function startNewChat() {
    setSessionId(Date.now().toString());
    setMessages([]);
    setShowHistory(false);
  }

  return <>
    <button className="mission-chat-launcher" aria-label={`Ask your tutor about ${title}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <MessageCircleQuestion size={23} aria-hidden="true"/><span>Ask a doubt</span>
    </button>
    {open && <Modal className="mission-chat" title="Let’s make it click." subtitle={`Mission ${missionIndex + 1} · ${title}`} onClose={() => setOpen(false)}>
      <div className="chat-header-actions">
        <p className="chat-context">Ask about this lesson. Your connected model receives the lesson and recent messages. Chat history is saved in this browser.</p>
        <Button variant="secondary" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? 'Back to chat' : <><History size={15} aria-hidden="true"/> Previous chats</>}
        </Button>
      </div>

      {showHistory ? (
        <div className="chat-history-view">
          <div className="chat-history-header">
            <h3>Your Conversations</h3>
            <Button onClick={startNewChat}><Plus size={15} aria-hidden="true"/> New Chat</Button>
          </div>
          {savedSessions.length === 0 ? <p>No previous chats found.</p> : (
            <ul className="chat-history-list">
              {savedSessions.map(s => (
                <li key={s.id}>
                  <button className={`chat-history-item ${s.id === sessionId ? 'active' : ''}`} onClick={() => loadSession(s.id)}>
                    <strong>{new Date(s.date).toLocaleString()}</strong>
                    <span>{s.messages.find(m => m.role === 'user')?.content || 'Empty chat'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="chat-transcript" ref={transcript} role="log" aria-label="Mission tutor conversation" aria-live="polite" aria-relevant="additions text">
        {!messages.length && !pending && <div className="chat-welcome"><Sparkles size={24} aria-hidden="true"/><h3>No question too small.</h3><p>Need a simpler explanation or another example? Start here.</p></div>}
        {messages.map((message, index) => <div key={index} className={`chat-message chat-${message.role}`}><span className="eyebrow">{message.role === 'user' ? 'YOU' : message.demo ? 'LESSON GUIDE · DEMO' : 'MISSION TUTOR'}</span><div className="chat-message-content"><ReactMarkdown>{message.content}</ReactMarkdown></div></div>)}
        {pending && <><div className="chat-message chat-user"><span className="eyebrow">YOU</span><p>{pending}</p></div><p className="chat-thinking" role="status">Thinking through your question…</p></>}
      </div>
      {!messages.length && !pending && <div className="chat-suggestions" aria-label="Question starters">{['Explain this more simply', 'Give me another example', 'Help me get started with the task'].map(prompt => <button key={prompt} type="button" onClick={() => { setQuestion(prompt); input.current?.focus(); }}>{prompt}</button>)}</div>}
      {error && <Alert error>{error} Your question is still below; you can send it again.</Alert>}
      <form className="chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
        <label htmlFor={inputId}>Your question</label>
        <textarea ref={input} id={inputId} value={question} onChange={event => setQuestion(event.target.value)} maxLength={1500} rows={3} placeholder="Which part feels unclear?" required readOnly={!!pending}/>
        <div className="chat-compose-actions"><small>{question.length}/1500</small><Button type="submit" disabled={!!pending || !question.trim()}>{pending ? 'Thinking…' : error ? 'Try again' : 'Send question'}<Send size={16} aria-hidden="true"/></Button></div>
      </form>
      <p className="chat-footnote">AI can make mistakes. Without a model connection, demo mode shares saved lesson guidance. <a href="#settings">Model settings</a></p>
      </>
      )}
    </Modal>}
  </>;
}
