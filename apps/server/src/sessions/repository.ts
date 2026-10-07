import type { DatabaseSync } from 'node:sqlite';
import { AppError, type SessionState } from './model';
export class Repository {
  constructor(public db: DatabaseSync) {}
  load(code: string): SessionState {
    const row = this.db.prepare('SELECT state FROM sessions WHERE code=?').get(code) as
      | { state: string }
      | undefined;
    if (!row) throw new AppError(404, 'NOT_FOUND', 'No encontramos esa sesión. Revisa el código.');
    return JSON.parse(row.state);
  }
  save(state: SessionState) {
    this.db
      .prepare(
        'INSERT INTO sessions(id,code,state) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state',
      )
      .run(state.id, state.code, JSON.stringify(state));
  }
  previous(actor: string, requestId: string, fingerprint: string): SessionState | undefined {
    const row = this.db
      .prepare('SELECT fingerprint,result FROM requests WHERE actor=? AND request_id=?')
      .get(actor, requestId) as { fingerprint: string; result: string } | undefined;
    if (!row) return;
    if (row.fingerprint !== fingerprint)
      throw new AppError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'Esta solicitud ya fue usada con otros datos.',
      );
    return JSON.parse(row.result);
  }
  remember(actor: string, requestId: string, fingerprint: string, state: SessionState) {
    this.db
      .prepare('INSERT INTO requests(actor,request_id,fingerprint,result) VALUES(?,?,?,?)')
      .run(actor, requestId, fingerprint, JSON.stringify(state));
  }
}
