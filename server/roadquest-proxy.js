import http from 'node:http';

// A branded public entry point. Race state and authentication stay on the
// existing game service so links on both domains share the same rooms.
const upstream = 'https://relaytag-demo.onrender.com';
const demoTokens = new Map();
const server = http.createServer(async (req, res) => {
  const path = req.url || '/';
  if (path === '/') {
    res.writeHead(302, { Location: '/roadquest/' });
    res.end();
    return;
  }
  try {
    const headers = new Headers();
    for (const name of ['content-type', 'authorization', 'accept']) {
      if (req.headers[name]) headers.set(name, req.headers[name]);
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1_000_000) { res.writeHead(413); res.end('Request too large'); return; }
      chunks.push(chunk);
    }
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    let actor;
    if (path === '/api/chat/token' && req.method === 'POST') {
      try { actor = JSON.parse(body?.toString() || '{}').actor; } catch {}
      if (!['Leo','Nina','Maya'].includes(actor)) actor = undefined;
      const cached = actor && demoTokens.get(actor);
      if (cached && Date.now() < cached.expires) {
        res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
        res.end(cached.data);
        return;
      }
    }
    const response = await fetch(upstream + path, {
      method: req.method,
      headers,
      ...(body ? { body } : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(90_000)
    });
    const output = {};
    for (const name of ['content-type', 'cache-control', 'etag', 'last-modified']) {
      if (response.headers.has(name)) output[name] = response.headers.get(name);
    }
    const location = response.headers.get('location');
    if (location) output.location = location.startsWith(upstream) ? location.slice(upstream.length) || '/' : location;
    const data = req.method === 'HEAD' || [204,304].includes(response.status) ? null : Buffer.from(await response.arrayBuffer());
    if (actor && response.status === 200) demoTokens.set(actor, {data,expires:Date.now()+30*60_000});
    res.writeHead(response.status, output);
    if (req.method === 'HEAD' || [204,304].includes(response.status)) res.end();
    else res.end(data);
  } catch {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('The game is waking up. Please retry in a moment.');
  }
});
server.listen(Number(process.env.PORT || 4178), '0.0.0.0', () => console.log('RoadQuest public entry point ready'));
