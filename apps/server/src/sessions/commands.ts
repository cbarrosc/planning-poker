import { randomUUID } from 'node:crypto';
import type { Actor, Command } from '@poker/shared';
import { AppError, requireState, type SessionState, type StoredRound } from './model';
export function applyCommand(state: SessionState, actor: Actor, command: Command): void {
  const self = state.participants.find((p) => p.credentialId === actor.credentialId);
  if (!self) throw new AppError(403, 'FORBIDDEN', 'No perteneces a esta sesión.');
  if (state.closed) throw new AppError(409, 'CLOSED', 'La sesión está cerrada.');
  if (command.type !== 'vote.set' && state.moderatorId !== self.id)
    throw new AppError(403, 'FORBIDDEN', 'Solo el moderador puede hacer esto.');
  const round = state.rounds.find((r) => r.id === state.activeRoundId);
  const independentVote =
    command.type === 'vote.set' &&
    command.roundId === round?.id &&
    round?.status === 'open' &&
    command.expectedRevision <= state.revision;
  requireState(
    command.expectedRevision === state.revision || independentVote,
    'La sesión cambió. Revisa el estado y vuelve a intentarlo.',
  );
  const notOpen = () =>
    requireState(round?.status !== 'open', 'Primero revela o descarta la votación abierta.');
  const task = (id: string) => {
    const t = state.tasks.find((t) => t.id === id);
    requireState(t, 'La tarea no existe.');
    return t;
  };
  const open = () => {
    requireState(state.activeTaskId, 'Selecciona una tarea primero.');
    task(state.activeTaskId);
    requireState(
      !round || round.status === 'finalized' || round.status === 'discarded',
      'Termina o descarta la ronda anterior.',
    );
    const next: StoredRound = {
      id: randomUUID(),
      taskId: state.activeTaskId,
      status: 'open',
      scale: structuredClone(state.scale),
      facilitatorId: state.moderatorVoting ? null : state.moderatorId,
      createdAt: new Date().toISOString(),
      votes: {},
      finalEstimate: null,
    };
    state.rounds.push(next);
    state.activeRoundId = next.id;
  };
  switch (command.type) {
    case 'task.add':
      requireState(state.tasks.length < 500, 'La sesión permite hasta 500 tareas.');
      state.tasks.push({
        id: randomUUID(),
        title: command.title,
        description: command.description,
        position: state.tasks.length,
        estimate: null,
      });
      break;
    case 'task.edit':
      Object.assign(task(command.taskId), {
        title: command.title,
        description: command.description,
      });
      break;
    case 'task.reorder': {
      requireState(
        command.taskIds.length === state.tasks.length &&
          new Set(command.taskIds).size === state.tasks.length &&
          command.taskIds.every((id) => state.tasks.some((t) => t.id === id)),
        'El orden debe incluir cada tarea exactamente una vez.',
      );
      state.tasks = command.taskIds.map((id, position) => ({ ...task(id), position }));
      break;
    }
    case 'task.delete':
      task(command.taskId);
      requireState(
        !(round?.status === 'open' && round.taskId === command.taskId),
        'No puedes eliminar la tarea activa durante la votación.',
      );
      state.tasks = state.tasks
        .filter((t) => t.id !== command.taskId)
        .map((t, position) => ({ ...t, position }));
      state.rounds = state.rounds.filter((r) => r.taskId !== command.taskId);
      if (state.activeTaskId === command.taskId) {
        state.activeTaskId = null;
        state.activeRoundId = null;
      }
      break;
    case 'task.select':
      notOpen();
      task(command.taskId);
      state.activeTaskId = command.taskId;
      state.activeRoundId = null;
      break;
    case 'task.next': {
      notOpen();
      const index = state.tasks.findIndex((t) => t.id === state.activeTaskId);
      const pending = [...state.tasks.slice(index + 1), ...state.tasks.slice(0, index + 1)].find(
        (t) => t.estimate === null && t.id !== state.activeTaskId,
      );
      state.activeTaskId = pending?.id ?? null;
      state.activeRoundId = null;
      break;
    }
    case 'round.open':
      open();
      break;
    case 'vote.set':
      requireState(round?.status === 'open', 'No hay una votación abierta.');
      requireState(round.facilitatorId !== self.id, 'Estás facilitando esta ronda sin votar.');
      requireState(
        !command.roundId || command.roundId === round.id,
        'La ronda cambió. Vuelve a elegir tu carta.',
      );
      requireState(
        command.choice === '?' ||
          command.choice === '☕' ||
          round.scale.cards.some((c) => c.label === command.choice),
        'La carta no pertenece a esta escala.',
      );
      round.votes[self.id] = command.choice;
      break;
    case 'round.reveal':
      requireState(round?.status === 'open', 'No hay una votación abierta.');
      round.status = 'revealed';
      break;
    case 'round.repeat': {
      requireState(round?.status === 'revealed', 'Primero revela la ronda.');
      const next: StoredRound = {
        id: randomUUID(),
        taskId: round.taskId,
        status: 'open',
        scale: structuredClone(state.scale),
        facilitatorId: state.moderatorVoting ? null : state.moderatorId,
        createdAt: new Date().toISOString(),
        votes: {},
        finalEstimate: null,
      };
      state.rounds.push(next);
      state.activeRoundId = next.id;
      break;
    }
    case 'round.save':
      requireState(round?.status === 'revealed', 'Primero revela la ronda.');
      requireState(
        round.scale.cards.some((c) => c.label === command.choice),
        'Elige una estimación de la escala.',
      );
      round.finalEstimate = command.choice;
      round.status = 'finalized';
      task(round.taskId).estimate = command.choice;
      break;
    case 'round.discard':
      requireState(
        round && (round.status === 'open' || round.status === 'revealed'),
        'No hay una ronda para descartar.',
      );
      round.status = 'discarded';
      state.activeRoundId = null;
      break;
    case 'scale.set':
      notOpen();
      state.scale = command.scale;
      break;
    case 'moderator.mode':
      notOpen();
      state.moderatorVoting = command.voting;
      break;
    case 'moderator.transfer':
      requireState(
        state.participants.some((p) => p.id === command.participantId),
        'Ese participante no existe.',
      );
      state.moderatorId = command.participantId;
      break;
    case 'session.close':
      notOpen();
      state.closed = true;
      break;
  }
  state.revision++;
}
