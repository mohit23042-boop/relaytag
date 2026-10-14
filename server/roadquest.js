import express from 'express';
import crypto from 'node:crypto';

export const CITIES = [
  { id: 'metro', name: 'Metro City', x: 160, y: 160, color: '#f7bc62' },
  { id: 'harbor', name: 'Harbor Bay', x: 1020, y: 160, color: '#7bc4ca' },
  { id: 'hill', name: 'Hill Town', x: 1020, y: 620, color: '#b4bc8c' },
  { id: 'old', name: 'Old Quarter', x: 160, y: 620, color: '#d99ba9' }
];
export const ROADS = [
  { id: 'coast', a: 'metro', b: 'harbor', name: 'Coastal Highway', limit: 70, rule: 'signal' },
  { id: 'ridge', a: 'harbor', b: 'hill', name: 'Ridge Road', limit: 50, rule: 'stop' },
  { id: 'south', a: 'old', b: 'hill', name: 'Garden Road', limit: 60, rule: 'signal' },
  { id: 'west', a: 'metro', b: 'old', name: 'Market Street', limit: 50, rule: 'stop' },
  { id: 'express', a: 'metro', b: 'hill', name: 'City Express', limit: 80, rule: 'signal' },
  { id: 'oneway', a: 'old', b: 'harbor', name: 'One-way Shortcut', limit: 60, rule: 'oneway' }
];
const ROLES = {
  leo: { actor: 'Leo', uid: 'relaytag_leo', role: 'driver', color: '#ffc857' },
  nina: { actor: 'Nina', uid: 'relaytag_nina', role: 'driver', color: '#82dad3' },
  maya: { actor: 'Maya', uid: 'relaytag_maya', role: 'police', color: '#88a8ff' }
};
const rooms = new Map();
export function lightAt(now) { return Math.floor(now / 5000) % 2 === 0 ? 'green' : 'red'; }
const city = id => CITIES.find(c => c.id === id);
function position(p) {
  if (!p.road) return { x: city(p.city).x, y: city(p.city).y, angle: 0 };
  const from = city(p.from), to = city(p.to);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const side = p.status === 'detained' ? 52 : 12;
  return { x: from.x + (to.x - from.x) * p.progress - Math.sin(angle) * side, y: from.y + (to.y - from.y) * p.progress + Math.cos(angle) * side, angle: angle * 180 / Math.PI };
}
export function snapshot(room, now = Date.now()) {
  return {
    code: room.code, phase: room.phase, startedAt: room.startedAt, endsAt: room.endsAt,
    now, signal: lightAt(now), signalChangeIn: 5000 - now % 5000, cities: CITIES, roads: ROADS,
    players: Object.values(room.players).map(p => ({
      slot: p.slot, name: p.name, actor: p.actor, uid: p.uid, role: p.role, color: p.color,
      status: p.status, city: p.city, visited: p.visited, road: p.road, from: p.from, to: p.to,
      progress: p.progress, checkpoint: p.checkpoint, schoolCheckpoint: p.schoolCheckpoint, crossingCheckpoint: p.crossingCheckpoint, speed: Math.round(p.speed), credits: p.credits, violations: p.violations,
      warnings: p.warnings, seatbelt: p.seatbelt !== false, activeTime: Math.round(p.activeTime * 10) / 10, stopCleared: p.stopCleared,
      online: now - p.lastSeen < 12000, position: position(p), caseId: p.caseId,
      host: p.token === room.hostToken
    })),
    cases: room.cases, events: room.events.slice(-12),
    standings: Object.values(room.players).filter(p => p.role === 'driver').sort((a, b) =>
      (b.visited.length === 4) - (a.visited.length === 4) || a.violations - b.violations || b.visited.length - a.visited.length || a.activeTime - b.activeTime
    ).map(p => ({ slot: p.slot, name: p.name, cities: p.visited.length, violations: p.violations, activeTime: Math.round(p.activeTime * 10) / 10, finished: p.visited.length === 4 }))
  };
}
const addEvent = (room, text) => { room.events.push({ id: crypto.randomUUID(), text, at: Date.now() }); room.events = room.events.slice(-30); };
export function createRoom(code = crypto.randomBytes(3).toString('hex').toUpperCase()) {
  const room = { code, phase: 'lobby', players: {}, cases: [], events: [], startedAt: null, endsAt: null, hostToken: null, touched: Date.now() };
  rooms.set(code, room); return room;
}
export function addPlayer(room, slot, name, now = Date.now()) {
  if (!ROLES[slot]) throw Object.assign(new Error('Choose a driver or police officer.'), { status: 400 });
  if (room.players[slot]) throw Object.assign(new Error('That character is already in this race. Choose another one.'), { status: 409 });
  if (room.phase !== 'lobby' && slot !== 'maya') throw Object.assign(new Error('This race has started. Create a new room.'), { status: 409 });
  const p = { ...ROLES[slot], slot, name: String(name || ROLES[slot].actor).trim().slice(0, 22), token: crypto.randomBytes(24).toString('hex'), status: 'city', city: 'metro', visited: ['metro'], road: null, from: null, to: null, progress: 0, speed: 0, credits: 500, violations: 0, warnings: 0, activeTime: 0, input: { gas: false, brake: false }, lastInput: now, lastSeen: now, stopHeld: 0, stopCleared: false, signalCleared: false, speedOver: 0, caseId: null };
  room.players[slot] = p;
  p.seatbelt = true; p.extraChecks = {};
  room.hostToken ||= p.token;
  addEvent(room, `${p.name} joined as ${p.role === 'police' ? 'police officer' : 'driver'}.`);
  return p;
}
export function startRace(room, now = Date.now()) {
  if (!Object.values(room.players).some(p => p.role === 'driver')) throw Object.assign(new Error('A driver must join first.'), { status: 400 });
  if (room.phase !== 'lobby') throw Object.assign(new Error('The race has already started.'), { status: 409 });
  room.phase = 'racing'; room.startedAt = now; room.endsAt = now + 240000; addEvent(room, 'Race started. Visit all four cities. Fewest violations wins!');
}
export function chooseRoad(room, p, roadId) {
  if (room.phase !== 'racing' || p.role !== 'driver' || p.status !== 'city') throw Object.assign(new Error('Choose a road while parked in a city during the race.'), { status: 409 });
  const road = ROADS.find(r => r.id === roadId && (r.a === p.city || r.b === p.city));
  if (!road) throw Object.assign(new Error('That road does not connect to your city.'), { status: 400 });
  p.road = road.id; p.from = p.city; p.to = road.a === p.city ? road.b : road.a; p.progress = .07; p.speed = 0; p.status = 'driving'; p.stopHeld = 0; p.stopCleared = false; p.signalCleared = false; p.speedOver = 0; p.wrongWayChecked = false; p.input = { gas: false, brake: false };
  p.checkpoint = road.rule === 'signal' ? p.from === road.a ? .48 : .52 : p.from === road.a ? .44 : .56;
  p.extraChecks = {};
  p.schoolCheckpoint = p.from === road.a ? .72 : .28; p.crossingCheckpoint = p.from === road.a ? .84 : .16;
}
export function issueTicket(room, p, rule, now, extra = {}) {
  if (p.status !== 'driving') return;
  const road = ROADS.find(r => r.id === p.road);
  const titles = { speed: 'Speed limit exceeded', signal: 'Crossed a red signal', stop: 'Did not stop at the stop sign', oneway: 'Entered a one-way road in reverse', seatbelt: 'Driving without a seat belt', school: 'Exceeded school-zone limit (25)', crossing: 'Failed to slow at pedestrian crossing (15)' };
  const ticket = { id: crypto.randomUUID(), slot: p.slot, driver: p.name, rule, title: titles[rule], road: road.name, fee: rule === 'speed' ? 100 : 150, status: 'open', at: now, evidence: { speed: Math.round(p.speed), limit: road.limit, signal: lightAt(now), progress: Math.round(p.progress * 100), from: p.from, to: p.to, position: position(p), ...extra }, resolution: null };
  room.cases.unshift(ticket); p.caseId = ticket.id; p.status = 'detained'; p.speed = 0; p.input = { gas: false, brake: false }; p.violations++; addEvent(room, `${p.name}: ${ticket.title}. Pulled over on ${road.name}.`);
}
export function decideCase(room, actor, caseId, decision, now = Date.now()) {
  const ticket = room.cases.find(c => c.id === caseId);
  if (!ticket) throw Object.assign(new Error('Case not found.'), { status: 404 });
  if (ticket.status !== 'open') throw Object.assign(new Error('This case has already been resolved.'), { status: 409 });
  const driver = room.players[ticket.slot];
  if (decision === 'pay' && actor.token !== driver.token && actor.role !== 'police') throw Object.assign(new Error('Only this driver or the officer can settle the fine.'), { status: 403 });
  if (decision === 'warn' && (actor.role !== 'police' || driver.warnings >= 1)) throw Object.assign(new Error('Only the officer can grant one warning per driver.'), { status: 403 });
  if (!['pay', 'warn'].includes(decision)) throw Object.assign(new Error('Choose a fine or a warning.'), { status: 400 });
  if (decision === 'pay') driver.credits -= ticket.fee; else driver.warnings++;
  ticket.status = decision === 'warn' ? 'warning' : 'paid'; ticket.resolvedAt = now; ticket.resolution = decision === 'warn' ? `Officer ${actor.name} granted the driver's one warning. The violation still counts.` : `${ticket.fee} game credits paid. The violation still counts.`;
  driver.caseId = null; driver.status = 'driving'; driver.speedOver = 0; driver.lastInput = now; driver.input = { gas: false, brake: false };
  if (ticket.rule === 'signal') driver.signalCleared = true;
  if (ticket.rule === 'stop') driver.stopCleared = true;
  if (ticket.rule === 'seatbelt') driver.seatbelt = true;
  if (ticket.rule === 'oneway') { driver.status = 'city'; driver.road = null; driver.city = driver.from; driver.progress = 0; }
  addEvent(room, `${driver.name} released: ${ticket.status === 'warning' ? 'one warning used' : 'fine settled'}.`);
  return ticket;
}
export function tickRoom(room, dt, now = Date.now()) {
  if (room.phase !== 'racing') return;
  for (const p of Object.values(room.players)) {
    if (p.role !== 'driver' || p.status !== 'driving') continue;
    const road = ROADS.find(r => r.id === p.road), a = city(p.from), b = city(p.to);
    const input = now - p.lastInput > 900 ? { gas: false, brake: true } : p.input;
    p.speed = Math.max(0, Math.min(110, p.speed + (input.brake ? -110 : input.gas ? 32 : -18) * dt));
    if (p.speed > 1) p.activeTime += dt;
    const oldProgress = p.progress;
    p.progress = Math.min(1, p.progress + p.speed * 2.1 * dt / Math.hypot(b.x - a.x, b.y - a.y));
    if (p.speed > road.limit + 3) p.speedOver += dt; else p.speedOver = 0;
    if (p.speedOver > 1) { issueTicket(room, p, 'speed', now); continue; }
    if (p.speed > 12 && p.seatbelt === false) { issueTicket(room,p,'seatbelt',now);continue; }
    if (oldProgress < p.schoolCheckpoint && p.progress >= p.schoolCheckpoint && p.speed > 25 && !p.extraChecks.school) { p.extraChecks.school=true;issueTicket(room,p,'school',now,{zoneLimit:25});continue; }
    if (oldProgress < p.crossingCheckpoint && p.progress >= p.crossingCheckpoint && p.speed > 15 && !p.extraChecks.crossing) { p.extraChecks.crossing=true;issueTicket(room,p,'crossing',now,{zoneLimit:15});continue; }
    if (road.rule === 'oneway' && p.from !== road.a && p.progress > .15 && !p.wrongWayChecked) { p.wrongWayChecked = true; issueTicket(room, p, 'oneway', now); continue; }
    if (road.rule === 'stop') {
      if (p.progress >= p.checkpoint - .17 && p.progress <= p.checkpoint - .01 && p.speed < 1) p.stopHeld += dt;
      if (p.stopHeld >= .65) p.stopCleared = true;
      if (oldProgress < p.checkpoint && p.progress >= p.checkpoint && !p.stopCleared) { issueTicket(room, p, 'stop', now); continue; }
    }
    if (road.rule === 'signal' && oldProgress < p.checkpoint && p.progress >= p.checkpoint && !p.signalCleared) {
      if (lightAt(now) === 'red') { issueTicket(room, p, 'signal', now); continue; }
      p.signalCleared = true;
    }
    if (p.progress >= .95) {
      p.city = p.to; p.road = null; p.speed = 0; p.status = 'city'; p.input = { gas: false, brake: false };
      if (!p.visited.includes(p.city)) { p.visited.push(p.city); addEvent(room, `${p.name} reached ${city(p.city).name} (${p.visited.length}/4).`); }
      if (p.visited.length === 4) { p.status = 'finished'; addEvent(room, `${p.name} completed the circuit with ${p.violations} violations!`); }
    }
  }
  const drivers = Object.values(room.players).filter(p => p.role === 'driver');
  if (now >= room.endsAt || drivers.length && drivers.every(p => ['finished', 'withdrawn'].includes(p.status))) { room.phase = 'finished'; addEvent(room, 'Race complete. Finishers rank first, then fewest violations and active driving time.'); }
}

export const roadquestRouter = express.Router();
roadquestRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
roadquestRouter.post('/join', (req, res, next) => {
  try {
    let room;
    if (req.body.create) { if (rooms.size >= 100) throw Object.assign(new Error('Server is busy. Try again later.'), { status: 429 }); room = createRoom(); }
    else { room = rooms.get(String(req.body.code || '').toUpperCase().trim()); if (!room) throw Object.assign(new Error('Race not found. Check the room code or create a race.'), { status: 404 }); }
    const p = addPlayer(room, req.body.slot, req.body.name);
    res.json({ token: p.token, slot: p.slot, code: room.code, state: snapshot(room) });
  } catch (e) { next(e); }
});
roadquestRouter.use('/:code', (req, res, next) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Race no longer exists. Create a new one.' });
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  const p = Object.values(room.players).find(p => p.token === token);
  if (!p) return res.status(401).json({ error: 'Join this race first.' });
  p.lastSeen = Date.now(); room.touched = Date.now(); req.game = { room, p }; next();
});
roadquestRouter.get('/:code', (req, res) => res.json(snapshot(req.game.room)));
roadquestRouter.post('/:code/start', (req, res, next) => {
  try { const { room, p } = req.game; if (p.token !== room.hostToken && p.role !== 'police') throw Object.assign(new Error('Only the host or officer can start the race.'), { status: 403 }); startRace(room); res.json(snapshot(room)); } catch (e) { next(e); }
});
roadquestRouter.post('/:code/input', (req, res) => { const p = req.game.p; p.input = { gas: req.body.gas === true, brake: req.body.brake === true }; p.lastInput = Date.now(); res.json({ ok: true }); });
roadquestRouter.post('/:code/seatbelt', (req,res)=>{req.game.p.seatbelt=req.body.enabled!==false;res.json(snapshot(req.game.room));});
roadquestRouter.post('/:code/leave', (req, res) => {
  const { room, p } = req.game;
  if (room.phase === 'lobby' || p.role === 'police') delete room.players[p.slot];
  else { p.status = 'withdrawn'; p.input = { gas: false, brake: true }; p.speed = 0; }
  if (room.phase === 'lobby' && room.hostToken === p.token) room.hostToken = Object.values(room.players)[0]?.token || null;
  addEvent(room, `${p.name} left the race.`); res.json({ ok: true });
});
roadquestRouter.post('/:code/road', (req, res, next) => { try { chooseRoad(req.game.room, req.game.p, req.body.road); res.json(snapshot(req.game.room)); } catch (e) { next(e); } });
roadquestRouter.post('/:code/cases/:id', (req, res, next) => { try { decideCase(req.game.room, req.game.p, req.params.id, req.body.decision); res.json(snapshot(req.game.room)); } catch (e) { next(e); } });
const timer = setInterval(() => { const now = Date.now(); for (const [code, room] of rooms) { tickRoom(room, .05, now); if (now - room.touched > 3600000) rooms.delete(code); } }, 50);
timer.unref();
