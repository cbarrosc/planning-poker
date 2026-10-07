import type { RoundStatus, Scale, Task } from '@poker/shared';
export interface StoredParticipant {
  id: string;
  credentialId: string;
  name: string;
}
export interface StoredRound {
  id: string;
  taskId: string;
  status: RoundStatus;
  scale: Scale;
  facilitatorId: string | null;
  createdAt: string;
  votes: Record<string, string>;
  finalEstimate: string | null;
}
export interface SessionState {
  id: string;
  code: string;
  name: string;
  closed: boolean;
  revision: number;
  moderatorId: string;
  moderatorVoting: boolean;
  activeTaskId: string | null;
  activeRoundId: string | null;
  scale: Scale;
  participants: StoredParticipant[];
  tasks: Task[];
  rounds: StoredRound[];
}
export class AppError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 429,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function requireState(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AppError(409, 'CONFLICT', message);
}
