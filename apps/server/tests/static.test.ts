import { it, expect } from 'vitest';
import { openDatabase } from '../src/db/database';
import { SessionService } from '../src/sessions/service';
import { createApp } from '../src/app';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
it('sirve navegación SPA pero nunca reemplaza API desconocida con HTML', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'poker-static-'));
  const db = openDatabase(':memory:');
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Planning Poker</title>');
  try {
    const app = createApp({ service: new SessionService(db), webRoot: dir });
    const res = await app.request('/s/ABCDEFGH');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Planning Poker');
    const bad = await app.request('/api/missing');
    expect(bad.status).toBe(404);
    expect(bad.headers.get('content-type')).toContain('application/json');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
