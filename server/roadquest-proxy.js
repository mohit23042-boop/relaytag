import http from 'node:http';

// A branded public entry point. Race state and authentication stay on the
// existing game service so links on both domains share the same rooms.
const upstream = 'https://relaytag-demo.onrender.com';
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
    const response = await fetch(upstream + path, {
      method: req.method,
      headers,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(90_000)
    });
    const output = {};
    for (const name of ['content-type', 'cache-control', 'etag', 'last-modified']) {
      if (response.headers.has(name)) output[name] = response.headers.get(name);
    }
    const location = response.headers.get('location');
    if (location) output.location = location.startsWith(upstream) ? location.slice(upstream.length) || '/' : location;
    res.writeHead(response.status, output);
    if (req.method === 'HEAD' || [204,304].includes(response.status)) res.end();
    else res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('The game is waking up. Please retry in a moment.');
  }
});
server.listen(Number(process.env.PORT || 4178), '0.0.0.0', () => console.log('RoadQuest public entry point ready'));
