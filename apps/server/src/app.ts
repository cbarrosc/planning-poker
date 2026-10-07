import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { getConnInfo } from '@hono/node-server/conninfo';
import { ZodError } from 'zod';
import { commandSchema, createSessionSchema, joinSessionSchema, type Actor } from '@poker/shared';
import { SessionService } from './sessions/service';
import { AppError } from './sessions/model';
import { serveStatic } from '@hono/node-server/serve-static';
import { join } from 'node:path';
export interface AppDependencies {
  service: SessionService;
  origin?: string;
  secureCookie?: boolean;
  webRoot?: string;
}
export type AppEnv = { Variables: { actor: Actor } };
export function createApp({ service, origin, secureCookie = false, webRoot }: AppDependencies) {
  const app = new Hono<AppEnv>();
  app.get('/health', (c) => {
    service.db.prepare('SELECT 1').get();
    return c.json({ status: 'ok' });
  });
  app.use('*', secureHeaders());
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: 32768,
      onError: (c) =>
        c.json({ error: { code: 'TOO_LARGE', message: 'La solicitud es demasiado grande.' } }, 400),
    }),
  );
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    if (c.req.method !== 'GET' || c.req.path.endsWith('/ws')) {
      const expected = origin ?? new URL(c.req.url).origin;
      if (c.req.header('origin') !== expected)
        throw new AppError(403, 'ORIGIN', 'El origen de la solicitud no es válido.');
    }
    await next();
  });
  const windows = new Map<string, { count: number; until: number }>();
  app.use('/api/*', async (c, next) => {
    if (
      c.req.method === 'POST' &&
      (c.req.path === '/api/sessions' || c.req.path.endsWith('/join'))
    ) {
      let ip = 'local';
      try {
        ip = getConnInfo(c).remote.address ?? ip;
      } catch {
        /* in-process tests */
      }
      const key = ip + (c.req.path === '/api/sessions' ? ':create' : ':join');
      const now = Date.now();
      if (windows.size > 10000) for (const [k, v] of windows) if (v.until < now) windows.delete(k);
      let bucket = windows.get(key);
      if (!bucket || bucket.until < now) {
        bucket = { count: 0, until: now + 60000 };
        windows.set(key, bucket);
      }
      if (++bucket.count > (key.endsWith(':create') ? 10 : 60))
        throw new AppError(429, 'RATE_LIMIT', 'Demasiados intentos. Espera un minuto.');
    }
    await next();
  });
  const establish = (c: Parameters<typeof getCookie>[0], required: boolean) => {
    const identity = service.identity(getCookie(c, 'poker_identity'), required);
    if (!required)
      setCookie(c, 'poker_identity', identity.token, {
        httpOnly: true,
        sameSite: 'Lax',
        secure: secureCookie,
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
    return identity.actor;
  };
  app.get('/api/identity', (c) => {
    establish(c, false);
    return c.json({ ok: true });
  });
  app.post('/api/sessions', async (c) => {
    const input = createSessionSchema.parse(await c.req.json());
    const actor = establish(c, false);
    return c.json(service.createSession(actor, input), 201);
  });
  app.post('/api/sessions/:code/join', async (c) => {
    const input = joinSessionSchema.parse(await c.req.json());
    const actor = establish(c, false);
    return c.json(service.joinSession(actor, c.req.param('code').toUpperCase(), input));
  });
  app.use('/api/sessions/:code/*', async (c, next) => {
    c.set('actor', establish(c, true));
    await next();
  });
  app.get('/api/sessions/:code', (c) =>
    c.json(service.getSnapshot(establish(c, true), c.req.param('code').toUpperCase())),
  );
  app.post('/api/sessions/:code/commands', async (c) =>
    c.json(
      service.executeCommand(
        c.get('actor'),
        c.req.param('code').toUpperCase(),
        commandSchema.parse(await c.req.json()),
      ),
    ),
  );
  if (webRoot) {
    app.get('*', async (c, next) => {
      if (c.req.path.startsWith('/api/')) return next();
      return serveStatic({ root: webRoot })(c, next);
    });
    app.get('*', async (c, next) => {
      if (c.req.path.startsWith('/api/')) return next();
      if (c.req.path === '/' || /^\/s\/[A-Z2-9]{8}\/?$/i.test(c.req.path))
        return serveStatic({ path: join(webRoot, 'index.html') })(c, next);
      return next();
    });
  }
  app.onError((error, c) => {
    if (error instanceof AppError)
      return c.json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof ZodError || error instanceof SyntaxError)
      return c.json(
        { error: { code: 'INVALID', message: 'Revisa los campos: hay datos inválidos.' } },
        400,
      );
    console.error('Error interno', error.name);
    return c.json(
      { error: { code: 'INTERNAL', message: 'No pudimos completar la solicitud.' } },
      500,
    );
  });
  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada.' } }, 404),
  );
  return app;
}
