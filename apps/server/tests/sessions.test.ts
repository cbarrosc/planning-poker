import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db/database';
import { SessionService } from '../src/sessions/service';
import { createApp } from '../src/app';
import { FIBONACCI } from '../../../packages/shared/src/index';

it('mantiene identidades distintas, aislamiento e idempotencia', () => {
  const db = openDatabase(':memory:');
  const s = new SessionService(db);
  const a = s.identity(),
    b = s.identity();
  const input = {
    name: 'Sprint',
    participantName: 'Ana',
    scale: FIBONACCI,
    requestId: randomUUID(),
  };
  const one = s.createSession(a.actor, input);
  expect(s.createSession(a.actor, input).session.code).toBe(one.session.code);
  const two = s.createSession(b.actor, { ...input, requestId: randomUUID() });
  expect(() => s.getSnapshot(a.actor, two.session.code)).toThrow('No perteneces');
  const joined = s.joinSession(b.actor, one.session.code, { participantName: 'Ana' });
  expect(joined.selfId).not.toBe(one.selfId);
  expect(joined.participants).toHaveLength(2);
  expect(s.identity(a.token).actor).toEqual(a.actor);
  db.close();
});

it('recupera participantes y sesiones desde SQLite en otra conexión', () => {
  const dir = mkdtempSync(join(tmpdir(), 'poker-'));
  const path = join(dir, 'db.sqlite');
  try {
    const db = openDatabase(path);
    const s = new SessionService(db);
    const a = s.identity();
    const snapshot = s.createSession(a.actor, {
      name: 'Sprint',
      participantName: 'Ana',
      scale: FIBONACCI,
      requestId: randomUUID(),
    });
    db.close();
    const next = openDatabase(path);
    const service = new SessionService(next);
    expect(service.getSnapshot(service.identity(a.token).actor, snapshot.session.code).selfId).toBe(
      snapshot.selfId,
    );
    next.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('protege API con cookie, origen y validación', async () => {
  const db = openDatabase(':memory:');
  const app = createApp({ service: new SessionService(db), origin: 'http://localhost:3000' });
  const request = {
    name: 'Sprint',
    participantName: 'Ana',
    scale: FIBONACCI,
    requestId: randomUUID(),
  };
  const bad = await app.request('/api/sessions', {
    method: 'POST',
    headers: { origin: 'https://evil.test', 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  expect(bad.status).toBe(403);
  const res = await app.request('/api/sessions', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  expect(res.status).toBe(201);
  expect(res.headers.get('set-cookie')).toContain('HttpOnly');
  const data = await res.json();
  expect((await app.request(`/api/sessions/${data.session.code}`)).status).toBe(401);
  const cookie = res.headers.get('set-cookie')!.split(';')[0];
  expect(
    (await app.request(`/api/sessions/${data.session.code}`, { headers: { cookie } })).status,
  ).toBe(200);
  expect((await app.request('/api/sessions/ZZZZZZZZ', { headers: { cookie } })).status).toBe(404);
  db.close();
});
