import { it, expect } from 'vitest';
import { openDatabase } from '../src/db/database';
import { SessionService } from '../src/sessions/service';
import { createApp } from '../src/app';
it('comprueba salud sin filtrar contenido y mantiene 404 JSON de API', async () => {
  const db = openDatabase(':memory:');
  const app = createApp({ service: new SessionService(db) });
  expect((await app.request('/health')).status).toBe(200);
  const res = await app.request('/api/missing');
  expect(res.status).toBe(404);
  expect(res.headers.get('content-type')).toContain('application/json');
  db.close();
});
