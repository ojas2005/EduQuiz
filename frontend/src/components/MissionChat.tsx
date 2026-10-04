import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { MessageCircleQuestion, Send, Sparkles, History, Plus } from 'lucide-react';
import { api } from '../api';
import type { Course } from '../types';
import { Alert, Button, Loading, Modal } from './UI';

type Context = { courseId: string; missionIndex: number };
type Message = { role: 'user' | 'assistant'; content: string; demo?: boolean };
type ChatSummary = { id: string; course_id: string; mission_index: number; course_title: string; mission_title: string; revision: number; date: string; preview: string };
type ChatSession = ChatSummary & { messages: Message[] };
type HistoryPage = { items: ChatSummary[]; next_offset: number | null };
type LegacyChat = { source: string; context: Context; date: number; messages: Message[]; title: string; mission: string };

function browserChats(courses: Course[], userId: string): LegacyChat[] {
  const found: LegacyChat[] = [];
  try {
    const imported: string[] = JSON.parse(localStorage.getItem(`eduquiz:chat-imported:${userId}`) || '[]');
    for (const course of courses) for (let index = 0; index <= Math.min(course.current, course.missions.length - 1); index++) {
      const stored = JSON.parse(localStorage.getItem(`eduquiz:chats:${course.id}:${index}`) || '[]');
      if (!Array.isArray(stored)) continue;
      for (const item of stored) {
        const source = `${course.id}:${index}:${item.id}`;
        if (typeof item.id !== 'string' || item.id.length > 100 || imported.includes(source) || !Array.isArray(item.messages) || !item.messages.length) continue;
        if (item.messages.some((m: Message) => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) continue;
        found.push({ source, context: { courseId: course.id, missionIndex: index }, date: Number(item.date) || 0, messages: item.messages, title: course.title, mission: course.missions[index].title });
      }
    }
  } catch { /* Keep account history available if old browser data cannot be read. */ }
  return found.sort((a, b) => b.date - a.date);
}

export function MissionChat({ userId, courses, preferred }: { userId: string; courses: Course[]; preferred?: Context }) {
  const [open, setOpen] = useState(false), [showHistory, setShowHistory] = useState(false);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [history, setHistory] = useState<ChatSummary[]>([]), [nextOffset, setNextOffset] = useState<number | null>(null);
  const [legacy, setLegacy] = useState<LegacyChat[]>([]);
  const [question, setQuestion] = useState(''), [pending, setPending] = useState(''), [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const active = useRef(true), sending = useRef(false), epoch = useRef(0);
  const request = useRef<{ question: string; sessionId: string; id: string } | null>(null);
  const transcript = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null);
  const inputId = useId(), contextId = useId();
  const defaultCourse = courses.find(course => !course.complete) || courses[0];
  const fallback = preferred || (defaultCourse ? { courseId: defaultCourse.id, missionIndex: Math.min(defaultCourse.current, defaultCourse.missions.length - 1) } : null);
  const chosen = session ? { courseId: session.course_id, missionIndex: session.mission_index } : context || fallback;
  const course = courses.find(item => item.id === chosen?.courseId);
  const missionTitle = session?.mission_title || course?.missions[chosen?.missionIndex ?? 0]?.title;
  const messages = session?.messages || [];
  const busy = !!pending || loading;
  useEffect(() => { active.current = true; return () => { active.current = false; epoch.current++; }; }, []);
  useEffect(() => {
    if (!session && !question && !open) setContext(null);
  }, [preferred?.courseId, preferred?.missionIndex]);
  useEffect(() => {
    const log = transcript.current;
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [session, pending, open, showHistory]);

  function newChat() {
    epoch.current++; setSession(null); setContext(fallback); setDraftId(crypto.randomUUID());
    setQuestion(''); setError(''); setShowHistory(false); request.current = null;
  }
  async function loadHistory(offset = 0) {
    const operation = ++epoch.current;
    setShowHistory(true); setLoading(true); setError('');
    setLegacy(browserChats(courses, userId));
    try {
      const page = await api<HistoryPage>(`/chats?offset=${offset}`);
      if (!active.current || operation !== epoch.current) return;
      setHistory(items => offset ? [...items, ...page.items.filter(item => !items.some(old => old.id === item.id))] : page.items);
      setNextOffset(page.next_offset);
    } catch (reason) { if (active.current && operation === epoch.current) setError((reason as Error).message); }
    finally { if (active.current && operation === epoch.current) setLoading(false); }
  }
  async function resume(id: string, old?: LegacyChat) {
    const operation = ++epoch.current;
    setLoading(true); setError('');
    try {
      const value = old ? await api<ChatSession>('/chats/import', 'POST', {
        course_id: old.context.courseId, mission_index: old.context.missionIndex,
        source_id: id, messages: old.messages.map(({ role, content, demo }) => ({ role, content, demo: !!demo })),
      }) : await api<ChatSession>(`/chats/${id}`);
      if (!active.current || operation !== epoch.current) return;
      if (old) {
        try {
          const key = `eduquiz:chat-imported:${userId}`;
          const imported = JSON.parse(localStorage.getItem(key) || '[]');
          localStorage.setItem(key, JSON.stringify([...imported, old.source]));
        } catch { /* Imports are idempotent if browser storage is unavailable. */ }
      }
      if (session?.id !== value.id) setQuestion('');
      setSession(value); setShowHistory(false); request.current = null;
    } catch (reason) { if (active.current && operation === epoch.current) setError((reason as Error).message); }
    finally { if (active.current && operation === epoch.current) setLoading(false); }
  }
  async function send() {
    const text = question.trim();
    if (!text || sending.current || loading || !chosen) return;
    sending.current = true; setPending(text); setError('');
    const id = session?.id || draftId;
    // Keep the same request ID when retrying an uncertain response.
    if (request.current?.question !== text || request.current?.sessionId !== id) request.current = { question: text, sessionId: id, id: crypto.randomUUID() };
    try {
      const answer = await api<{ session: ChatSession }>(`/courses/${chosen.courseId}/chat`, 'POST', {
        mission_index: chosen.missionIndex, question: text, session_id: id,
        request_id: request.current.id, revision: session?.revision || 0,
      });
      if (!active.current) return;
      setSession(answer.session); setQuestion(''); request.current = null;
    } catch (reason) { if (active.current) setError((reason as Error).message); }
    finally { sending.current = false; if (active.current) { setPending(''); input.current?.focus(); } }
  }
  return createPortal(<>
    <button className="mission-chat-launcher" aria-label="Ask a doubt" aria-haspopup="dialog" aria-expanded={open} onClick={() => { if (!session && !context) setContext(fallback); setOpen(true); }}>
      <MessageCircleQuestion size={23} aria-hidden="true"/><span>Ask a doubt</span>
    </button>
    {open && <Modal className="mission-chat" title="Let’s make it click." subtitle={missionTitle ? `${session?.course_title || course?.title} · ${missionTitle}` : 'Your mission tutor, wherever you are.'} onClose={() => setOpen(false)}>
      <p className="chat-context">Conversations are saved to your account. Each reload starts a fresh chat; reopen an earlier one to keep the conversation going.</p>
      <div className="chat-header-actions"><Button variant="secondary" disabled={busy} onClick={() => showHistory ? setShowHistory(false) : void loadHistory()}><History size={15} aria-hidden="true"/>{showHistory ? 'Back to chat' : 'Previous chats'}</Button><Button variant="ghost" disabled={busy} onClick={newChat}><Plus size={15} aria-hidden="true"/>New chat</Button></div>
      {error && <Alert error>{error}{!showHistory && ' Your question is still below.'}</Alert>}
      {showHistory ? <div className="chat-history-view">
        <h3>Your conversations</h3>
        {loading && <Loading label="Loading conversations…"/>}
        {!loading && !history.length && !legacy.length && !error && <p>No saved chats yet. Send your first question to start one.</p>}
        {error && <Button variant="secondary" disabled={loading} onClick={() => void loadHistory()}>Retry loading chats</Button>}
        <ul className="chat-history-list">{history.map(item => <li key={item.id}><button disabled={busy} className={`chat-history-item ${session?.id === item.id ? 'active' : ''}`} onClick={() => void resume(item.id)}><strong>{item.preview}</strong><span>{item.course_title} · {item.mission_title}</span><small>{new Date(item.date).toLocaleString()}</small></button></li>)}</ul>
        {nextOffset !== null && <Button variant="ghost" disabled={busy} onClick={() => void loadHistory(nextOffset)}>Load older chats</Button>}
        {!!legacy.length && <><h3>Earlier chats on this browser</h3><p>Open a conversation to save it to your account.</p><ul className="chat-history-list">{legacy.map(item => <li key={item.source}><button disabled={busy} className="chat-history-item" onClick={() => void resume(item.source.split(':').slice(2).join(':'), item)}><strong>{item.messages[0]?.content.slice(0, 100)}</strong><span>{item.title} · {item.mission}</span><small>{new Date(item.date).toLocaleString()}</small></button></li>)}</ul></>}
      </div> : <>
        {!session && <label className="recap-picker" htmlFor={contextId}><span>Ask about a mission</span><select id={contextId} disabled={busy || !courses.length} value={chosen ? `${chosen.courseId}:${chosen.missionIndex}` : ''} onChange={event => { const [courseId, index] = event.target.value.split(':'); setContext({ courseId, missionIndex: Number(index) }); setDraftId(crypto.randomUUID()); request.current = null; setError(''); }}>
          {!courses.length && <option value="">Start a learning path first</option>}
          {courses.flatMap(path => path.missions.slice(0, Math.min(path.current + 1, path.missions.length)).map((mission, index) => <option key={`${path.id}:${index}`} value={`${path.id}:${index}`}>{path.title} · {index + 1}. {mission.title}</option>))}
        </select></label>}
        {!chosen ? <div className="chat-welcome"><p>Your tutor can help once you have a mission to explore.</p><a className="text-link" href="#learning" onClick={() => setOpen(false)}>Open your learning shelf</a></div> : <>
          <div className="chat-transcript" ref={transcript} role="log" aria-label="Mission tutor conversation" aria-live="polite" aria-relevant="additions text">
            {!messages.length && !pending && <div className="chat-welcome"><Sparkles size={24} aria-hidden="true"/><h3>No question too small.</h3><p>Ask for an explanation, an example, or a hint.</p></div>}
            {messages.map((message, index) => <div key={index} className={`chat-message chat-${message.role}`}><span className="eyebrow">{message.role === 'user' ? 'YOU' : message.demo ? 'LESSON GUIDE · DEMO' : 'MISSION TUTOR'}</span><div className="chat-message-content"><ReactMarkdown skipHtml disallowedElements={['img']}>{message.content}</ReactMarkdown></div></div>)}
            {pending && <><div className="chat-message chat-user"><span className="eyebrow">YOU</span><p>{pending}</p></div><p className="chat-thinking" role="status">Thinking through your question…</p></>}
          </div>
          {!messages.length && !pending && <div className="chat-suggestions" aria-label="Question starters">{['Explain this more simply', 'Give me another example'].map(prompt => <button key={prompt} type="button" onClick={() => { setQuestion(prompt); input.current?.focus(); }}>{prompt}</button>)}</div>}
          <form className="chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}><label htmlFor={inputId}>Your question</label><textarea ref={input} id={inputId} value={question} onChange={event => setQuestion(event.target.value)} maxLength={1500} rows={3} placeholder="Which part feels unclear?" required readOnly={busy}/><div className="chat-compose-actions"><small>{question.length}/1500</small><Button type="submit" disabled={busy || !question.trim()}>{pending ? 'Thinking…' : error ? 'Try again' : 'Send question'}<Send size={16} aria-hidden="true"/></Button></div></form>
        </>}
        <p className="chat-footnote">Your connected model receives the lesson and recent messages. AI can make mistakes. Demo mode shares saved lesson guidance. <a href="#settings" onClick={() => setOpen(false)}>Model settings</a></p>
      </>}
    </Modal>}
  </>, document.body);
}
