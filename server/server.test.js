import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('a resolved issue becomes a durable handoff note on its object', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'relaytag-test-'));
  const dataFile = path.join(directory, 'data.json');
  process.env.RELAYTAG_DATA_FILE = dataFile;
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('./index.js');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = async (route, body) => {
    const response = await fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  try {
    const invalid = await send('/api/items', { name: 'Camera', location: 'Shelf A', description: 'A camera', custodian: 'Unknown' });
    assert.equal(invalid.status, 400);

    const created = await send('/api/items', { name: 'Film Camera', location: 'Shelf A', description: 'Shared 35mm camera', category: 'Creative gear', custodian: 'Maya' });
    assert.equal(created.status, 201);
    assert.equal(created.body.tag, 'RT-0005');

    const reported = await send(`/api/items/${created.body.id}/issues`, { title: 'Film advance sticks', detail: 'The lever needs a gentle reset.', author: 'Leo' });
    assert.equal(reported.status, 201);

    const resolved = await send(`/api/items/${created.body.id}/issues/${reported.body.id}/resolve`, { summary: 'Turn the rewind knob slightly, then advance.', author: 'Nina' });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.note.sourceIssueId, reported.body.id);

    const item = await (await fetch(`${base}/api/items/${created.body.id}`)).json();
    assert.equal(item.issues[0].status, 'resolved');
    assert.equal(item.issues[0].resolvedBy, 'Nina');
    assert.equal(item.notes[0].text, 'Turn the rewind knob slightly, then advance.');
    assert.equal(item.notes[0].author, 'Nina');

    const ownCheck = await send(`/api/items/${created.body.id}/notes/${resolved.body.note.id}/confirm`, { author: 'Nina' });
    assert.equal(ownCheck.status, 403);
    const check = await send(`/api/items/${created.body.id}/notes/${resolved.body.note.id}/confirm`, { author: 'Leo' });
    assert.equal(check.status, 200);
    assert.deepEqual(check.body.confirmedBy, ['Leo']);
    const repeatCheck = await send(`/api/items/${created.body.id}/notes/${resolved.body.note.id}/confirm`, { author: 'Leo' });
    assert.deepEqual(repeatCheck.body.confirmedBy, ['Leo']);
    const checkedItem = await (await fetch(`${base}/api/items/${created.body.id}`)).json();
    assert.deepEqual(checkedItem.notes[0].confirmedBy, ['Leo']);

    const duplicate = await send(`/api/items/${created.body.id}/issues/${reported.body.id}/resolve`, { summary: 'Again', author: 'Nina' });
    assert.equal(duplicate.status, 409);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await unlink(dataFile);
    await rmdir(directory);
  }
});
