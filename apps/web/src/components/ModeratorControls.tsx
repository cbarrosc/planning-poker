import { useEffect, useState } from 'react';
import { Eye, RotateCcw, ArrowRight, Check, Play, X } from 'lucide-react';
import type { CommandInput, SessionSnapshot } from '@poker/shared';
import { ScaleEditor } from './ScaleEditor';
export function ModeratorControls({
  state,
  disabled,
  send,
}: {
  state: SessionSnapshot;
  disabled: boolean;
  send: (c: CommandInput) => Promise<boolean>;
}) {
  const [estimate, setEstimate] = useState(''),
    [transfer, setTransfer] = useState(''),
    [scale, setScale] = useState(state.session.scale);
  const [voting, setVoting] = useState(state.session.moderatorVoting);
  useEffect(() => setVoting(state.session.moderatorVoting), [state.session.moderatorVoting]);
  const round = state.round;
  const open = round?.status === 'open';
  return (
    <>
      <div className="round-controls">
        {!state.session.closed &&
          (!round || round.status === 'discarded') &&
          state.session.activeTaskId && (
            <button
              className="primary"
              disabled={disabled}
              onClick={() => void send({ type: 'round.open' })}
            >
              <Play size={17} /> Iniciar votación
            </button>
          )}
        {open && (
          <button
            className="primary"
            disabled={disabled}
            onClick={() => void send({ type: 'round.reveal' })}
          >
            <Eye size={18} /> Revelar cartas
          </button>
        )}
        {round?.status === 'revealed' && (
          <>
            <button
              className="secondary"
              disabled={disabled}
              onClick={() => void send({ type: 'round.repeat' })}
            >
              <RotateCcw size={16} /> Repetir ronda
            </button>
            <form
              className="estimate-form"
              onSubmit={(e) => {
                e.preventDefault();
                void send({ type: 'round.save', choice: estimate });
              }}
            >
              <label>
                Estimación final
                <select
                  required
                  value={estimate}
                  onChange={(e) => setEstimate(e.target.value)}
                  disabled={disabled}
                >
                  <option value="">Elegir carta</option>
                  {round.scale.cards.map((c) => (
                    <option key={c.label}>{c.label}</option>
                  ))}
                </select>
              </label>
              <button
                className="primary"
                disabled={disabled || !round.scale.cards.some((c) => c.label === estimate)}
              >
                <Check size={16} /> Guardar estimación
              </button>
            </form>
          </>
        )}
        {round?.status === 'finalized' && (
          <>
            <button
              className="primary"
              disabled={disabled}
              onClick={() => void send({ type: 'task.next' })}
            >
              Siguiente tarea
              <ArrowRight size={17} />
            </button>
            <button
              className="text-button"
              disabled={disabled}
              onClick={() => void send({ type: 'round.open' })}
            >
              Volver a votar
            </button>
          </>
        )}
        {(open || round?.status === 'revealed') && (
          <button
            className="text-button discard"
            disabled={disabled}
            onClick={() => {
              if (confirm('¿Descartar esta ronda y sus votos?'))
                void send({ type: 'round.discard' });
            }}
          >
            <X size={14} /> Descartar ronda
          </button>
        )}
      </div>
      <details className="session-settings">
        <summary>Opciones del moderador</summary>
        <div className="settings-grid">
          <div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={voting}
                disabled={disabled || open}
                onChange={(e) => {
                  const next = e.target.checked;
                  setVoting(next);
                  void send({ type: 'moderator.mode', voting: next }).then((ok) => {
                    if (!ok) setVoting(state.session.moderatorVoting);
                  });
                }}
              />{' '}
              También quiero votar
            </label>
            <p className="quiet small">El modo se fija al comenzar cada ronda.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (confirm('¿Transferir la moderación a esta persona?'))
                  void send({ type: 'moderator.transfer', participantId: transfer });
              }}
            >
              <label>
                Transferir moderación
                <select
                  value={transfer}
                  onChange={(e) => setTransfer(e.target.value)}
                  disabled={disabled}
                >
                  <option value="">Elegir participante</option>
                  {state.participants
                    .filter((p) => p.id !== state.selfId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <button className="secondary" disabled={disabled || !transfer}>
                Transferir rol
              </button>
            </form>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send({ type: 'scale.set', scale });
            }}
          >
            <ScaleEditor value={scale} onChange={setScale} disabled={disabled || open} />
            <button className="secondary" disabled={disabled || open}>
              Guardar escala
            </button>
          </form>
        </div>
        <button
          className="text-button danger"
          disabled={disabled || open}
          onClick={() => {
            if (
              confirm(
                '¿Cerrar la sesión? Podrán consultar los resultados, pero ya no se podrá votar.',
              )
            )
              void send({ type: 'session.close' });
          }}
        >
          Cerrar sesión
        </button>
      </details>
    </>
  );
}
