import { useState } from 'react';
import {
  Copy,
  Check,
  Leaf,
  ListTodo,
  LockKeyhole,
  WifiOff,
  Users,
  ArrowLeft,
  Coffee,
} from 'lucide-react';
import { useSession } from '../useSession';
import { Brand } from './Brand';
import { Home } from './Home';
import { Participants } from './Participants';
import { VotingDeck } from './VotingDeck';
import { Results } from './Results';
import { TaskList } from './TaskList';
import { ModeratorControls } from './ModeratorControls';
export function Session({ code }: { code: string }) {
  const {
    snapshot: state,
    loading,
    joinNeeded,
    error,
    setError,
    connected,
    busy,
    send,
    accept,
  } = useSession(code);
  const [tasksOpen, setTasksOpen] = useState(false),
    [copied, setCopied] = useState(false);
  if (joinNeeded) return <Home code={code} onJoined={accept} />;
  if (loading)
    return (
      <div className="loading-page">
        <Brand />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-table" />
        <p>Preparando la mesa…</p>
      </div>
    );
  if (!state)
    return (
      <div className="error-page">
        <Brand />
        <h1>No pudimos abrir la sesión</h1>
        <p role="alert">{error}</p>
        <a className="primary" href="/">
          <ArrowLeft size={17} /> Volver al inicio
        </a>
      </div>
    );
  const moderator = state.selfId === state.session.moderatorId && !state.session.closed;
  const task = state.tasks.find((t) => t.id === state.session.activeTaskId);
  const round = state.round;
  const eligible = state.participants.filter((p) => p.eligible),
    voted = eligible.filter((p) => p.hasVoted).length;
  const canVote =
    round?.status === 'open' &&
    state.selfId !== round.facilitatorId &&
    connected &&
    !busy &&
    !state.session.closed;
  const disabled = !connected || busy || state.session.closed;
  async function copy() {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(`Comparte este código: ${code}`);
    }
  }
  const revealed = round?.status === 'revealed' || round?.status === 'finalized';
  return (
    <div className="session-shell">
      <header className="session-header">
        <Brand />
        <div className="session-heading">
          <h1>{state.session.name}</h1>
          <span className="session-code">{code}</span>
        </div>
        <div className="header-actions">
          <span className={`connection ${connected ? 'connected' : ''}`}>
            {connected ? (
              <>
                <span /> En línea
              </>
            ) : (
              <>
                <WifiOff size={14} /> Reconectando
              </>
            )}
          </span>
          <button className="secondary share" onClick={() => void copy()}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copiado' : 'Copiar enlace'}</span>
          </button>
          <button
            className="icon-button mobile-only"
            onClick={() => setTasksOpen(true)}
            aria-label="Abrir tareas"
          >
            <ListTodo size={21} />
          </button>
        </div>
      </header>
      {!connected && (
        <div className="connection-banner" role="status">
          Estamos reconectando. Tus votos están guardados; podrás continuar al recuperar la
          conexión.
        </div>
      )}
      {error && (
        <div className="error session-error" role="alert">
          {error}
          <button className="text-button" onClick={() => setError('')}>
            Cerrar aviso
          </button>
        </div>
      )}
      {state.session.closed && (
        <div className="closed-banner">
          <LockKeyhole size={16} /> Sesión cerrada. Los resultados siguen disponibles para el
          equipo.
        </div>
      )}
      <div className="session-layout">
        <main className="session-main">
          <div className="workspace-topline">
            <span>
              <Users size={15} />
              {state.participants.length}{' '}
              {state.participants.length === 1 ? 'persona en el equipo' : 'personas en el equipo'}
            </span>
            <span className="scale-pill">{round?.scale.name ?? state.session.scale.name}</span>
          </div>
          <section className="active-task">
            <div>
              <h2>
                {task?.title ??
                  (state.tasks.length ? 'Todo listo por ahora' : 'La mesa está lista')}
              </h2>
              {task?.description ? (
                <p className="task-description">{task.description}</p>
              ) : (
                <p>
                  {task
                    ? round?.status === 'open'
                      ? 'Elige tu estimación. Cada perspectiva cuenta.'
                      : revealed
                      ? 'Es momento de conversar sobre las estimaciones.'
                      : 'Cuando estén listos, comencemos la votación.'
                    : moderator
                    ? state.tasks.length
                      ? 'Selecciona una tarea pendiente para continuar.'
                      : 'Agrega la primera tarea y reúne a tu equipo.'
                    : 'El moderador seleccionará una tarea para empezar.'}
                </p>
              )}
            </div>
            <span className="task-flourish" aria-hidden="true">
              <Leaf size={34} />
            </span>
          </section>
          <Participants state={state} />
          <div className="voting-status" role="status">
            {round?.status === 'open' ? (
              <>
                <span className="status-dot" />
                {voted} de {eligible.length} han votado
              </>
            ) : revealed ? (
              <>
                <Check size={16} />{' '}
                {round.status === 'finalized'
                  ? `Estimación guardada: ${round.finalEstimate}`
                  : 'Cartas reveladas. Hablemos de las diferencias.'}
              </>
            ) : (
              <>
                <Leaf size={16} /> Un espacio para pensar juntos
              </>
            )}
          </div>
          {moderator ? (
            <ModeratorControls
              key={round?.id ?? 'idle'}
              state={state}
              disabled={disabled}
              send={send}
            />
          ) : round?.status === 'open' ? (
            <p className="waiting-note">
              <LockKeyhole size={14} /> Tu voto es privado hasta que el moderador revele las cartas.
            </p>
          ) : (
            !state.session.closed && (
              <p className="waiting-note">
                {revealed
                  ? 'El moderador elegirá la estimación final.'
                  : 'Esperando al moderador para empezar.'}
              </p>
            )
          )}
          {revealed && round && <Results round={round} missing={eligible.length - voted} />}
          <section className="deck-section">
            <div className="deck-heading">
              <h3>{round?.status === 'open' ? 'Tu estimación' : 'Tus cartas'}</h3>
              <span>
                {round?.ownVote ? (
                  <>Elegiste {round.ownVote === '☕' ? <Coffee size={15} /> : round.ownVote}</>
                ) : (
                  '? si tienes dudas · café si necesitas una pausa'
                )}
              </span>
            </div>
            <VotingDeck
              scale={round?.scale ?? state.session.scale}
              selected={round?.ownVote}
              disabled={!canVote}
              onVote={(choice) => void send({ type: 'vote.set', choice, roundId: round?.id })}
            />
          </section>
          {state.history.length > 0 && (
            <details className="round-history">
              <summary>Historial de rondas ({state.history.length})</summary>
              <div className="history-list">
                {[...state.history].reverse().map((r, i) => (
                  <div key={r.id}>
                    <span>
                      {state.tasks.find((t) => t.id === r.taskId)?.title ?? 'Tarea'}
                      <small>
                        {r.scale.name} ·{' '}
                        {new Date(r.createdAt).toLocaleTimeString('es-CL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </span>
                    <strong>{r.finalEstimate ?? 'Sin guardar'}</strong>
                    <details>
                      <summary>Ver votos</summary>
                      <p>
                        {Object.entries(r.votes ?? {})
                          .map(
                            ([id, v]) =>
                              `${
                                state.participants.find((p) => p.id === id)?.name ?? 'Participante'
                              }: ${v}`,
                          )
                          .join(' · ') || 'Sin votos'}
                      </p>
                    </details>
                  </div>
                ))}
              </div>
            </details>
          )}
          <footer className="session-footer">
            <Leaf size={13} /> Las cartas abren la conversación.
          </footer>
        </main>
        {tasksOpen && (
          <button
            className="sidebar-scrim"
            onClick={() => setTasksOpen(false)}
            aria-label="Cerrar panel de tareas"
          />
        )}
        <aside
          className={`task-sidebar ${tasksOpen ? 'is-open' : ''}`}
          aria-label="Lista de tareas"
        >
          <TaskList
            state={state}
            disabled={disabled}
            send={send}
            onClose={() => setTasksOpen(false)}
          />
        </aside>
      </div>
    </div>
  );
}
