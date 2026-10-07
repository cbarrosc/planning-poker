import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
const dir = mkdtempSync(join(tmpdir(), 'poker-production-'));
const origin = 'http://localhost:3299';
let child;
async function start() {
  child = spawn(process.execPath, ['dist/server.js'], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      PORT: '3299',
      PUBLIC_ORIGIN: origin,
      DATABASE_PATH: join(dir, 'poker.sqlite'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stderr.on('data', (b) => process.stderr.write(b));
  await Promise.race([
    once(child.stdout, 'data'),
    once(child, 'exit').then(() => {
      throw Error('El servidor no inició');
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(Error('Timeout al iniciar')), 10000).unref(),
    ),
  ]);
  assert.equal((await fetch(`${origin}/health`)).status, 200);
}
async function stop() {
  if (child && child.exitCode === null) {
    const closed = once(child, 'exit');
    child.kill();
    await closed;
  }
}
let cookie = '';
async function request(path, body) {
  const res = await fetch(`${origin}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { origin, 'content-type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const data = await res.json();
  assert.equal(res.ok, true, JSON.stringify(data));
  return data;
}
try {
  await start();
  assert.match(await (await fetch(`${origin}/`)).text(), /<title>Planning Poker/);
  let s = await request('/api/sessions', {
    name: 'Prueba reinicio',
    participantName: 'Ana',
    scale: {
      name: 'Prueba',
      cards: [
        { label: '1', value: 1 },
        { label: '5', value: 5 },
      ],
    },
    requestId: randomUUID(),
  });
  const code = s.session.code,
    self = s.selfId;
  async function command(input) {
    s = await request(`/api/sessions/${code}/commands`, {
      ...input,
      requestId: randomUUID(),
      expectedRevision: s.revision,
    });
    return s;
  }
  await command({ type: 'task.add', title: 'Persistente', description: '' });
  await command({ type: 'task.select', taskId: s.tasks[0].id });
  await command({ type: 'round.open' });
  await command({ type: 'vote.set', choice: '5', roundId: s.round.id });
  const roundId = s.round.id;
  await stop();
  await start();
  s = await request(`/api/sessions/${code}`);
  assert.equal(s.selfId, self);
  assert.equal(s.round.id, roundId);
  assert.equal(s.round.ownVote, '5');
  assert.equal(s.round.status, 'open');
  assert.equal(s.participants[0].online, false);
  await command({ type: 'round.reveal' });
  assert.equal(s.round.statistics.average, 5);
  await command({ type: 'round.save', choice: '5' });
  await stop();
  await start();
  s = await request(`/api/sessions/${code}`);
  assert.equal(s.tasks[0].estimate, '5');
  assert.equal(s.round.status, 'finalized');
  console.log(
    'OK: servidor compilado, frontend, identidad, ronda/voto y resultado sobreviven a dos reinicios.',
  );
} finally {
  await stop();
  rmSync(dir, { recursive: true, force: true });
}
