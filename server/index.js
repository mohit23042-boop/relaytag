import express from 'express';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataPath = process.env.RELAYTAG_DATA_FILE || path.join(here, 'data.json');
const port = Number(process.env.PORT || 4174);
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false }) : null;

const seed = () => ({
  items: [{
    id: 'machine-04',
    name: 'Sewing Machine No. 04',
    model: 'Morrow Workshop · Studio Floor',
    category: 'Shared equipment',
    location: 'Station B / East wall',
    tag: 'RT-0004',
    chatGuid: 'relaytag_machine_04',
    description: 'A well-loved mechanical machine, shared by everyone in the Morrow workshop.',
    custodian: 'Maya',
    createdAt: '2026-09-20T09:00:00.000Z',
    notes: [{
      id: 'note-original',
      text: 'Use the blue dial to set stitch length. For cotton, start at 2.5. The spare needles live in the small tin beside the machine.',
      author: 'Maya',
      sourceIssueId: null,
      confirmedBy: [],
      createdAt: '2026-09-20T09:00:00.000Z'
    }],
    previewMessages: [
      { id: 'msg-1', author: 'Leo', text: 'I was halfway through the tote bag when the thread started bunching underneath.', createdAt: '2026-09-28T09:31:00.000Z' },
      { id: 'msg-2', author: 'Maya', text: 'Good call stopping. Could you check whether the presser foot was raised when you threaded it?', createdAt: '2026-09-28T09:33:00.000Z' },
      { id: 'msg-3', author: 'Leo', text: 'It was down. I think that might be it — I’ll rethread and try on scrap fabric.', createdAt: '2026-09-28T09:34:00.000Z' }
    ],
    issues: [{
      id: 'issue-seeded',
      title: 'Thread keeps bunching underneath',
      detail: 'It happens after a few stitches on canvas. I stopped before forcing it.',
      author: 'Leo',
      status: 'open',
      createdAt: '2026-09-28T09:30:00.000Z',
      resolvedAt: null,
      resolvedBy: null,
      resolution: null
    }]
  }]
});

async function readData() {
  if (pool) {
    await prepareDatabase();
    const result = await pool.query('SELECT value FROM relaytag_state WHERE id = 1');
    return result.rows[0].value;
  }
  if (!existsSync(dataPath)) return seed();
  return JSON.parse(await readFile(dataPath, 'utf8'));
}

let databaseReady;
function prepareDatabase() {
  if (!databaseReady) databaseReady = (async () => {
    await pool.query('CREATE TABLE IF NOT EXISTS relaytag_state (id integer PRIMARY KEY, value jsonb NOT NULL)');
    await pool.query('INSERT INTO relaytag_state (id, value) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [JSON.stringify(seed())]);
  })().catch(error => { databaseReady = null; throw error; });
  return databaseReady;
}

let mutation = Promise.resolve();
async function updateData(change) {
  const next = mutation.then(async () => {
    if (pool) {
      await prepareDatabase();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const current = await client.query('SELECT value FROM relaytag_state WHERE id = 1 FOR UPDATE');
        const data = current.rows[0].value;
        const result = change(data);
        await client.query('UPDATE relaytag_state SET value = $1 WHERE id = 1', [JSON.stringify(data)]);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    }
    const data = await readData();
    const result = change(data);
    await mkdir(here, { recursive: true });
    const temporary = `${dataPath}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2));
    await rename(temporary, dataPath);
    return result;
  });
  mutation = next.catch(() => {});
  return next;
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

const allowedActors = new Set(['Maya', 'Leo', 'Nina']);
const demoUsers = { Maya: 'relaytag_maya', Leo: 'relaytag_leo', Nina: 'relaytag_nina' };
const traffic = new Map();
app.use('/api', (req, res, next) => {
  if (req.method !== 'POST') return next();
  const key = `${req.ip}:${req.path === '/chat/token' ? 'token' : 'write'}`;
  const now = Date.now();
  const entry = traffic.get(key);
  const windowMs = req.path === '/chat/token' ? 60 * 60_000 : 15 * 60_000;
  const limit = req.path === '/chat/token' ? 12 : 60;
  const current = !entry || now - entry.since > windowMs ? { since: now, count: 0 } : entry;
  current.count += 1;
  traffic.set(key, current);
  if (current.count > limit) return res.status(429).json({ error: 'Demo activity limit reached. Please try later.' });
  next();
});
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const publicItem = item => ({
  ...item,
  issues: [...item.issues].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  notes: [...item.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/chat/token', async (req, res, next) => {
  const uid = demoUsers[req.body.actor];
  const { COMETCHAT_APP_ID: appId, COMETCHAT_REGION: region, COMETCHAT_REST_API_KEY: apiKey } = process.env;
  if (!uid) return res.status(400).json({ error: 'Choose a demo profile.' });
  if (!appId || !region || !apiKey) return res.status(503).json({ error: 'Live chat is not configured.' });
  try {
    const response = await fetch(`https://${appId}.api-${region}.cometchat.io/v3/users/${uid}/auth_tokens`, {
      method: 'POST', headers: { apikey: apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ force: false })
    });
    const result = await response.json();
    if (!response.ok || !result.data?.authToken) throw new Error('CometChat token request failed.');
    res.set('Cache-Control', 'no-store').json({ authToken: result.data.authToken });
  } catch (error) { next(error); }
});

app.get('/api/items', async (_req, res, next) => {
  try { res.json((await readData()).items.map(publicItem)); } catch (error) { next(error); }
});

app.get('/api/items/:id', async (req, res, next) => {
  try {
    const item = (await readData()).items.find(item => item.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Object not found.' });
    res.json(publicItem(item));
  } catch (error) { next(error); }
});

app.post('/api/items', async (req, res, next) => {
  const name = clean(req.body.name, 80);
  const location = clean(req.body.location, 100);
  const description = clean(req.body.description, 300);
  const category = clean(req.body.category, 50) || 'Shared equipment';
  const custodian = clean(req.body.custodian, 50);
  if (!name || !location || !description || !allowedActors.has(custodian)) return res.status(400).json({ error: 'Add a name, location, and description using a workshop profile.' });
  try {
    const item = await updateData(data => {
      const sequence = Math.max(4, ...data.items.map(item => Number(item.tag.replace(/\D/g, '')) || 0)) + 1;
      const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 35) || 'object'}-${sequence}`;
      const item = {
        id, name, model: 'Morrow Workshop · Studio Floor', category, location,
        tag: `RT-${String(sequence).padStart(4, '0')}`,
        chatGuid: `relaytag_object_${sequence}`,
        description, custodian, createdAt: new Date().toISOString(),
        notes: [], issues: [], previewMessages: []
      };
      data.items.push(item);
      return item;
    });
    res.status(201).json(item);
  } catch (error) { next(error); }
});

app.post('/api/items/:id/issues', async (req, res, next) => {
  const title = clean(req.body.title, 90);
  const detail = clean(req.body.detail, 500);
  const author = clean(req.body.author, 50);
  if (!title || !detail || !allowedActors.has(author)) return res.status(400).json({ error: 'Add a title and details using a workshop profile.' });
  try {
    const issue = await updateData(data => {
      const item = data.items.find(item => item.id === req.params.id);
      if (!item) throw Object.assign(new Error('Object not found.'), { status: 404 });
      const issue = { id: crypto.randomUUID(), title, detail, author, status: 'open', createdAt: new Date().toISOString(), resolvedAt: null, resolvedBy: null, resolution: null };
      item.issues.push(issue);
      return issue;
    });
    res.status(201).json(issue);
  } catch (error) { next(error); }
});

app.post('/api/items/:id/preview-messages', async (req, res, next) => {
  const text = clean(req.body.text, 1000);
  const author = clean(req.body.author, 50);
  if (!text || !allowedActors.has(author)) return res.status(400).json({ error: 'Write a message using a workshop profile.' });
  try {
    const message = await updateData(data => {
      const item = data.items.find(item => item.id === req.params.id);
      if (!item) throw Object.assign(new Error('Object not found.'), { status: 404 });
      const message = { id: crypto.randomUUID(), text, author, createdAt: new Date().toISOString() };
      item.previewMessages.push(message);
      return message;
    });
    res.status(201).json(message);
  } catch (error) { next(error); }
});

app.post('/api/items/:id/issues/:issueId/resolve', async (req, res, next) => {
  const summary = clean(req.body.summary, 500);
  const author = clean(req.body.author, 50);
  if (!summary || !allowedActors.has(author)) return res.status(400).json({ error: 'Add a handoff note using a workshop profile.' });
  try {
    const result = await updateData(data => {
      const item = data.items.find(item => item.id === req.params.id);
      if (!item) throw Object.assign(new Error('Object not found.'), { status: 404 });
      const issue = item.issues.find(issue => issue.id === req.params.issueId);
      if (!issue) throw Object.assign(new Error('Issue not found.'), { status: 404 });
      if (issue.status === 'resolved') throw Object.assign(new Error('This issue is already resolved.'), { status: 409 });
      const now = new Date().toISOString();
      issue.status = 'resolved';
      issue.resolvedAt = now;
      issue.resolvedBy = author;
      issue.resolution = summary;
      const note = { id: crypto.randomUUID(), text: summary, author, sourceIssueId: issue.id, confirmedBy: [], createdAt: now };
      item.notes.push(note);
      return { issue, note };
    });
    res.json(result);
  } catch (error) { next(error); }
});

app.post('/api/items/:id/notes/:noteId/confirm', async (req, res, next) => {
  const author = clean(req.body.author, 50);
  if (!allowedActors.has(author)) return res.status(400).json({ error: 'Choose a workshop profile.' });
  try {
    const note = await updateData(data => {
      const item = data.items.find(item => item.id === req.params.id);
      if (!item) throw Object.assign(new Error('Object not found.'), { status: 404 });
      const note = item.notes.find(note => note.id === req.params.noteId);
      if (!note) throw Object.assign(new Error('Handoff note not found.'), { status: 404 });
      if (note.author === author) throw Object.assign(new Error('Ask another borrower to check your tip.'), { status: 403 });
      note.confirmedBy ||= [];
      if (!note.confirmedBy.includes(author)) note.confirmedBy.push(author);
      return note;
    });
    res.json(note);
  } catch (error) { next(error); }
});

app.use(express.static(path.join(here, '../dist')));
app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html') && !req.path.startsWith('/api/')) return res.sendFile(path.join(here, '../dist/index.html'));
  next();
});

app.use((error, _req, res, _next) => {
  if (!error.status || error.status >= 500) console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong. Please try again.' });
});

if (process.env.NODE_ENV !== 'test') {
  const host = process.env.RENDER ? '0.0.0.0' : '127.0.0.1';
  app.listen(port, host, () => console.log(`RelayTag API listening on http://${host}:${port}`));
}

export default app;
