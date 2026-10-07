import { resolve } from 'node:path';
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido');
  const origin = env.PUBLIC_ORIGIN ? new URL(env.PUBLIC_ORIGIN).origin : undefined;
  if (env.COOKIE_SECURE && !['true', 'false'].includes(env.COOKIE_SECURE))
    throw new Error('COOKIE_SECURE debe ser true o false');
  return {
    port,
    origin,
    secureCookie: env.COOKIE_SECURE === 'true',
    databasePath: env.DATABASE_PATH ?? resolve('data/poker.sqlite'),
    webRoot: resolve(env.WEB_ROOT ?? 'apps/web/dist'),
  };
}
