import { CheckCircle2 } from 'lucide-react';
import type { Round } from '@poker/shared';
const number = (n: number) =>
  new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(n);
export function Results({ round, missing }: { round: Round; missing: number }) {
  const stats = round.statistics;
  if (!stats) return null;
  return (
    <section className="results" aria-label="Resultados de la ronda">
      <div className="result-heading">
        <h3>Así lo ve el equipo</h3>
        {stats.consensus && (
          <span className="consensus">
            <CheckCircle2 size={15} /> Votos estimables en consenso
          </span>
        )}
      </div>
      <div className="result-summary">
        {stats.average !== undefined ? (
          <>
            <div>
              <span>Promedio</span>
              <strong data-testid="average">{number(stats.average)}</strong>
            </div>
            <div>
              <span>Mediana</span>
              <strong>{number(stats.median!)}</strong>
            </div>
          </>
        ) : (
          <div>
            <span>{stats.ordinary ? 'Más votadas' : 'Resultado'}</span>
            <strong>{stats.ordinary ? stats.modes.join(', ') : 'Sin votos estimables'}</strong>
          </div>
        )}
        <p>
          {stats.ordinary} estimables · {stats.special} especiales · {missing} sin votar
        </p>
      </div>
      <div className="distribution">
        {Object.entries(stats.distribution).map(([choice, count]) => (
          <div className="distribution-item" key={choice}>
            <span>
              {choice}{' '}
              <small>
                {count} {count === 1 ? 'voto' : 'votos'}
              </small>
            </span>
            <div className="bar-track">
              <div style={{ width: `${(count / (stats.ordinary + stats.special)) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
