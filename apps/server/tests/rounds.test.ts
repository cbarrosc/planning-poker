import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/db/database';
import { SessionService } from '../src/sessions/service';
import { FIBONACCI, TSHIRT, type CommandInput } from '@poker/shared';
function setup() {
  const db = openDatabase(':memory:');
  const s = new SessionService(db);
  const mod = s.identity().actor,
    user = s.identity().actor;
  const start = s.createSession(mod, {
    name: 'Sprint',
    participantName: 'Ana',
    scale: FIBONACCI,
    requestId: randomUUID(),
  });
  const code = start.session.code;
  s.joinSession(user, code, { participantName: 'Luis' });
  const run = (actor: typeof mod, input: CommandInput) =>
    s.executeCommand(actor, code, {
      ...input,
      expectedRevision: s.getSnapshot(actor, code).revision,
      requestId: randomUUID(),
    });
  return { db, s, mod, user, code, run };
}
it('oculta votos incluso al moderador y bloquea cambios después de revelar', () => {
  const { db, s, mod, user, code, run } = setup();
  expect(() => run(user, { type: 'task.add', title: 'Inyección', description: '' })).toThrow(
    'Solo el moderador',
  );
  let state = run(mod, { type: 'task.add', title: 'Buscador', description: '' });
  const taskId = state.tasks[0].id;
  run(mod, { type: 'task.select', taskId });
  run(mod, { type: 'round.open' });
  expect(() => run(mod, { type: 'round.open' })).toThrow();
  run(user, { type: 'vote.set', choice: '3' });
  run(user, { type: 'vote.set', choice: '5' });
  expect(s.getSnapshot(mod, code).round?.votes).toBeUndefined();
  expect(s.getSnapshot(mod, code).round?.statistics).toBeUndefined();
  expect(s.getSnapshot(mod, code).participants.find((p) => p.name === 'Luis')).not.toHaveProperty(
    'vote',
  );
  expect(s.getSnapshot(user, code).round?.ownVote).toBe('5');
  state = run(mod, { type: 'round.reveal' });
  expect(state.round?.statistics?.average).toBe(5);
  expect(() => run(user, { type: 'vote.set', choice: '8' })).toThrow();
  expect(() => run(mod, { type: 'round.save', choice: '?' })).toThrow();
  state = run(mod, { type: 'round.save', choice: '5' });
  expect(state.tasks[0].estimate).toBe('5');
  db.close();
});
it('repite, cambia escala y conserva historia y estimación anterior', () => {
  const { db, mod, user, run } = setup();
  let state = run(mod, { type: 'task.add', title: 'Perfil', description: '' });
  run(mod, { type: 'task.select', taskId: state.tasks[0].id });
  run(mod, { type: 'round.open' });
  run(user, { type: 'vote.set', choice: '8' });
  run(mod, { type: 'round.reveal' });
  state = run(mod, { type: 'round.repeat' });
  expect(state.history).toHaveLength(1);
  expect(state.round?.ownVote).toBeUndefined();
  run(user, { type: 'vote.set', choice: '3' });
  run(mod, { type: 'round.reveal' });
  run(mod, { type: 'round.save', choice: '3' });
  run(mod, { type: 'scale.set', scale: TSHIRT });
  state = run(mod, { type: 'round.open' });
  expect(state.tasks[0].estimate).toBe('3');
  expect(state.history[0].scale.name).toBe('Fibonacci');
  expect(() => run(user, { type: 'vote.set', choice: '3' })).toThrow();
  run(user, { type: 'vote.set', choice: 'M' });
  state = run(mod, { type: 'round.reveal' });
  expect(state.round?.statistics?.average).toBeUndefined();
  db.close();
});
it('transfiere rol, fija facilitador y exige descarte antes de cerrar', () => {
  const { db, s, mod, user, code, run } = setup();
  let state = run(mod, { type: 'task.add', title: 'Perfil', description: '' });
  run(mod, { type: 'task.select', taskId: state.tasks[0].id });
  run(mod, { type: 'moderator.mode', voting: false });
  run(mod, { type: 'round.open' });
  expect(() => run(mod, { type: 'vote.set', choice: '1' })).toThrow();
  expect(() => run(mod, { type: 'moderator.mode', voting: true })).toThrow();
  expect(() => run(mod, { type: 'session.close' })).toThrow();
  expect(() => run(mod, { type: 'task.delete', taskId: state.tasks[0].id })).toThrow();
  run(mod, { type: 'round.discard' });
  const userId = s.getSnapshot(user, code).selfId;
  state = run(mod, { type: 'moderator.transfer', participantId: userId });
  expect(state.session.moderatorId).toBe(userId);
  expect(() => run(mod, { type: 'task.add', title: 'No', description: '' })).toThrow();
  run(user, { type: 'session.close' });
  expect(() => s.joinSession(s.identity().actor, code, { participantName: 'Nueva' })).toThrow(
    'cerrada',
  );
  db.close();
});
it('reintento idempotente no duplica tarea y rechaza revisión obsoleta', () => {
  const { db, s, mod, code, run } = setup();
  const command = {
    type: 'task.add' as const,
    title: 'Única',
    description: '',
    requestId: randomUUID(),
    expectedRevision: s.getSnapshot(mod, code).revision,
  };
  s.executeCommand(mod, code, command);
  s.executeCommand(mod, code, command);
  expect(s.getSnapshot(mod, code).tasks).toHaveLength(1);
  expect(() => s.executeCommand(mod, code, { ...command, requestId: randomUUID() })).toThrow(
    'cambió',
  );
  const id = s.getSnapshot(mod, code).tasks[0].id;
  expect(() => run(mod, { type: 'task.reorder', taskIds: [id, id] })).toThrow();
  run(mod, { type: 'task.reorder', taskIds: [id] });
  run(mod, { type: 'task.edit', taskId: id, title: 'Editada', description: 'Detalle' });
  expect(s.getSnapshot(mod, code).tasks[0].title).toBe('Editada');
  db.close();
});
it('acepta votos simultáneos de la misma ronda sin confundir una ronda nueva', () => {
  const { db, s, mod, user, code, run } = setup();
  const task = run(mod, { type: 'task.add', title: 'Simultánea', description: '' }).tasks[0];
  run(mod, { type: 'task.select', taskId: task.id });
  const started = run(mod, { type: 'round.open' });
  const common = { expectedRevision: started.revision, roundId: started.round!.id };
  s.executeCommand(mod, code, {
    type: 'vote.set',
    choice: '3',
    requestId: randomUUID(),
    ...common,
  });
  s.executeCommand(user, code, {
    type: 'vote.set',
    choice: '5',
    requestId: randomUUID(),
    ...common,
  });
  expect(run(mod, { type: 'round.reveal' }).round?.statistics?.average).toBe(4);
  run(mod, { type: 'round.repeat' });
  expect(() =>
    s.executeCommand(user, code, {
      type: 'vote.set',
      choice: '8',
      requestId: randomUUID(),
      ...common,
    }),
  ).toThrow();
  db.close();
});
it('serializa voto y revelado entre dos conexiones SQLite', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'poker-race-'));
  try {
    const db = openDatabase(join(dir, 'db.sqlite')),
      db2 = openDatabase(join(dir, 'db.sqlite'));
    const a = new SessionService(db),
      b = new SessionService(db2);
    const mod = a.identity().actor,
      user = b.identity().actor;
    const first = a.createSession(mod, {
      name: 'Race',
      participantName: 'Mod',
      scale: FIBONACCI,
      requestId: randomUUID(),
    });
    const code = first.session.code;
    b.joinSession(user, code, { participantName: 'Voter' });
    const run = (s: SessionService, actor: typeof mod, input: CommandInput) =>
      s.executeCommand(actor, code, {
        ...input,
        expectedRevision: s.getSnapshot(actor, code).revision,
        requestId: randomUUID(),
      });
    const task = run(a, mod, { type: 'task.add', title: 'Race', description: '' }).tasks[0];
    run(a, mod, { type: 'task.select', taskId: task.id });
    run(a, mod, { type: 'round.open' });
    run(b, user, { type: 'vote.set', choice: '8' });
    expect(run(a, mod, { type: 'round.reveal' }).round?.statistics?.average).toBe(8);
    expect(() => run(b, user, { type: 'vote.set', choice: '1' })).toThrow();
    db.close();
    db2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
