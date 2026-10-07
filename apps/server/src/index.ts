import { openDatabase } from './db/database';
import { SessionService } from './sessions/service';
import { startServer } from './runtime';
import { readConfig } from './config';
const config = readConfig();
const db = openDatabase(config.databasePath);
const runtime = await startServer({ ...config, service: new SessionService(db) });
console.log(`Planning Poker disponible en http://localhost:${runtime.port}`);
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    void runtime
      .close()
      .then(() => {
        db.close();
        clearTimeout(timeout);
        process.exit(0);
      })
      .catch(() => process.exit(1));
  });
