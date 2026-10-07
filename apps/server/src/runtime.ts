import { serve, upgradeWebSocket } from '@hono/node-server';
import { WebSocketServer, type WebSocket } from 'ws';
import { createApp, type AppDependencies } from './app';
import { createHub } from './realtime/hub';
import type { Server } from 'node:http';
export async function startServer(deps: AppDependencies & { port: number; host?: string }) {
  const app = createApp(deps);
  const hub = createHub(deps.service);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 32768 });
  app.get('/api/sessions/:code/ws', (c, next) => {
    const code = c.req.param('code').toUpperCase();
    const actor = c.get('actor');
    deps.service.getSnapshot(actor, code);
    return upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        hub.connect(ws.raw as WebSocket, code, actor);
      },
    }))(c, next);
  });
  const server = serve({
    fetch: app.fetch,
    port: deps.port,
    hostname: deps.host ?? '0.0.0.0',
    websocket: { server: wss },
  });
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const port = (server.address() as { port: number }).port;
  return {
    app,
    port,
    close: async () => {
      hub.close();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        (server as Server).closeAllConnections();
      });
    },
  };
}
