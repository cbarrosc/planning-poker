import { z } from 'zod';
import { scaleSchema, type Scale } from './scales';
import type { Statistics } from './statistics';
const id = z.string().min(1).max(100);
const title = z.string().trim().min(1).max(200);
const description = z.string().max(5000);
export const createSessionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  participantName: z.string().trim().min(1).max(60),
  scale: scaleSchema,
  requestId: z.uuid(),
});
export const joinSessionSchema = z.object({ participantName: z.string().trim().min(1).max(60) });
export const commandSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('task.add'), title, description: description.default('') }),
    z.object({ type: z.literal('task.edit'), taskId: id, title, description }),
    z.object({ type: z.literal('task.reorder'), taskIds: z.array(id).max(500) }),
    z.object({ type: z.literal('task.delete'), taskId: id }),
    z.object({ type: z.literal('task.select'), taskId: id }),
    z.object({ type: z.literal('task.next') }),
    z.object({ type: z.literal('round.open') }),
    z.object({
      type: z.literal('vote.set'),
      choice: z.string().min(1).max(20),
      roundId: z.uuid().optional(),
    }),
    z.object({ type: z.literal('round.reveal') }),
    z.object({ type: z.literal('round.repeat') }),
    z.object({ type: z.literal('round.save'), choice: z.string().min(1).max(20) }),
    z.object({ type: z.literal('round.discard') }),
    z.object({ type: z.literal('scale.set'), scale: scaleSchema }),
    z.object({ type: z.literal('moderator.transfer'), participantId: id }),
    z.object({ type: z.literal('moderator.mode'), voting: z.boolean() }),
    z.object({ type: z.literal('session.close') }),
  ])
  .and(z.object({ expectedRevision: z.number().int().nonnegative(), requestId: z.uuid() }));
export type Command = z.infer<typeof commandSchema>;
export type CommandInput = Command extends infer C
  ? C extends Command
    ? Omit<C, 'expectedRevision' | 'requestId'>
    : never
  : never;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type JoinSessionInput = z.infer<typeof joinSessionSchema>;
export type VoteChoice = string;
export type Actor = { credentialId: string };
export type RoundStatus = 'open' | 'revealed' | 'finalized' | 'discarded';
export interface Task {
  id: string;
  title: string;
  description: string;
  position: number;
  estimate: string | null;
}
export interface Participant {
  id: string;
  name: string;
  online: boolean;
  hasVoted: boolean;
  eligible: boolean;
  vote?: string;
}
export interface Round {
  id: string;
  taskId: string;
  status: RoundStatus;
  scale: Scale;
  facilitatorId: string | null;
  createdAt: string;
  votes?: Record<string, string>;
  statistics?: Statistics;
  ownVote?: string;
  finalEstimate: string | null;
}
export interface SessionSnapshot {
  revision: number;
  selfId: string;
  session: {
    id: string;
    code: string;
    name: string;
    closed: boolean;
    moderatorId: string;
    moderatorVoting: boolean;
    activeTaskId: string | null;
    activeRoundId: string | null;
    scale: Scale;
  };
  participants: Participant[];
  tasks: Task[];
  round: Round | null;
  history: Round[];
}
