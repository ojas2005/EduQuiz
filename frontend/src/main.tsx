import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, BookOpen, ChartNoAxesCombined, ChevronRight, LayoutDashboard, LogOut, Menu, Plus, Settings, ShieldCheck, X, Zap } from 'lucide-react';
import { api, ApiError, refreshSession, setToken } from './api';
import type { Course, Credential, Page, Report, Result, Route, User } from './types';
import { Alert, Brand, Button, Loading, Modal } from './components/UI';
import { Landing } from './pages/Landing';
import { Dashboard, Library } from './pages/Dashboard';
import { MissionChat } from './components/MissionChat';
import { MissionPage } from './pages/Mission';
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { AdminPage } from './pages/Admin';
import { ThemeToggle, useTheme } from './components/ThemeToggle';
import { NavigationDrawer } from './components/NavigationDrawer';
import { Avatar, ProfileEditor } from './components/Profile';
import './style.css';
import './theme.css';
const names: Record<Page, string> = { overview: 'Overview', learning: 'My learning', practice: 'Practice studio', growth: 'Growth report', settings: 'Settings', admin: 'Administration', mission: 'Learning mission' };
const navItems = [{ page: 'overview', label: 'Overview', icon: LayoutDashboard }, { page: 'learning', label: 'My learning', icon: BookOpen }, { page: 'practice', label: 'Practice studio', icon: Zap }, { page: 'growth', label: 'Growth report', icon: ChartNoAxesCombined }, { page: 'settings', label: 'Settings', icon: Settings }] as const;
function getRoute(): Route {
  const [page, id] = window.location.hash.slice(1).split('/');
  return Object.prototype.hasOwnProperty.call(names, page) ? { page: page as Page, id } : { page: 'overview' };
}
function App() {
  const { theme, toggleTheme } = useTheme();
  const [route, setRoute] = useState<Route>(getRoute), [user, setUser] = useState<User | null>(null), [ready, setReady] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]), [report, setReport] = useState<Report>({ attempts: [], skills: [] }), [credential, setCredential] = useState<Credential>({ configured: false, demo_mode: false });
  const [active, setActive] = useState<Course | null>(null), [result, setResult] = useState<Result | null>(null), [dataLoading, setDataLoading] = useState(false), [missionLoading, setMissionLoading] = useState(false), [loadError, setLoadError] = useState(''), [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [menu, setMenu] = useState(false), [profile, setProfile] = useState(false);
  const [auth, setAuth] = useState<'login' | 'signup' | null>(null), [create, setCreate] = useState<{ practice: boolean; topic: string } | null>(null), [intendedTopic, setIntendedTopic] = useState<string | null>(null);
  const actionLock = useRef(false), operationId = useRef(0);
  function navigate(page: string, id?: string) { window.location.hash = page + (id ? '/' + id : ''); }
  function clearSession() {
    operationId.current++; setToken(''); setUser(null); setCourses([]); setReport({ attempts: [], skills: [] }); setCredential({ configured: false, demo_mode: false }); setActive(null); setResult(null); setCreate(null); setMenu(false); setProfile(false); setLoadError('');
    try { for (const key of Object.keys(sessionStorage)) if (key.startsWith('eduquiz:draft:')) sessionStorage.removeItem(key); } catch {}
  }
  useEffect(() => {
    let alive = true;
    refreshSession().then(data => { if (alive) setUser(data.user); }).catch(err => { if (alive && (!(err instanceof ApiError) || err.status !== 401)) setError('Could not restore your session. You can try signing in again.'); }).finally(() => { if (alive) setReady(true); });
    const expired = () => { clearSession(); setAuth('login'); setError('Your session ended. Sign in again to continue.'); };
    window.addEventListener('eduquiz:session-expired', expired);
    return () => { alive = false; window.removeEventListener('eduquiz:session-expired', expired); };
  }, []);
  useEffect(() => {
    const changed = () => { if (['#main-content', '#how-it-works'].includes(window.location.hash)) return; setRoute(getRoute()); setMenu(false); setError(''); setNotice(''); setResult(null); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); };
    window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => { document.title = user ? `${names[route.page]} · EduQuiz` : 'EduQuiz — Less scrolling. More understanding.'; }, [route.page, user]);
  useEffect(() => {
    if (!user) return;
    let alive = true; setDataLoading(true); setLoadError('');
    Promise.all([api<Course[]>('/courses'), api<Report>('/report'), api<Credential>('/credential')]).then(([paths, data, key]) => { if (alive) { setCourses(paths); setReport(data); setCredential(key); } }).catch(err => { if (alive) setLoadError(err.message); }).finally(() => { if (alive) setDataLoading(false); });
    return () => { alive = false; };
  }, [user?.id, revision]);
  useEffect(() => {
    if (!user || route.page !== 'mission' || !route.id) { setActive(null); return; }
    let alive = true; setActive(null); setResult(null); setMissionLoading(true); setError('');
    api<Course>('/courses/' + encodeURIComponent(route.id)).then(course => { if (alive) setActive(course); }).catch(err => { if (alive) setError(err.message); }).finally(() => { if (alive) setMissionLoading(false); });
    return () => { alive = false; };
  }, [user?.id, route.page, route.id]);
  useEffect(() => { if (!busy) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [busy]);
  async function perform(label: string, action: () => Promise<void>) {
    if (actionLock.current) return false;
    actionLock.current = true; setBusy(label); setError(''); setNotice('');
    try { await action(); return true; } catch (err) { setError((err as Error).message); return false; } finally { actionLock.current = false; setBusy(''); }
  }
  function start(practice = false, topic = '') { setError(''); setNotice(''); setCreate({ practice, topic }); }
  function openCourse(course: Course) {
    if (course.complete) navigate('growth', course.id); else navigate('mission', course.id);
  }
  async function logout() { await perform('Signing out…', async () => { await api('/auth/logout', 'POST'); clearSession(); navigate('overview'); }); }
  async function submit(data: { mission_index: number; answers: number[]; question_order: number[]; skip: boolean; tasks_completed: boolean }) {
    if (!active) return false;
    const id = active.id;
    return perform('Checking your answers…', async () => {
      const value = await api<Result>(`/courses/${id}/submit`, 'POST', data);
      setResult(value); setActive(value.course); setRevision(value => value + 1); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
  async function decision(attemptId: string, remediate: boolean) {
    if (!active) return;
    await perform(remediate ? 'Creating a focused mission…' : 'Opening your next topic…', async () => {
      const value = await api<Course>(`/courses/${active.id}/decision`, 'POST', { attempt_id: attemptId, remediate });
      setActive(value); setResult(null); setRevision(value => value + 1); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
  async function startSuggestedTopic() {
    if (!active) return false;
    const epoch = operationId.current;
    return perform('Opening your next topic…', async () => {
      const course = await api<Course>(`/courses/${active.id}/continue`, 'POST');
      if (epoch !== operationId.current) return;
      setCourses(paths => [course, ...paths.filter(path => path.id !== course.id)]);
      navigate('mission', course.id);
    });
  }
  const pending = report.attempts.find(attempt => attempt.id === active?.pending_attempt);
  if (!ready) return <Loading/>;
  return <><a className="skip-link" href="#main-content">Skip to content</a>{!user ? <Landing theme={theme} onToggleTheme={toggleTheme} onAuth={mode => { setError(''); setAuth(mode); }} onTopic={topic => { setIntendedTopic(topic); setError(''); setAuth('signup'); }}/> : <div className="workspace-shell">
    {menu && <NavigationDrawer onClose={() => setMenu(false)} footer={<button className="sidebar-logout" disabled={!!busy} onClick={logout}><LogOut size={20} aria-hidden="true"/><span>Log out<small>Sign out of all devices</small></span><ArrowRight size={17} aria-hidden="true"/></button>}>{close => <><a href="#overview" className="sidebar-brand" aria-label="EduQuiz overview"><Brand/></a><div className="sidebar-label">YOUR WORKSPACE</div><nav aria-label="Main navigation">{navItems.map(({ page, label, icon: Icon }) => <a key={page} href={'#' + page} className={route.page === page || route.page === 'mission' && page === 'learning' ? 'active' : ''} aria-current={route.page === page ? 'page' : undefined}><Icon size={19} aria-hidden="true"/>{label}{page === 'learning' && <span className="nav-count">{courses.filter(course => !course.practice).length}</span>}</a>)}{user.role === 'admin' && <a href="#admin" className={route.page === 'admin' ? 'active' : ''}><ShieldCheck size={19} aria-hidden="true"/>Administration</a>}</nav><div className="sidebar-note"><span className="eyebrow">A NOTE TO SELF</span><p>You don’t have to<br/>learn it all <em>today.</em></p><button onClick={() => close(() => start())} className="text-link">Just take the next step<ArrowRight size={15} aria-hidden="true"/></button></div></>}</NavigationDrawer>}
    <div className="workspace-body"><header className="workspace-header"><button className="icon-button menu-button" aria-label="Open navigation" aria-expanded={menu} aria-controls="workspace-navigation" onClick={() => setMenu(true)}><Menu size={21}/></button><span className="breadcrumb">Workspace<ChevronRight size={13} aria-hidden="true"/><strong>{names[route.page]}</strong></span><span className="header-date">{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span><ThemeToggle theme={theme} onToggle={toggleTheme}/><button className="header-avatar profile-trigger" aria-label="Edit your profile" onClick={() => { setError(''); setProfile(true); }}><Avatar user={user}/></button></header>
      <main key={route.page + (route.id || '')} id="main-content" className="workspace-content" tabIndex={-1}>{error && !auth && !create && !profile && <Alert error onDismiss={() => setError('')}>{error}</Alert>}{notice && <Alert onDismiss={() => setNotice('')}>{notice}</Alert>}{loadError && <Alert error>{loadError}<Button variant="ghost" onClick={() => setRevision(value => value + 1)}>Retry loading</Button></Alert>}
        {dataLoading && !courses.length && ['overview', 'learning', 'practice', 'growth'].includes(route.page) ? <Loading/> : <>
          {route.page === 'overview' && <Dashboard user={user} courses={courses} report={report} credential={credential} open={openCourse} create={start} navigate={navigate}/>}
          {(route.page === 'learning' || route.page === 'practice') && <Library key={route.page} practice={route.page === 'practice'} courses={courses} open={openCourse} create={() => start(route.page === 'practice')}/>}
          {route.page === 'mission' && (missionLoading ? <Loading label="Opening your mission…"/> : active ? <MissionPage key={active.id + ':' + active.current} course={active} userId={user.id} result={result} pending={pending} busy={!!busy} onSubmit={submit} onDecision={decision} onHome={() => navigate('overview')} onStartTopic={startSuggestedTopic} onReview={() => navigate('growth', active.id)} onNext={() => { setResult(null); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}/> : <div className="panel"><h1>This mission isn’t available.</h1><p>Open a learning path to continue.</p><a className="text-link" href="#learning">Back to your learning shelf<ArrowRight size={16} aria-hidden="true"/></a></div>)}
          {route.page === 'growth' && <Reports key={route.id || 'all'} selectedCourse={route.id} report={report} courses={courses} busy={!!busy} onPractice={() => start(true)} onExport={() => perform('Preparing your report…', async () => { const data = await api<Report>('/report/export', 'POST'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'eduquiz-report.json'; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Your report has been downloaded and saved to private storage.'); })}/>}
          {route.page === 'settings' && <SettingsPage onEditProfile={() => setProfile(true)} user={user} credential={credential} busy={!!busy} onSave={data => perform('Saving your connection…', async () => { await api('/credential', 'PUT', data); setCredential({ ...credential, configured: true, provider: data.provider, model: data.model }); setNotice('Connection saved. Your next path will use this model.'); })} onDelete={() => perform('Removing your key…', async () => { await api('/credential', 'DELETE'); setCredential({ configured: false, demo_mode: credential.demo_mode }); setNotice('The stored key has been removed.'); })} onLogout={logout}/>}
          {route.page === 'admin' && (user.role === 'admin' ? <AdminPage/> : <Alert error>Only administrators can access this page.</Alert>)}
        </>}<footer className="workspace-footer"><span>Keep asking good questions.</span><span>eduquiz / your learning desk</span></footer>
      </main>
    </div>
  </div>}
  {user && <MissionChat key={user.id} userId={user.id} courses={active ? [active, ...courses.filter(course => course.id !== active.id)] : courses} preferred={active ? { courseId: active.id, missionIndex: result?.mission_index ?? pending?.mission_index ?? Math.min(active.current, active.missions.length - 1) } : undefined}/>}
  {!user && error && !auth && <div className="public-error"><Alert error onDismiss={() => setError('')}>{error}</Alert></div>}
  {profile && user && <ProfileEditor user={user} busy={!!busy} onClose={() => { setProfile(false); setError(''); }} onSave={data => perform('Saving your profile…', async () => { const updated = await api<User>('/me', 'PUT', data); setUser(updated); })}/>}
  {auth && <Modal title={auth === 'signup' ? 'A good place to begin.' : 'Back to your learning desk.'} subtitle={auth === 'signup' ? 'Make an account. Bring your curiosity.' : 'Sign in to pick up where you left off.'} busy={!!busy} onClose={() => { setAuth(null); setIntendedTopic(null); setError(''); }}><form onSubmit={event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); perform(auth === 'signup' ? 'Creating your account…' : 'Signing you in…', async () => { const data = await api<{ user: User; access_token: string }>('/auth/' + auth, 'POST', values); setToken(data.access_token); setUser(data.user); setAuth(null); if (intendedTopic) { setCreate({ practice: false, topic: intendedTopic }); setIntendedTopic(null); } if (route.page !== 'mission') navigate('overview'); }); }}>
    {auth === 'signup' && <><label htmlFor="auth-name">Your name</label><input id="auth-name" name="name" required maxLength={100} autoComplete="name" autoFocus/></>}<label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" name="email" required autoComplete="email" autoFocus={auth === 'login'}/><label htmlFor="auth-password">Password</label><input id="auth-password" type="password" name="password" required minLength={12} maxLength={128} autoComplete={auth === 'signup' ? 'new-password' : 'current-password'}/><small>At least 12 characters. Password managers and paste are welcome.</small>{error && <Alert error>{error}</Alert>}<Button type="submit" disabled={!!busy} className="full-width">{busy || (auth === 'signup' ? 'Create my account' : 'Log in')}<ArrowRight size={17} aria-hidden="true"/></Button></form><button className="auth-switch" disabled={!!busy} onClick={() => { setAuth(auth === 'signup' ? 'login' : 'signup'); setError(''); }}>{auth === 'signup' ? 'Already have an account? Log in' : 'New here? Create an account'}</button></Modal>}
  {create && user && <Modal title={create.practice ? 'A little practice goes a long way.' : 'What’s caught your curiosity?'} subtitle={create.practice ? 'Choose a topic for a focused quiz.' : 'We’ll adapt the number of chapters and quiz questions to the topic’s difficulty and importance.'} busy={!!busy} onClose={() => { setCreate(null); setError(''); }}><form onSubmit={event => { event.preventDefault(); const epoch = operationId.current; perform(create.practice ? 'Building your practice quiz…' : 'Building your learning path…', async () => { const course = await api<Course>('/courses', 'POST', { topic: create.topic.trim(), practice: create.practice }); if (epoch !== operationId.current) return; setCourses(paths => [course, ...paths]); setCreate(null); navigate('mission', course.id); }); }}><label htmlFor="new-topic">Your topic</label><input id="new-topic" required minLength={2} maxLength={300} autoFocus placeholder="e.g. Sentences, fractions, Python loops" value={create.topic} onChange={event => setCreate({ ...create, topic: event.target.value })} disabled={!!busy}/>{!credential.configured && <div className="context-note">{credential.demo_mode ? <>The free local demo covers <button type="button" className="inline-link" onClick={() => setCreate({ ...create, topic: 'sentences' })}>sentences</button> and paragraphs. Connect a model in Settings for other topics.</> : <>Connect a model in Settings before creating a path.</>}</div>}{error && <Alert error>{error}</Alert>}<Button className="full-width" type="submit" disabled={!!busy || (!credential.configured && !credential.demo_mode)}>{busy || (create.practice ? 'Create practice quiz' : 'Build my learning path')}<ArrowRight size={17} aria-hidden="true"/></Button>{!credential.configured && <Button className="full-width" variant="ghost" disabled={!!busy} onClick={() => { setCreate(null); navigate('settings'); }}>Set up an AI connection</Button>}{busy && <p className="generation-note" role="status">Good lessons take a moment. Keep this window open while we build yours.</p>}</form></Modal>}
  {busy && !auth && !create && <div className="action-status" role="status"><span className="loading-dot"/>{busy}</div>}
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
