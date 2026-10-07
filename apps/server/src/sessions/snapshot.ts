import { calculateStatistics, type Actor, type Round, type SessionSnapshot } from '@poker/shared';
import { AppError, type SessionState, type StoredRound } from './model';
export function snapshot(
  state: SessionState,
  actor: Actor,
  online: (id: string) => boolean = () => false,
): SessionSnapshot {
  const self = state.participants.find((p) => p.credentialId === actor.credentialId);
  if (!self) throw new AppError(403, 'FORBIDDEN', 'No perteneces a esta sesión.');
  const current = state.rounds.find((r) => r.id === state.activeRoundId);
  function visible(r: StoredRound): Round {
    const { votes, ...rest } = r;
    const base: Round = { ...rest, ownVote: votes[self!.id] };
    if (r.status === 'revealed' || r.status === 'finalized') {
      base.votes = votes;
      base.statistics = calculateStatistics(r.scale, Object.values(votes));
    }
    return base;
  }
  const { participants, tasks, rounds, revision, ...session } = state;
  return {
    revision,
    selfId: self.id,
    session,
    tasks,
    round: current ? visible(current) : null,
    history: rounds.filter((r) => r.status === 'revealed' || r.status === 'finalized').map(visible),
    participants: participants.map((p) => {
      const vote = current?.votes[p.id];
      return {
        id: p.id,
        name: p.name,
        online: online(p.id),
        eligible: current
          ? p.id !== current.facilitatorId
          : p.id !== state.moderatorId || state.moderatorVoting,
        hasVoted: vote !== undefined,
        ...(current &&
        (current.status === 'revealed' || current.status === 'finalized') &&
        vote !== undefined
          ? { vote }
          : {}),
      };
    }),
  };
}
