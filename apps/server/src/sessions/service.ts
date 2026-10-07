import { randomBytes, randomUUID, createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type {
  Actor,
  Command,
  CreateSessionInput,
  JoinSessionInput,
  SessionSnapshot,
} from '@poker/shared';
import { commandSchema } from '@poker/shared';
import { transaction } from '../db/database';
import { Repository } from './repository';
import { snapshot } from './snapshot';
import { AppError, type SessionState } from './model';
import { applyCommand } from './commands';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export class SessionService {
  readonly repo: Repository;
  onSessionChanged: (code: string) => void = () => {};
  isOnline: (participantId: string) => boolean = () => false;
  constructor(readonly db: DatabaseSync) {
    this.repo = new Repository(db);
  }
  identity(token?: string, required = false): { actor: Actor; token: string } {
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const row = this.db.prepare('SELECT id FROM credentials WHERE hash=?').get(hash(token)) as
        | { id: string }
        | undefined;
      if (row) return { actor: { credentialId: row.id }, token };
    }
    if (required) throw new AppError(401, 'UNAUTHORIZED', 'Ingresa a la sesión para continuar.');
    token = randomBytes(32).toString('hex');
    const id = randomUUID();
    this.db.prepare('INSERT INTO credentials(id,hash) VALUES(?,?)').run(id, hash(token));
    return { actor: { credentialId: id }, token };
  }
  getSnapshot(actor: Actor, code: string) {
    return snapshot(this.repo.load(code), actor, this.isOnline);
  }
  executeCommand(actor: Actor, code: string, input: Command): SessionSnapshot {
    const command = commandSchema.parse(input);
    const fingerprint = JSON.stringify({ code, ...command });
    const state = transaction(this.db, () => {
      const prior = this.repo.previous(actor.credentialId, command.requestId, fingerprint);
      if (prior) return prior;
      const current = this.repo.load(code);
      applyCommand(current, actor, command);
      this.repo.save(current);
      this.repo.remember(actor.credentialId, command.requestId, fingerprint, current);
      return current;
    });
    this.onSessionChanged(code);
    return snapshot(state, actor, this.isOnline);
  }
  createSession(actor: Actor, input: CreateSessionInput): SessionSnapshot {
    const fingerprint = JSON.stringify(input);
    const state = transaction(this.db, () => {
      const prior = this.repo.previous(actor.credentialId, input.requestId, fingerprint);
      if (prior) return prior;
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code: string;
      do {
        code = Array.from(randomBytes(8), (v) => alphabet[v % alphabet.length]).join('');
      } while (this.db.prepare('SELECT id FROM sessions WHERE code=?').get(code));
      const participantId = randomUUID();
      const state: SessionState = {
        id: randomUUID(),
        code,
        name: input.name,
        closed: false,
        revision: 0,
        moderatorId: participantId,
        moderatorVoting: true,
        activeTaskId: null,
        activeRoundId: null,
        scale: input.scale,
        participants: [
          { id: participantId, name: input.participantName, credentialId: actor.credentialId },
        ],
        tasks: [],
        rounds: [],
      };
      this.repo.save(state);
      this.repo.remember(actor.credentialId, input.requestId, fingerprint, state);
      return state;
    });
    return snapshot(state, actor, this.isOnline);
  }
  joinSession(actor: Actor, code: string, input: JoinSessionInput): SessionSnapshot {
    const state = transaction(this.db, () => {
      const state = this.repo.load(code);
      if (state.participants.some((p) => p.credentialId === actor.credentialId)) return state;
      if (state.closed) throw new AppError(409, 'CLOSED', 'La sesión está cerrada.');
      state.participants.push({
        id: randomUUID(),
        name: input.participantName,
        credentialId: actor.credentialId,
      });
      state.revision++;
      this.repo.save(state);
      return state;
    });
    this.onSessionChanged(code);
    return snapshot(state, actor, this.isOnline);
  }
}
