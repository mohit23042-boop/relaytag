import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { CometChatUIKit, CometChatProvider, CometChatErrorBoundary, CometChatIncomingCall, CometChatCallButtons, CometChatMessageList, CometChatMessageComposer } from '@cometchat/chat-uikit-react';
import '@cometchat/chat-uikit-react/styles';
import { Car, Shield, Flag, ArrowRight, Copy, Check, MessageCircle, Radio, RotateCcw, X, Trophy, CircleHelp, Play, MapPin } from 'lucide-react';
import './style.css';
import './compact.css';

const CHARACTERS = [
  { slot: 'leo', name: 'Leo', actor: 'Leo', uid: 'relaytag_leo', role: 'driver', color: '#ffc857', subtitle: 'The amber roadster' },
  { slot: 'nina', name: 'Nina', actor: 'Nina', uid: 'relaytag_nina', role: 'driver', color: '#82dad3', subtitle: 'The mint hatchback' },
  { slot: 'maya', name: 'Maya', actor: 'Maya', uid: 'relaytag_maya', role: 'police', color: '#88a8ff', subtitle: 'The roadside officer' }
];
const api = async (path, body, session) => {
  const res = await fetch(`/game-api${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Could not reach the race.'); return data;
};
let initPromise;
async function connect(session) {
  const character = CHARACTERS.find(c => c.slot === session.slot);
  const serverAuth = import.meta.env.VITE_COMETCHAT_SERVER_AUTH === 'true';
  if (!initPromise) initPromise = CometChatUIKit.initFromSettings({
    appId: import.meta.env.VITE_COMETCHAT_APP_ID, region: import.meta.env.VITE_COMETCHAT_REGION,
    ...(!serverAuth && import.meta.env.VITE_COMETCHAT_AUTH_KEY ? { credentials: { authKey: import.meta.env.VITE_COMETCHAT_AUTH_KEY } } : {}),
    chatSDK: { presenceSubscription: { type: 'ALL_USERS' } }, uiKit: { callsSDK: {} }
  }).catch(e => { initPromise = null; throw e; });
  await initPromise;
  const existing = CometChatUIKit.getLoggedInUser();
  if (existing?.getUid() !== character.uid) {
    if (existing) await CometChatUIKit.logout();
    if (serverAuth) {
      const res = await fetch('/api/chat/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: character.actor }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Chat login failed.'); await CometChatUIKit.loginWithAuthToken(data.authToken);
    } else {
      try { await CometChatUIKit.login(character.uid); }
      catch (e) {
        if (!String(e.message || e.code || '').toLowerCase().match(/not exist|not found|uid_not_found/)) throw e;
        const user = new CometChat.User(character.uid); user.setName(character.actor);
        await CometChatUIKit.createUser(user); await CometChatUIKit.login(character.uid);
      }
    }
  }
  const guid = `roadquest_${session.code.toLowerCase()}`;
  let group;
  try { group = await CometChat.getGroup(guid); }
  catch { try { group = await CometChat.createGroup(new CometChat.Group(guid, `RoadQuest ${session.code}`, CometChat.GROUP_TYPE.PUBLIC, '')); } catch { group = await CometChat.getGroup(guid); } }
  if (!group.getHasJoined()) group = await CometChat.joinGroup(guid, CometChat.GROUP_TYPE.PUBLIC, '');
  return group;
}
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function RoadCar({ color, police = false }) {
  return <g><ellipse cx="0" cy="4" rx="27" ry="17" fill="#07110b" opacity=".3"/><rect x="-20" y="-13" width="40" height="26" rx="7" fill={color} stroke="#172823" strokeWidth="2"/><rect x="-9" y="-10" width="16" height="20" rx="4" fill="#2b4543"/><path d="M8 -9L13 -7V7L8 9Z" fill="#b0d1bf"/><path d="M-10 -9L-14 -7V7L-10 9Z" fill="#8ab0a8"/><rect x="13" y="-11" width="4" height="5" fill="#fff5bd"/><rect x="13" y="6" width="4" height="5" fill="#fff5bd"/><rect x="-17" y="-15" width="8" height="3" rx="1" fill="#16221d"/><rect x="8" y="-15" width="8" height="3" rx="1" fill="#16221d"/><rect x="-17" y="12" width="8" height="3" rx="1" fill="#16221d"/><rect x="8" y="12" width="8" height="3" rx="1" fill="#16221d"/>{police && <><rect x="-4" y="-7" width="5" height="14" fill="#fff"/><rect x="-4" y="-7" width="5" height="7" fill="#e75959"/><rect x="-4" y="0" width="5" height="7" fill="#77a4ff"/></>}</g>;
}
function World({ state, me }) {
  const cities = state.cities, roads = state.roads;
  return <svg className="world" viewBox="0 0 1180 780" role="img" aria-label="Four cities connected by six roads. Live cars and traffic signals.">
    <defs><pattern id="grass" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M7 9l3 -3m18 22l3 -4" stroke="#678668" strokeWidth="2" opacity=".3"/></pattern><pattern id="water" width="70" height="35" patternUnits="userSpaceOnUse"><path d="M8 14h17m28 13h9" stroke="#c5ece0" strokeWidth="2" opacity=".25"/></pattern></defs>
    <rect width="1180" height="780" fill="#506e51"/><rect width="1180" height="780" fill="url(#grass)"/>
    <path d="M1180 0H780Q720 110 790 240T1150 300L1180 320Z" fill="#468c93"/><path d="M1180 0H780Q720 110 790 240T1150 300L1180 320Z" fill="url(#water)"/>
    <path d="M755 670l75-140 50 78 58-119 120 181" fill="#7c8c6f"/><path d="M830 530l25 42-39-15Z M938 489l37 60-56-24Z" fill="#c9d0b4"/>
    {[...Array(36)].map((_, i) => { const x = 55 + i * 137 % 1060, y = 65 + i * 211 % 650; return <g key={i} transform={`translate(${x} ${y})`}><ellipse cy="11" rx="13" ry="5" fill="#244d38" opacity=".3"/><rect x="-2" y="2" width="4" height="14" fill="#725741"/><path d="M0 -19l-15 23h30Z M0 -9l-17 22h34Z" fill={i % 2 ? '#2f5b3e' : '#376848'}/></g>; })}
    {roads.map(r => { const a = cities.find(c => c.id === r.a), b = cities.find(c => c.id === r.b), angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; return <g key={r.id}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#304b39" strokeWidth="71"/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c7c4aa" strokeWidth="60"/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#515951" strokeWidth="52"/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#dedcb5" strokeWidth="2" strokeDasharray={r.rule === 'oneway' ? '0' : '13 15'}/>
      <g transform={`translate(${a.x + (b.x - a.x) * .32} ${a.y + (b.y - a.y) * .32}) rotate(${angle})`}><rect x="-14" y="-58" width="28" height="30" rx="4" fill="#f9f1d6" stroke="#e66d4f" strokeWidth="3"/><text x="0" y="-38" textAnchor="middle" fontSize="16" fontWeight="900" fill="#343e35" transform={`rotate(${-angle} 0 -44)`}>{r.limit}</text></g>
      {r.rule === 'signal' && <g transform={`translate(${a.x + (b.x - a.x) * .48} ${a.y + (b.y - a.y) * .48}) rotate(${angle})`}><line y1="-24" y2="24" stroke="#fff7d6" strokeWidth="4"/><rect x="-13" y="-66" width="26" height="36" rx="5" fill="#26382e"/><circle cy="-55" r="7" fill={state.signal === 'red' ? '#ff7165' : '#623d37'}/><circle cy="-40" r="7" fill={state.signal === 'green' ? '#b5e28a' : '#3e5340'}/></g>}
      {r.rule === 'stop' && <g transform={`translate(${a.x + (b.x - a.x) * .44} ${a.y + (b.y - a.y) * .44}) rotate(${angle})`}><line y1="-24" y2="24" stroke="#fff7d6" strokeWidth="4"/><path d="M-8 -62h16l10 10v16l-10 10H-8l-10-10v-16Z" fill="#cf594e" stroke="#ffdfbf" strokeWidth="2"/><text y="-41" textAnchor="middle" fontSize="9" fontWeight="900" fill="white">STOP</text></g>}
      {r.rule === 'oneway' && <g transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2}) rotate(${angle})`}><path d="M-18 0h36m-10-10l10 10-10 10" fill="none" stroke="#faf1bb" strokeWidth="5"/></g>}
    </g>; })}
    {cities.map((c, i) => <g key={c.id} transform={`translate(${c.x} ${c.y})`}>
      <circle r="62" fill="#747664" stroke={me?.visited.includes(c.id) ? '#ffe089' : '#b3b49b'} strokeWidth="5"/>
      {[0,1,2].map(j => <g key={j} transform={`translate(${-50 + j * 34} ${i % 2 ? 49 : -80})`}><rect width="27" height={28 + j * 8} fill={c.color} stroke="#465244" strokeWidth="2"/><path d="M-3 0l16 -13L30 0Z" fill={i % 2 ? '#7e634e' : '#5d6c68'}/><rect x="6" y="8" width="5" height="7" fill="#f5e5ae"/><rect x="16" y="8" width="5" height="7" fill="#f5e5ae"/></g>)}
      <rect x="-72" y={i % 2 ? 100 : -124} width="144" height="31" rx="7" fill="#203b2e"/><text textAnchor="middle" y={i % 2 ? 121 : -103} fontSize="16" fontWeight="800" fill="#f8eed0">{c.name}</text>
      <circle r="8" fill="#d7d6b1"/>{me?.visited.includes(c.id) && <g transform="translate(43 -40)"><circle r="13" fill="#ffe089"/><path d="M-6 0l4 4 8-9" fill="none" stroke="#304634" strokeWidth="3"/></g>}
    </g>)}
    {state.players.filter(p => p.role === 'driver').map((p, i) => <g key={p.slot} className="car-position" transform={`translate(${p.position.x + (p.road ? 0 : i * 36 - 18)} ${p.position.y})`}>
      <g transform={`rotate(${p.position.angle})`}><RoadCar color={p.color}/></g>
      <rect x="-36" y="-45" width="72" height="22" rx="6" fill="#152c20" opacity=".9"/><text textAnchor="middle" y="-29" fontSize="12" fontWeight="800" fill="white">{p.name}</text>
      {p.status === 'detained' && <g transform="translate(12 53)"><RoadCar color="#86a0c1" police/><text textAnchor="middle" y="34" fontSize="11" fill="#fff4db" fontWeight="800">POLICE</text></g>}
    </g>)}
    <g transform="translate(580 725)"><rect x="-140" y="-18" width="280" height="36" rx="18" fill="#2d4837"/><text textAnchor="middle" y="5" fontSize="13" fill="#f1e9c7" fontWeight="800">FOUR CITIES. ONE CLEAN CIRCUIT.</text></g>
  </svg>;
}
function Welcome({ join, busy, error }) {
  const [slot, setSlot] = useState('leo'), [name, setName] = useState('Leo'), [code, setCode] = useState(new URLSearchParams(location.search).get('room') || '');
  return <main className="welcome"><div className="welcome-copy"><span className="eyebrow"><span className="live-dot"/> MULTIPLAYER · POWERED BY COMETCHAT</span><h1>Drive clean.<br/><em>Make your case.</em></h1><p>Four cities. A few tempting shortcuts. And a real officer waiting when you break the rules.</p><div className="steps"><span><Flag size={18}/> Visit every city</span><span><Car size={18}/> Keep violations low</span><span><MessageCircle size={18}/> Talk your way through a ticket</span></div><div className="welcome-illustration"><svg viewBox="0 0 520 130"><path d="M0 70h520" stroke="#586456" strokeWidth="56"/><path d="M0 70h520" stroke="#d6cfab" strokeWidth="2" strokeDasharray="18 16"/><g transform="translate(150 70) scale(1.6)"><RoadCar color="#ffc857"/></g><g transform="translate(300 70) scale(1.6)"><RoadCar color="#88a8ff" police/></g><rect x="400" y="18" width="28" height="44" rx="5" fill="#2a392e"/><circle cx="414" cy="30" r="7" fill="#e96a5c"/><circle cx="414" cy="49" r="7" fill="#93cc7e"/></svg></div></div>
    <form className="join-card" onSubmit={e => { e.preventDefault(); join({ create: !code.trim(), code, slot, name }); }}><span className="eyebrow">PICK YOUR CHARACTER</span><div className="characters">{CHARACTERS.map(c => <button key={c.slot} type="button" className={`character ${slot === c.slot ? 'selected' : ''}`} onClick={() => { setSlot(c.slot); setName(c.name); }}><span className="character-icon" style={{ color: c.color }}>{c.role === 'police' ? <Shield/> : <Car/>}</span><span><strong>{c.name}</strong><small>{c.subtitle}</small></span>{slot === c.slot && <Check size={18}/>}</button>)}</div><label>Your display name<input value={name} onChange={e => setName(e.target.value)} required maxLength={22}/></label><label>Room code <span>leave empty to create a race</span><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. A4F29C" maxLength={6}/></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary wide" disabled={busy}>{busy ? 'Joining…' : code.trim() ? 'Join race' : 'Create race'} <ArrowRight size={18}/></button><p className="fineprint">Use separate browsers or Incognito for different characters. All fines use fictional game credits.</p></form>
  </main>;
}
function App() {
  const [session, setSession] = useState(() => { try { const s = JSON.parse(sessionStorage.getItem('rq-session')); const code = new URLSearchParams(location.search).get('room'); return !code || code === s?.code ? s : null; } catch { return null; } });
  const [state, setState] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [group, setGroup] = useState(null), [chatError, setChatError] = useState(''), [chatRetry, setChatRetry] = useState(0), [peer, setPeer] = useState(null), [selectedCase, setSelectedCase] = useState(null), [copied, setCopied] = useState(false), [rules, setRules] = useState(false);
  const input = useRef({ gas: false, brake: false }), inputInFlight = useRef(false);
  const me = state?.players.find(p => p.slot === session?.slot), isPolice = me?.role === 'police', myTicket = state?.cases.find(c => c.id === me?.caseId), selectedTicket = state?.cases.find(c => c.id === selectedCase), ticket = isPolice ? selectedTicket : myTicket || selectedTicket;
  useEffect(() => {
    if (!session) return;
    let active = true, inflight = false;
    const poll = async () => { if (inflight) return; inflight = true; try { const s = await api(`/${session.code}`, undefined, session); if (active) setState(s); } catch (e) { if (active) setError(e.message); } finally { inflight = false; } };
    poll(); const timer = setInterval(poll, 220); return () => { active = false; clearInterval(timer); };
  }, [session]);
  useEffect(() => {
    if (!session) return;
    let active = true; setGroup(null); setChatError('');
    connect(session).then(g => { if (active) setGroup(g); }).catch(e => { if (active) setChatError(e.message || 'CometChat could not connect.'); });
    return () => { active = false; };
  }, [session, chatRetry]);
  useEffect(() => {
    if (!session || isPolice) return;
    const send = async () => { if (inputInFlight.current) return; inputInFlight.current = true; try { await api(`/${session.code}/input`, input.current, session); } catch {} finally { inputInFlight.current = false; } };
    const editable = e => e.target?.closest?.('input,textarea,[contenteditable="true"]');
    const down = e => { if (editable(e)) return; if (['ArrowUp', 'w', 'W', 'ArrowDown', 's', 'S', ' '].includes(e.key)) { e.preventDefault(); if (['ArrowUp','w','W'].includes(e.key)) input.current.gas = true; else input.current.brake = true; send(); } };
    const up = e => { if (['ArrowUp','w','W'].includes(e.key)) input.current.gas = false; if (['ArrowDown','s','S',' '].includes(e.key)) input.current.brake = false; send(); };
    const stop = () => { input.current = { gas: false, brake: true }; send(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', stop);
    const timer = setInterval(send, 180);
    return () => { clearInterval(timer); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', stop); input.current = { gas: false, brake: false }; };
  }, [session, isPolice]);
  useEffect(() => { if (me?.status !== 'driving') input.current = { gas: false, brake: false }; }, [me?.status]);
  async function join(body) { setBusy(true); setError(''); try { const result = await api('/join', body); const s = { code: result.code, slot: result.slot, token: result.token }; sessionStorage.setItem('rq-session', JSON.stringify(s)); history.replaceState({}, '', `${location.pathname}?room=${s.code}`); setState(result.state); setSession(s); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function action(path, body) { if (busy) return; setBusy(true); try { setState(await api(`/${session.code}${path}`, body, session)); setError(''); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function talk(caseItem) { setSelectedCase(caseItem.id); setChatError(''); const target = isPolice ? state.players.find(p => p.slot === caseItem.slot) : state.players.find(p => p.role === 'police'); if (!target) { setChatError('No officer has joined yet. Share the room code with a friend, or pay the ticket to continue.'); return; } try { setPeer(await CometChat.getUser(target.uid)); } catch (e) { setChatError(e.message || 'Chat is connecting. Try again in a moment.'); } }
  function newRace() { if (session) api(`/${session.code}/leave`, {}, session).catch(() => {}); sessionStorage.removeItem('rq-session'); setSession(null); setState(null); setPeer(null); setSelectedCase(null); setGroup(null); setError(''); history.replaceState({}, '', location.pathname); }
  const currentRoad = state?.roads.find(r => r.id === me?.road);
  const remaining = state?.endsAt ? Math.max(0, (state.endsAt - state.now) / 1000) : 240;
  const setPedal = (pedal, pressed) => { input.current = { ...input.current, [pedal]: pressed }; if (session) api(`/${session.code}/input`, input.current, session).catch(() => {}); };
  const screen = <div className="rq-app"><header className="topbar"><a className="brand" href="/roadquest/"><span><Car size={21}/></span>ROAD<span className="brand-light">QUEST</span></a><span className="tagline">A clean drive wins.</span><div className="top-actions">{session && <button className="room-code" onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${session.code}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError(`Share this room code: ${session.code}`); } }}>{copied ? <Check size={15}/> : <Copy size={15}/>} ROOM {session.code}</button>}<button className="icon-button" aria-label="Game rules" onClick={() => setRules(!rules)}><CircleHelp size={20}/></button>{session && <button className="subtle" onClick={newRace}>New race</button>}</div></header>
    {rules && <div className="rules-panel"><button className="icon-button" onClick={() => setRules(false)} aria-label="Close rules"><X/></button><strong>Four cities. Fewest violations.</strong><p>Choose a road at each city. Hold W / ↑ to accelerate; S / ↓ / Space to brake. Stay within the signed speed limit. Stop before the red signal. At STOP roads, brake and hold still in the approach zone just before the marked stop line for one second. The dashboard shows the line location. The shortcut goes Old Quarter → Harbor Bay only.</p><p>Tickets pull your car over. Pay with game credits, or chat/call the real officer and ask for your one warning. A warning waives the fine; the violation still counts. Finish every city to qualify. Tie-break: active driving time, excluding police stops.</p></div>}
    {!session ? <Welcome join={join} busy={busy} error={error}/> : !state || !me ? <div className="loading"><Radio/> Connecting to race… {error && <><p className="error">{error}</p><button className="primary" onClick={newRace}>Create a fresh race</button></>}</div> : <>
      {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
      <div className="race-layout"><section className="race-main"><div className="race-heading"><div><span className="eyebrow">{state.phase === 'lobby' ? 'WAITING AT THE START LINE' : state.phase === 'finished' ? 'THE CIRCUIT IS COMPLETE' : 'THE FOUR-CITY CIRCUIT'}</span><h1>{isPolice ? 'Your beat. Your call.' : state.phase === 'lobby' ? 'Get your crew together.' : 'Take the scenic route.'}</h1></div><div className="race-clock"><span>{state.phase === 'lobby' ? 'RACE LENGTH' : 'TIME LEFT'}</span><strong>{fmt(remaining)}</strong></div></div>
      <div className="map-frame"><World state={state} me={me}/><div className="map-badge"><span className="live-dot"/> LIVE RACE · {me.name} {isPolice ? ' / OFFICER' : ''}</div>{state.phase === 'lobby' && <div className="lobby-overlay"><div><Flag size={30}/><h2>Make it a road trip.</h2><p>Invite a friend as a driver and another as Officer Maya. Use different browsers or Incognito.</p><div className="joined-players">{state.players.map(p => <span key={p.slot} style={{ borderColor: p.color }}>{p.role === 'police' ? <Shield size={14}/> : <Car size={14}/>} {p.name}</span>)}</div><button className="primary" disabled={busy || !state.players.some(p => p.role === 'driver') || !(me.host || isPolice)} onClick={() => action('/start', {})}><Play size={18}/> Start race</button><small>The host or officer starts. You can also practice alone and pay tickets.</small></div></div>}
      {state.phase === 'finished' && <div className="lobby-overlay results"><div><Trophy size={36}/><span className="eyebrow">FINAL STANDINGS</span><h2>{state.standings[0]?.finished ? `${state.standings[0].name} wins the circuit!` : 'Time is up!'}</h2><p>{state.standings[0]?.finished ? 'All four cities. The cleanest finish.' : 'No driver completed all four cities. Try a fresh race.'}</p>{state.standings.map((p,i) => <div className="result-row" key={p.slot}><strong>{i+1}. {p.name}</strong><span>{p.cities}/4 cities · {p.violations} violations · {fmt(p.activeTime)} driving</span></div>)}<button className="primary" onClick={newRace}><RotateCcw size={16}/> Another road trip</button></div></div>}</div>
      {state.phase === 'racing' && !isPolice && <div className="dashboard"><div className="speed-display"><strong className={me.speed > (currentRoad?.limit || 100) ? 'over-limit' : ''}>{me.speed}</strong><span>GAME SPEED</span></div><div className="drive-info"><strong>{me.status === 'detained' ? 'Pulled over. Make your case.' : me.status === 'finished' ? 'All cities visited!' : currentRoad?.name || state.cities.find(c => c.id === me.city)?.name}</strong><span>{currentRoad ? `LIMIT ${currentRoad.limit} · ${currentRoad.rule === 'signal' ? `SIGNAL ${state.signal.toUpperCase()} · line at ${Math.round(me.checkpoint*100)}%` : currentRoad.rule === 'stop' ? me.stopCleared ? 'STOP CHECK PASSED' : `STOP before ${Math.round(me.checkpoint*100)}% · hold brake 1 sec` : 'ONE WAY: OLD → HARBOR'}` : 'Select your next road below.'}</span>{currentRoad && <div className="road-progress"><i style={{ width: `${me.progress*100}%` }}/><b style={{ left: `${me.checkpoint*100}%` }}/></div>}</div><button className="pedal brake" disabled={me.status !== 'driving'} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setPedal('brake', true); }} onPointerUp={() => setPedal('brake', false)} onPointerCancel={() => setPedal('brake', false)}>BRAKE <kbd>S / ↓</kbd></button><button className="pedal gas" disabled={me.status !== 'driving'} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setPedal('gas', true); }} onPointerUp={() => setPedal('gas', false)} onPointerCancel={() => setPedal('gas', false)}>ACCELERATE <kbd>W / ↑</kbd></button></div>}
      {state.phase === 'racing' && me.status === 'city' && !isPolice && <div className="route-picker"><span className="eyebrow">CHOOSE YOUR NEXT ROAD</span><div>{state.roads.filter(r => r.a === me.city || r.b === me.city).map(r => { const next = r.a === me.city ? r.b : r.a; const wrong = r.rule === 'oneway' && r.a !== me.city; return <button key={r.id} disabled={busy} className={wrong ? 'wrong-route' : ''} onClick={() => action('/road', { road: r.id })}><span><strong>{state.cities.find(c => c.id === next).name} {me.visited.includes(next) && '✓'}</strong><small>{r.name} · {r.limit} limit · {wrong ? 'NO ENTRY this direction' : r.rule === 'stop' ? 'STOP sign' : r.rule === 'signal' ? 'Traffic signal' : 'One-way permitted'}</small></span><ArrowRight size={18}/></button>; })}</div></div>}
      <div className="road-trip-log"><span className="eyebrow">DISPATCH LOG</span>{state.events.slice(-4).reverse().map(e => <p key={e.id}><span>{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>{e.text}</p>)}</div>
      </section><aside className={`race-side ${ticket ? "has-ticket" : ""}`}><div className="score-card"><div className="section-head"><h2>Road standings</h2><Flag size={18}/></div>{state.standings.map((p,i) => <div className="score-row" key={p.slot}><span className="rank">{i+1}</span><div><strong>{p.name}</strong><small>{p.cities}/4 cities · {fmt(p.activeTime)} active</small></div><span className={`violation-count ${p.violations ? 'bad' : ''}`}>{p.violations}<small>violations</small></span></div>)}<div className="wallet">{isPolice ? <><Shield size={15}/> Officer decisions release parked cars</> : <><span>YOUR WALLET</span><strong>{me.credits} <small>game credits</small></strong></>}</div></div>
      {isPolice && <div className="case-queue"><div className="section-head"><h2>Roadside cases</h2><span>{state.cases.filter(c => c.status === 'open').length} open</span></div>{!state.cases.some(c => c.status === 'open') && <p className="muted">All quiet on your beat. New violations appear here automatically.</p>}{state.cases.filter(c => c.status === 'open').map(c => <button key={c.id} className={`queue-item ${ticket?.id === c.id ? 'active' : ''}`} onClick={() => talk(c)}><Shield size={18}/><span><strong>{c.driver}</strong><small>{c.title}</small></span><ArrowRight size={16}/></button>)}</div>}
      {ticket && <div className={`ticket-card ${ticket.status !== 'open' ? 'settled' : ''}`}><div className="ticket-top"><span><Shield size={15}/> TRAFFIC CHALLAN</span><small>{ticket.status.toUpperCase()}</small></div><h2>{ticket.title}</h2><p>{ticket.driver} · {ticket.road}</p><div className="evidence"><span>Recorded speed <b>{ticket.evidence.speed} / {ticket.evidence.limit}</b></span><span>Signal at crossing <b>{ticket.evidence.signal.toUpperCase()}</b></span><span>Road progress <b>{ticket.evidence.progress}%</b></span></div>{ticket.status === 'open' ? <><div className="ticket-fee"><span>Game fine</span><strong>{ticket.fee} credits</strong></div><button className="primary wide" disabled={busy} onClick={() => action(`/cases/${ticket.id}`, { decision: 'pay' })}>{isPolice ? 'Confirm fine & release' : 'Pay challan & continue'}</button>{isPolice ? <button className="secondary wide" disabled={busy || state.players.find(p => p.slot === ticket.slot)?.warnings >= 1} onClick={() => action(`/cases/${ticket.id}`, { decision: 'warn' })}>Grant one warning & release</button> : <button className="secondary wide" disabled={!group} onClick={() => talk(ticket)}><MessageCircle size={16}/> Talk to the officer</button>}<small className="fineprint">Confirmed violations stay on your score, even after paying or receiving a warning.</small></> : <p className="resolution"><Check size={17}/>{ticket.resolution}</p>}</div>}
      <div className="chat-shell"><div className="chat-label"><span className="live-dot"/><strong>{peer ? 'Roadside conversation' : 'Race radio'}</strong><small>COMETCHAT</small>{peer && <button className="icon-button" aria-label="Back to race radio" onClick={() => { setPeer(null); setSelectedCase(null); }}><X size={15}/></button>}</div>{group ? <><div className="chat-peer"><span>{peer ? `${peer.getName()} · private chat` : `Room ${state.code} · everyone`}</span>{peer && <CometChatCallButtons user={peer} onError={e => setChatError(e.message || 'Call could not connect.')}/>}</div><div className="rq-message-list"><CometChatMessageList key={peer?.getUid() || group.getGuid()} {...(peer ? { user: peer } : { group })} hideReplyInThreadOption hideDateSeparator hideReactionOption/></div><div className="rq-composer"><CometChatMessageComposer key={peer?.getUid() || group.getGuid()} {...(peer ? { user: peer } : { group })} placeholder={peer ? 'Explain your case…' : 'Message the race…'} hideVoiceRecordingButton hideStickersButton hideEmojiKeyboardButton/></div></> : <div className="chat-loading"><Radio size={22}/><p>{chatError || 'Connecting to CometChat…'}</p>{chatError && <button className="secondary" onClick={() => setChatRetry(v => v+1)}>Retry chat</button>}</div>}{group && chatError && <p className="error" role="alert">{chatError}</p>}</div>
      </aside></div>
    </>}
    <footer>RoadQuest · A multiplayer traffic game. Fictional roads and fines. <a href="https://github.com/mohit23042-boop/relaytag" target="_blank" rel="noreferrer">Source code ↗</a></footer>
  </div>;
  return <CometChatErrorBoundary><CometChatProvider theme="dark">{group && <CometChatIncomingCall/>}{screen}</CometChatProvider></CometChatErrorBoundary>;
}
createRoot(document.getElementById('root')).render(<App/>);
