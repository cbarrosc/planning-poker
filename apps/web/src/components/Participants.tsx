import { Check, Coffee, Leaf, Crown } from 'lucide-react';
import type { SessionSnapshot } from '@poker/shared';
export function Participants({ state }: { state: SessionSnapshot }) {
  const revealed = state.round?.status === 'revealed' || state.round?.status === 'finalized';
  return (
    <div className="team-table">
      <div className="participants">
        {state.participants.map((p, i) => (
          <div className="participant" key={p.id}>
            <div className={`avatar tone-${i % 5}`} aria-hidden="true">
              {p.name.slice(0, 2).toUpperCase()}
              <span className={`presence ${p.online ? 'online' : ''}`} />
            </div>
            <span className="participant-name" title={p.name}>
              {p.name}
              {p.id === state.selfId && <small> (tú)</small>}
            </span>
            <span className="participant-role">
              {p.id === state.session.moderatorId ? (
                <>
                  <Crown size={12} /> Moderador
                </>
              ) : p.online ? (
                'En la mesa'
              ) : (
                'Desconectado'
              )}
            </span>
            <div
              className={`participant-card ${p.hasVoted ? 'has-vote' : ''} ${
                revealed ? 'revealed' : ''
              } ${!p.eligible ? 'facilitator' : ''}`}
              aria-label={
                !p.eligible
                  ? 'Solo facilita'
                  : revealed
                  ? p.vote ?? 'Sin voto'
                  : p.hasVoted
                  ? 'Voto oculto'
                  : 'Sin votar'
              }
            >
              {!p.eligible ? (
                <Leaf size={22} />
              ) : revealed ? (
                p.vote === '☕' ? (
                  <Coffee size={25} />
                ) : (
                  p.vote ?? <span className="no-vote">Sin voto</span>
                )
              ) : p.hasVoted ? (
                <Leaf size={26} />
              ) : (
                <span className="no-vote">Sin votar</span>
              )}
            </div>
            {p.hasVoted && !revealed && (
              <span className="voted-mark">
                <Check size={12} /> Listo
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
