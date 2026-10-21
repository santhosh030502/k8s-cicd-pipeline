const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('health endpoints return ok', async () => {
  const live = await fetch(`${base}/healthz`);
  assert.strictEqual(live.status, 200);
  const ready = await fetch(`${base}/readyz`);
  assert.strictEqual(ready.status, 200);
});

test('create and list tasks', async () => {
  const res = await fetch(`${base}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'write helm chart' }),
  });
  assert.strictEqual(res.status, 201);
  const task = await res.json();
  assert.strictEqual(task.title, 'write helm chart');

  const list = await (await fetch(`${base}/tasks`)).json();
  assert.strictEqual(list.length, 1);
});

test('reject task without title', async () => {
  const res = await fetch(`${base}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.strictEqual(res.status, 400);
});

test('mark task done and delete it', async () => {
  const patch = await fetch(`${base}/tasks/1`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done: true }),
  });
  assert.strictEqual((await patch.json()).done, true);

  const del = await fetch(`${base}/tasks/1`, { method: 'DELETE' });
  assert.strictEqual(del.status, 204);
});

test('metrics endpoint exposes prometheus metrics', async () => {
  const res = await fetch(`${base}/metrics`);
  const body = await res.text();
  assert.match(body, /http_requests_total/);
});
