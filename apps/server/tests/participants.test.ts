import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/db/database';
import { SessionService } from '../src/sessions/service';
import { FIBONACCI, type Actor, type CommandInput } from '@poker/shared';

function setup() {
  const db = openDatabase(':memory:');
  const service = new SessionService(db);
  const mod = service.identity().actor,
    user = service.identity().actor;
  const initial = service.createSession(mod, {
    name: 'Equipo',
    participantName: 'Ana',
    scale: FIBONACCI,
    requestId: randomUUID(),
  });
  const code = initial.session.code;
  const participantId = service.joinSession(user, code, { participantName: 'Luis' }).selfId;
  const run = (actor: Actor, input: CommandInput) =>
    service.executeCommand(actor, code, {
      ...input,
      requestId: randomUUID(),
      expectedRevision: service.getSnapshot(actor, code).revision,
    });
  return { db, service, mod, user, code, participantId, run };
}

it('solo el moderador expulsa, no a sí mismo; elimina voto abierto y permite reingreso voluntario', () => {
  const { db, service, mod, user, code, participantId, run } = setup();
  try {
    const task = run(mod, { type: 'task.add', title: 'Uno', description: '' }).tasks[0];
    run(mod, { type: 'task.select', taskId: task.id });
    run(mod, { type: 'round.open' });
    run(user, { type: 'vote.set', choice: '8' });
    const modId = service.getSnapshot(mod, code).selfId;
    expect(() => run(user, { type: 'participant.remove', participantId: modId })).toThrow(
      'Solo el moderador',
    );
    expect(() => run(mod, { type: 'participant.remove', participantId: modId })).toThrow(
      'expulsarte',
    );
    const removed = run(mod, { type: 'participant.remove', participantId });
    expect(removed.participants).toHaveLength(1);
    expect(() => service.getSnapshot(user, code)).toThrow('No perteneces');
    expect(run(mod, { type: 'round.reveal' }).round?.votes).toEqual({});
    const rejoined = service.joinSession(user, code, { participantName: 'Luis' });
    expect(rejoined.selfId).not.toBe(participantId);
    expect(rejoined.participants).toHaveLength(2);
  } finally {
    db.close();
  }
});

it('conserva resultados revelados y bloquea incluso reintentos de comandos del expulsado', () => {
  const { db, service, mod, user, code, participantId, run } = setup();
  try {
    const task = run(mod, { type: 'task.add', title: 'Uno', description: '' }).tasks[0];
    run(mod, { type: 'task.select', taskId: task.id });
    run(mod, { type: 'round.open' });
    const command = {
      type: 'vote.set' as const,
      choice: '8',
      requestId: randomUUID(),
      expectedRevision: service.getSnapshot(user, code).revision,
    };
    service.executeCommand(user, code, command);
    run(mod, { type: 'round.reveal' });
    const removed = run(mod, { type: 'participant.remove', participantId });
    expect(removed.round?.statistics?.average).toBe(8);
    expect(removed.history[0].votes?.[participantId]).toBe('8');
    expect(() => service.executeCommand(user, code, command)).toThrow('No perteneces');
  } finally {
    db.close();
  }
});
