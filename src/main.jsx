import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { CometChatUIKit, CometChatProvider, CometChatErrorBoundary, CometChatMessageList, CometChatMessageComposer } from '@cometchat/chat-uikit-react';
import '@cometchat/chat-uikit-react/styles';
import QRCode from 'qrcode';
import {
  ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, Copy, Info, Link2,
  MapPin, Plus, Printer, ScanLine, Send, ShieldCheck, Wrench, X
} from 'lucide-react';
import './style.css';
import './dark.css';

const ACTORS = [
  { name: 'Maya', uid: 'relaytag_maya', initials: 'MA', color: 'plum', role: 'Workshop steward' },
  { name: 'Leo', uid: 'relaytag_leo', initials: 'LE', color: 'blue', role: 'Current borrower' },
  { name: 'Nina', uid: 'relaytag_nina', initials: 'NI', color: 'gold', role: 'Next borrower' }
];
const appId = import.meta.env.VITE_COMETCHAT_APP_ID;
const region = import.meta.env.VITE_COMETCHAT_REGION;
const authKey = import.meta.env.VITE_COMETCHAT_AUTH_KEY;
const serverAuth = import.meta.env.VITE_COMETCHAT_SERVER_AUTH === 'true';
const liveConfigured = Boolean(appId && region && (authKey || serverAuth));
let initPromise;
let sessionPromise = Promise.resolve();

async function connectChat(actor, guid, name) {
  if (!initPromise) {
    initPromise = CometChatUIKit.initFromSettings({
      appId, region,
      ...(authKey ? { credentials: { authKey } } : {}),
      chatSDK: { presenceSubscription: { type: 'ALL_USERS' } }
    }).catch(error => { initPromise = null; throw error; });
  }
  await initPromise;
  const run = sessionPromise.then(async () => {
    const existing = CometChatUIKit.getLoggedInUser();
    if (existing?.getUid?.() !== actor.uid) {
      if (existing) await CometChatUIKit.logout();
      if (serverAuth) {
        const { authToken } = await api('/api/chat/token', { method: 'POST', body: JSON.stringify({ actor: actor.name }) });
        await CometChatUIKit.loginWithAuthToken(authToken);
      } else {
        try {
          const user = new CometChat.User(actor.uid);
          user.setName(actor.name);
          await CometChatUIKit.createUser(user);
        } catch (error) {
          const text = String(error?.code || error?.message || '').toLowerCase();
          if (!text.includes('already') && !text.includes('exist')) throw error;
        }
        await CometChatUIKit.login(actor.uid);
      }
    }
    let group;
    try {
      group = await CometChat.getGroup(guid);
    } catch (error) {
      const text = String(error?.code || error?.message || '').toLowerCase();
      if (!text.includes('not') && !text.includes('404')) throw error;
      try {
        group = await CometChat.createGroup(new CometChat.Group(guid, name, CometChat.GROUP_TYPE.PUBLIC, ''));
      } catch (createError) {
        group = await CometChat.getGroup(guid);
      }
    }
    if (!group.getHasJoined?.()) group = await CometChat.joinGroup(guid, CometChat.GROUP_TYPE.PUBLIC, '');
    return group;
  });
  sessionPromise = run.catch(() => {});
  return run;
}

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
  });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || 'Request failed.'); error.status = response.status; throw error; }
  return data;
}

function relativeDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Avatar({ actor, small = false }) {
  return <span className={`avatar avatar-${actor?.color || 'plum'} ${small ? 'avatar-small' : ''}`} title={actor?.name}>{actor?.initials || 'RT'}</span>;
}

function Modal({ title, subtitle, onClose, children }) {
  const dialog = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const preferred = dialog.current?.querySelector('[autofocus]');
    (preferred || dialog.current)?.focus();
    const onKey = event => { if (event.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={dialog}>
      <button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={20}/></button>
      <h2>{title}</h2><p className="muted">{subtitle}</p>{children}
    </div>
  </div>;
}

function LiveChat({ actor, guid, name }) {
  const [state, setState] = useState({ phase: 'connecting', group: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ phase: 'connecting', group: null, error: '' });
    connectChat(actor, guid, name).then(group => {
      if (active) setState({ phase: 'ready', group, error: '' });
    }).catch(error => {
      if (active) setState({ phase: 'error', group: null, error: error?.message || error?.code || 'Could not connect to CometChat.' });
    });
    return () => { active = false; };
  }, [actor, guid, name, attempt]);
  if (state.phase === 'connecting') return <div className="chat-state"><span className="spinner"/><strong>Connecting to the object conversation…</strong><p>Signing in as {actor.name}.</p></div>;
  if (state.phase === 'error') return <div className="chat-state chat-error"><Info size={28}/><strong>Live chat could not connect</strong><p>{state.error}</p><button className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>;
  return <CometChatErrorBoundary>
    <CometChatProvider theme="dark">
      <div className="cometchat-host"><div className="cometchat-feed"><CometChatMessageList group={state.group} hideReplyInThreadOption hideDateSeparator hideReactionOption /></div><div className="cometchat-compose"><CometChatMessageComposer group={state.group} placeholder="Write a message…" hideVoiceRecordingButton hideEmojiKeyboardButton hideStickersButton /></div></div>
    </CometChatProvider>
  </CometChatErrorBoundary>;
}

function PreviewChat({ messages, actor, onSend, busy }) {
  const [draft, setDraft] = useState('');
  const feed = useRef(null);
  useEffect(() => { if (feed.current) feed.current.scrollTop = feed.current.scrollHeight; }, [messages.length]);
  async function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    try { await onSend(text); setDraft(''); } catch { /* parent displays error */ }
  }
  return <div className="preview-chat">
    <div className="preview-messages" ref={feed}>
      <div className="date-line"><span>WORKSHOP CONVERSATION</span></div>
      {messages.map(message => {
        const sender = ACTORS.find(a => a.name === message.author);
        const own = message.author === actor.name;
        return <div className={`message-row ${own ? 'mine' : ''}`} key={message.id}>
          {!own && <Avatar actor={sender} small />}
          <div><div className="message-meta">{message.author} <span>· {new Date(message.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span></div><div className="message-bubble">{message.text}</div></div>
        </div>;
      })}
    </div>
    <form className="preview-composer" onSubmit={submit}><input aria-label="Message" placeholder="Share what you know about this object…" value={draft} onChange={event => setDraft(event.target.value)} maxLength={1000}/><button type="submit" aria-label="Send message" disabled={!draft.trim() || busy}><Send size={19}/></button></form>
  </div>;
}

function App() {
  const params = new URLSearchParams(location.search);
  const initialActor = ACTORS.find(a => a.name.toLowerCase() === params.get('as')?.toLowerCase()) || ACTORS[1];
  const [selectedId, setSelectedId] = useState(params.get('object') || 'machine-04');
  const [actor, setActor] = useState(initialActor);
  const [item, setItem] = useState(null);
  const [items, setItems] = useState([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmingNote, setConfirmingNote] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [qr, setQr] = useState('');
  const [toast, setToast] = useState('');
  const chatRef = useRef(null);

  async function refresh(silent = false) {
    try {
      const [found, list] = await Promise.all([api(`/api/items/${selectedId}`), api('/api/items')]);
      setItem(found); setItems(list);
      if (!silent) setError('');
    }
    catch (err) {
      if (err.status === 404 && selectedId !== 'machine-04') {
        setSelectedId('machine-04'); setToast('That object was not found; showing the sample object');
      } else if (!silent) setError(err.message);
    }
  }
  useEffect(() => { setItem(null); refresh(); const timer = setInterval(() => refresh(true), 3500); return () => clearInterval(timer); }, [selectedId]);
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('as', actor.name.toLowerCase());
    url.searchParams.set('object', selectedId);
    history.replaceState({}, '', url);
  }, [actor, selectedId]);
  const shareUrl = `${location.origin}${location.pathname}?object=${encodeURIComponent(selectedId)}&as=nina`;
  useEffect(() => {
    QRCode.toDataURL(shareUrl, { width: 260, margin: 1, color: { dark: '#183e35', light: '#fffefa' } }).then(setQr).catch(() => {});
  }, [shareUrl]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer); }, [toast]);

  const openIssues = item?.issues.filter(issue => issue.status === 'open') || [];
  async function createItem(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const created = await api('/api/items', { method: 'POST', body: JSON.stringify({ name: form.get('name'), location: form.get('location'), description: form.get('description'), category: form.get('category'), custodian: actor.name }) });
      setSelectedId(created.id); setLibraryOpen(false); setModal(null); setToast('Object added to the workshop');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); setToast('Object link copied'); }
    catch { setToast('Could not copy — use the address bar instead'); }
  }
  async function sendPreview(text) {
    setBusy(true);
    try { await api(`/api/items/${item.id}/preview-messages`, { method: 'POST', body: JSON.stringify({ text, author: actor.name }) }); await refresh(true); }
    catch (err) { setError(err.message); throw err; }
    finally { setBusy(false); }
  }
  async function reportIssue(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api(`/api/items/${item.id}/issues`, { method: 'POST', body: JSON.stringify({ title: form.get('title'), detail: form.get('detail'), author: actor.name }) });
      await refresh(true); setModal(null); setToast('Issue added to this object');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function resolveIssue(event, issue) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api(`/api/items/${item.id}/issues/${issue.id}/resolve`, { method: 'POST', body: JSON.stringify({ summary: form.get('summary'), author: actor.name }) });
      await refresh(true); setModal(null); setToast('Resolved — the next borrower can see your handoff');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function confirmNote(note) {
    if (confirmingNote) return;
    setConfirmingNote(note.id);
    try {
      await api(`/api/items/${item.id}/notes/${note.id}/confirm`, { method: 'POST', body: JSON.stringify({ author: actor.name }) });
      await refresh(true);
      setToast('Thanks — this tip has been checked by another borrower');
    } catch (err) { setError(err.message); }
    finally { setConfirmingNote(null); }
  }

  return <div className="app-shell">
    <header className="simple-header">
      <div className="header-inner">
        <a className="simple-brand" href="/"><span className="simple-brand-mark"><ScanLine size={18}/></span>RelayTag</a>
        <button className="header-object-button" onClick={() => setLibraryOpen(true)}>Objects <ChevronDown size={15}/></button>
        <div className="header-spacer"/>
        <span className="workspace-name">Morrow Workshop</span>
        <div className="profile-wrap"><button className="profile" onClick={() => setProfileOpen(value => !value)} aria-expanded={profileOpen}><Avatar actor={actor} small/><span>{actor.name}</span><ChevronDown size={15}/></button>{profileOpen && <div className="profile-menu"><div className="menu-label">VIEW AS</div>{ACTORS.map(option => <button key={option.uid} onClick={() => { setActor(option); setProfileOpen(false); }}><Avatar actor={option} small/><span>{option.name}<small>{option.role}</small></span>{option.uid === actor.uid && <Check size={16}/>}</button>)}</div>}</div>
      </div>
    </header>

    <main className="simple-main">
      {error && <div className="error-banner" role="alert"><Info size={17}/>{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}

      <div className="object-intro">
        <div className="object-label">SHARED OBJECT <span>·</span> {item?.tag || 'LOADING'}</div>
        <div className="object-heading"><div><h1>{item?.name || 'Loading object…'}</h1><p>{item?.description}</p></div><span className={`state-badge ${openIssues.length ? 'needs-care' : 'ready'}`}>{openIssues.length ? 'Needs care' : 'Ready to use'}</span></div>
        <div className="object-location"><MapPin size={16}/>{item?.location || 'Workshop'}</div>
        <div className="object-actions"><button className="button button-primary" onClick={() => setModal('qr')}><ScanLine size={17}/> View QR tag</button><button className="button button-secondary" onClick={copyLink}><Link2 size={17}/> Copy link</button><a href="#conversation" className="plain-link">Jump to conversation <ArrowRight size={15}/></a></div>
      </div>

      <section className="simple-section" id="condition">
        <div className="simple-section-heading"><div><h2>Current condition</h2><p>{openIssues.length ? `${openIssues.length} open issue${openIssues.length === 1 ? '' : 's'}` : 'No open issues'}</p></div><button className="button button-secondary" onClick={() => setModal('report')}><Plus size={16}/> Report issue</button></div>
        {openIssues.length ? <div className="issue-list">{openIssues.map(issue => <article className="simple-issue" key={issue.id}><div className="issue-dot"/><div className="issue-copy"><h3>{issue.title}</h3><p>{issue.detail}</p><small>Reported by {issue.author} · {relativeDate(issue.createdAt)}</small></div><button className="button button-primary" onClick={() => setModal({ type: 'resolve', issue })}>Resolve <ArrowRight size={15}/></button></article>)}</div> : <div className="simple-empty"><CheckCircle2 size={20}/> This object is ready for the next person.</div>}
      </section>

      <section className="simple-section" id="notes">
        <div className="simple-section-heading"><div><h2>Handoff notes</h2><p>What people learned while using this object.</p></div></div>
        <div className="notes-list">{item?.notes.length ? item.notes.map(note => <article className="simple-note" key={note.id}><p>{note.text}</p><div className="note-meta"><span>{note.author} · {relativeDate(note.createdAt)}</span>{note.sourceIssueId && <span>From a resolved issue</span>}</div><div className="note-check"><span><ShieldCheck size={15}/>{note.confirmedBy?.length ? `Checked by ${note.confirmedBy.join(', ')}` : 'Not checked by another borrower yet'}</span>{note.author !== actor.name && !note.confirmedBy?.includes(actor.name) && <button onClick={() => confirmNote(note)} disabled={Boolean(confirmingNote)}>This worked for me</button>}</div></article>) : <div className="simple-empty">No handoff notes yet. Resolve an issue to leave one.</div>}</div>
      </section>

      <section className="simple-section" id="conversation" ref={chatRef}>
        <div className="simple-section-heading"><div><h2>Conversation</h2><p>Ask the people who use this object.</p></div><span className={`connection-badge ${liveConfigured ? 'live' : ''}`}><span/>{liveConfigured ? 'Live chat' : 'Preview'}</span></div>
        <div className="conversation-card"><div className="chat-topbar"><span className="chat-mark">#</span><div><strong>{item?.name || 'Object chat'}</strong><small>Shared object conversation</small></div><span className="chat-member">Viewing as {actor.name}</span></div>{item && (liveConfigured ? <LiveChat actor={actor} guid={item.chatGuid} name={item.name}/> : <PreviewChat messages={item.previewMessages || []} actor={actor} onSend={sendPreview} busy={busy}/>)}</div>
      </section>

      {!!item?.issues.some(issue => issue.status === 'resolved') && <details className="past-issues"><summary>Past issues <span>{item.issues.filter(issue => issue.status === 'resolved').length}</span></summary><div>{item.issues.filter(issue => issue.status === 'resolved').map(issue => <div className="past-issue" key={issue.id}><strong>{issue.title}</strong><small>Resolved by {issue.resolvedBy} · {relativeDate(issue.resolvedAt)}</small></div>)}</div></details>}
      <footer className="simple-footer">RelayTag · Useful knowledge stays with the object.</footer>
    </main>

    {libraryOpen && <div className="library-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setLibraryOpen(false); }}><div className="library-panel" role="dialog" aria-modal="true" aria-label="Object library"><div className="library-head"><div><div className="eyebrow">MORROW WORKSHOP</div><h2>Object library</h2><p>Select an object or add one.</p></div><button className="icon-button" onClick={() => setLibraryOpen(false)} aria-label="Close object library"><X size={20}/></button></div><button className="button button-primary library-add" onClick={() => { setLibraryOpen(false); setModal('create'); }}><Plus size={17}/> Add a shared object</button><div className="library-items">{items.map(entry => <button className={`library-item ${entry.id === selectedId ? 'current' : ''}`} key={entry.id} onClick={() => { setSelectedId(entry.id); setLibraryOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><span className="library-item-icon"><Wrench size={20}/></span><span><strong>{entry.name}</strong><small>{entry.location} · {entry.tag}</small></span><span className={`library-item-status ${entry.issues.some(issue => issue.status === 'open') ? 'attention' : ''}`}>{entry.issues.some(issue => issue.status === 'open') ? 'Needs care' : 'Ready'}</span><ArrowRight size={17}/></button>)}</div></div></div>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={17}/>{toast}</div>}
    {modal === 'create' && <Modal title="Add a shared object" subtitle="Give it a name and a home. RelayTag will create its profile and scannable tag." onClose={() => setModal(null)}><form onSubmit={createItem} className="modal-form"><label>Object name<input name="name" placeholder="e.g. Workshop projector" maxLength={80} required autoFocus/></label><label>Category<select name="category" defaultValue="Shared equipment"><option>Shared equipment</option><option>Workshop tool</option><option>Creative gear</option><option>Other</option></select></label><label>Where does it live?<input name="location" placeholder="e.g. Shelf C / Media room" maxLength={100} required/></label><label>What should people know?<textarea name="description" placeholder="A short introduction for the next person…" maxLength={300} rows={3} required/></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={busy}>Create object <ArrowRight size={17}/></button></div></form></Modal>}
    {modal === 'report' && <Modal title="Report an issue" subtitle="Give the next person a clear picture. You can work through it together in the conversation." onClose={() => setModal(null)}><form onSubmit={reportIssue} className="modal-form"><label>What happened?<input name="title" placeholder="e.g. The needle keeps snagging" maxLength={90} required autoFocus/></label><label>Tell us a little more<textarea name="detail" placeholder="What were you doing when it happened? What have you tried?" maxLength={500} rows={4} required/></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={busy}>Add issue <ArrowRight size={17}/></button></div></form></Modal>}
    {modal?.type === 'resolve' && <Modal title="Pass the fix forward" subtitle={`You’re resolving “${modal.issue.title}”. Your answer will become a permanent handoff note.`} onClose={() => setModal(null)}><form onSubmit={event => resolveIssue(event, modal.issue)} className="modal-form"><label>What solved it?<textarea name="summary" placeholder="Write the tip you wish you'd had when you started…" maxLength={500} rows={5} required autoFocus/></label><div className="modal-hint"><BookOpen size={17}/> This note will appear under Handoff notes for the next borrower.</div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={busy}>Resolve & save note <Check size={17}/></button></div></form></Modal>}
    {modal === 'qr' && <Modal title="Give this object a voice" subtitle="Print or share this tag so its story is always one scan away." onClose={() => setModal(null)}><div className="qr-modal-content">{qr && <img src={qr} alt="Scannable QR code linking to this object"/>}<div><span className="category">OBJECT TAG · {item?.tag}</span><h3>{item?.name}</h3><p>{shareUrl}</p><div className="tag-actions"><button className="button button-primary" onClick={() => window.print()}><Printer size={17}/> Print tag</button><button className="button button-secondary" onClick={copyLink}><Copy size={17}/> Copy link</button></div></div></div>{['127.0.0.1', 'localhost'].includes(location.hostname) && <p className="local-tag-hint"><Info size={15}/> This local QR code opens on this computer. Publish the app before printing a tag for phone scanning.</p>}<div className="print-tag" id="print-tag"><div className="print-tag-brand">relay<span>tag</span></div><div className="print-tag-kicker">THIS OBJECT HAS A STORY</div><h2>{item?.name}</h2><p>{item?.location} · {item?.tag}</p>{qr && <img src={qr} alt="Scannable QR code linking to this object"/>}<strong>Scan for its condition, conversation, and handoff notes.</strong><small>{shareUrl}</small></div></Modal>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
