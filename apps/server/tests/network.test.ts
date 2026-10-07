import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { FIBONACCI } from '../../../packages/shared/src/index';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db/database';
import { SessionService } from '../src/sessions/service';

it.each([
  {
    url: 'http://192.168.1.154:3000',
    origin: undefined,
    allowed: 'http://192.168.1.154:3000',
    secureCookie: false,
  },
  {
    url: 'http://localhost:3000',
    origin: 'https://poker.example.com',
    allowed: 'https://poker.example.com',
    secureCookie: true,
  },
])(
  'acepta el origen configurado y rechaza otros: $allowed',
  async ({ url, origin, allowed, secureCookie }) => {
    const db = openDatabase(':memory:');
    try {
      const app = createApp({ service: new SessionService(db), origin, secureCookie });
      const body = JSON.stringify({
        name: 'Red',
        participantName: 'Ana',
        scale: FIBONACCI,
        requestId: randomUUID(),
      });
      const send = (requestOrigin: string) =>
        app.request(`${url}/api/sessions`, {
          method: 'POST',
          headers: { origin: requestOrigin, 'content-type': 'application/json' },
          body,
        });
      expect((await send('https://otro.example.com')).status).toBe(403);
      const response = await send(allowed);
      expect(response.status).toBe(201);
      expect(response.headers.get('set-cookie')!.includes('; Secure')).toBe(secureCookie);
    } finally {
      db.close();
    }
  },
);
