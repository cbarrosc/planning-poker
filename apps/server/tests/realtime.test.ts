import { it, expect } from 'vitest';
import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/db/database';
import { SessionService } from '../src/sessions/service';
import { startServer } from '../src/runtime';
import { FIBONACCI, type SessionSnapshot, type CommandInput } from '@poker/shared';

it('sincroniza instantáneas privadas, cuenta pestañas y aísla sesiones', async () => {
  const db = openDatabase(':memory:');
  const service = new SessionService(db);
  const a = service.identity(),
    b = service.identity();
  const initial = service.createSession(a.actor, {
    name: 'WS',
    participantName: 'Ana',
    scale: FIBONACCI,
    requestId: randomUUID(),
  });
  const code = initial.session.code;
  service.joinSession(b.actor, code, { participantName: 'Luis' });
  const other = service.createSession(a.actor, {
    name: 'Otra',
    participantName: 'Ana',
    scale: FIBONACCI,
    requestId: randomUUID(),
  });
  const server = await startServer({ service, port: 0, origin: undefined });
  const origin = `http://localhost:${server.port}`;
  const sockets: WebSocket[] = [];
  const updates: SessionSnapshot[][] = [];
  const connect = async (token: string, code: string) => {
    const index = updates.push([]) - 1;
    const ws = new WebSocket(`${origin.replace('http', 'ws')}/api/sessions/${code}/ws`, {
      headers: { cookie: `poker_identity=${token}`, origin },
    });
    sockets.push(ws);
    ws.on('message', (data) => updates[index].push(JSON.parse(data.toString()).data));
    await new Promise<void>((resolve, reject) => {
      ws.once('message', () => resolve());
      ws.once('error', reject);
    });
    return { ws, messages: updates[index] };
  };
  const wait = async (check: () => boolean) => {
    const until = Date.now() + 3000;
    while (!check()) {
      if (Date.now() > until) throw new Error('WebSocket update timeout');
      await new Promise((r) => setTimeout(r, 10));
    }
  };
  try {
    const first = await connect(a.token, code),
      second = await connect(a.token, code),
      voter = await connect(b.token, code),
      isolated = await connect(a.token, other.session.code);
    expect(first.messages.at(-1)!.participants.filter((p) => p.id === initial.selfId)).toHaveLength(
      1,
    );
    first.ws.close();
    await wait(() => first.ws.readyState === WebSocket.CLOSED);
    expect(
      service.getSnapshot(a.actor, code).participants.find((p) => p.id === initial.selfId)?.online,
    ).toBe(true);
    const run = (input: CommandInput) =>
      service.executeCommand(a.actor, code, {
        ...input,
        requestId: randomUUID(),
        expectedRevision: service.getSnapshot(a.actor, code).revision,
      });
    const task = run({ type: 'task.add', title: 'Buscador', description: '' }).tasks[0];
    run({ type: 'task.select', taskId: task.id });
    run({ type: 'round.open' });
    service.executeCommand(b.actor, code, {
      type: 'vote.set',
      choice: '8',
      requestId: randomUUID(),
      expectedRevision: service.getSnapshot(b.actor, code).revision,
    });
    await wait(
      () =>
        second.messages.at(-1)?.participants.some((p) => p.name === 'Luis' && p.hasVoted) ?? false,
    );
    expect(second.messages.at(-1)!.round?.votes).toBeUndefined();
    expect(voter.messages.at(-1)!.round?.ownVote).toBe('8');
    const otherCount = isolated.messages.length;
    run({ type: 'round.reveal' });
    await wait(() => second.messages.at(-1)?.round?.status === 'revealed');
    expect(Object.values(second.messages.at(-1)!.round!.votes!)).toEqual(['8']);
    expect(isolated.messages).toHaveLength(otherCount);
    second.ws.close();
    await wait(
      () =>
        !service.getSnapshot(a.actor, code).participants.find((p) => p.id === initial.selfId)
          ?.online,
    );
  } finally {
    for (const ws of sockets) ws.terminate();
    await server.close();
    db.close();
  }
}, 10000);
