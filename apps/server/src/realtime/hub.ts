import type { WebSocket } from 'ws';
import type { Actor } from '@poker/shared';
import type { SessionService } from '../sessions/service';
interface Connection {
  ws: WebSocket;
  code: string;
  actor: Actor;
  participantId: string;
  alive: boolean;
}
export function createHub(service: SessionService) {
  const connections = new Set<Connection>();
  let sequence = 0;
  function publish(code: string) {
    const eventSequence = ++sequence;
    for (const c of connections) {
      if (c.code !== code || c.ws.readyState !== 1) continue;
      try {
        c.ws.send(
          JSON.stringify({
            type: 'snapshot',
            sequence: eventSequence,
            data: service.getSnapshot(c.actor, code),
          }),
        );
      } catch {
        c.ws.terminate();
      }
    }
  }
  service.isOnline = (id) => [...connections].some((c) => c.participantId === id);
  service.onSessionChanged = publish;
  const heartbeat = setInterval(() => {
    for (const c of connections) {
      if (!c.alive) {
        c.ws.terminate();
        continue;
      }
      c.alive = false;
      c.ws.ping();
    }
  }, 30000);
  heartbeat.unref();
  return {
    publish,
    connect(ws: WebSocket, code: string, actor: Actor) {
      const participantId = service.getSnapshot(actor, code).selfId;
      const connection: Connection = { ws, code, actor, participantId, alive: true };
      connections.add(connection);
      ws.on('pong', () => {
        connection.alive = true;
      });
      ws.on('error', () => ws.terminate());
      ws.once('close', () => {
        connections.delete(connection);
        publish(code);
      });
      publish(code);
    },
    close() {
      clearInterval(heartbeat);
      for (const c of connections) c.ws.terminate();
      connections.clear();
      service.onSessionChanged = () => {};
      service.isOnline = () => false;
    },
  };
}
