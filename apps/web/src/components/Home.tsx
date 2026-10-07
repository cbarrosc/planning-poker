import { newRequestId } from '../requestId';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Users, Check, LockKeyhole, Coffee, Leaf } from 'lucide-react';
import { FIBONACCI, type Scale, type SessionSnapshot } from '@poker/shared';
import { api } from '../api';
import { Brand } from './Brand';
import { ScaleEditor } from './ScaleEditor';
export function Home({
  code = '',
  onJoined,
}: {
  code?: string;
  onJoined?: (s: SessionSnapshot) => void;
}) {
  const [tab, setTab] = useState<'create' | 'join'>(code ? 'join' : 'create');
  const [name, setName] = useState(''),
    [title, setTitle] = useState(''),
    [joinCode, setJoinCode] = useState(code),
    [scale, setScale] = useState<Scale>(FIBONACCI),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const creation = useRef<{ key: string; requestId: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const normalized = joinCode.includes('/')
        ? new URL(joinCode).pathname.split('/').filter(Boolean).at(-1)!
        : joinCode.trim().toUpperCase();
      const key = JSON.stringify({ name: title, participantName: name, scale });
      if (creation.current?.key !== key) creation.current = { key, requestId: newRequestId() };
      const snapshot =
        tab === 'create'
          ? await api.create({
              name: title,
              participantName: name,
              scale,
              requestId: creation.current.requestId,
            })
          : await api.join(normalized, name);
      if (onJoined && code === snapshot.session.code) onJoined(snapshot);
      else location.assign(`/s/${snapshot.session.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revisa tus datos e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="home">
      <header className="home-header">
        <Brand />
        <span className="quiet">Un equipo. Muchas perspectivas.</span>
      </header>
      <main className="home-layout">
        <section className="welcome">
          <h1>
            Las mejores estimaciones
            <br />
            se hacen <em>en equipo.</em>
          </h1>
          <p>
            Pon las cartas sobre la mesa. Comparte perspectivas y encuentra el siguiente paso,
            juntos.
          </p>
          <div className="welcome-table" aria-hidden="true">
            <div className="demo-avatar a1">A</div>
            <div className="demo-avatar a2">L</div>
            <div className="demo-avatar a3">D</div>
            <div className="demo-card demo-one">3</div>
            <div className="demo-card demo-two">
              5<Leaf size={22} />
            </div>
            <div className="demo-card demo-three">8</div>
            <span className="table-note">
              <Check size={16} /> Cada voz cuenta
            </span>
          </div>
          <div className="home-benefits">
            <span>
              <Users size={17} /> En tiempo real
            </span>
            <span>
              <LockKeyhole size={17} /> Votos privados
            </span>
            <span>
              <Coffee size={17} /> Con pausas para café
            </span>
          </div>
        </section>
        <section className="entry-panel">
          <h2>{code ? 'Tu equipo te espera' : 'Hagamos espacio para tu equipo'}</h2>
          <p className="quiet">Solo necesitas tu nombre para empezar.</p>
          {!code && (
            <div className="tabs" role="tablist" aria-label="Acceso a sesiones">
              <button
                role="tab"
                aria-selected={tab === 'create'}
                onClick={() => {
                  setTab('create');
                  setError('');
                }}
              >
                Crear sesión
              </button>
              <button
                role="tab"
                aria-selected={tab === 'join'}
                onClick={() => {
                  setTab('join');
                  setError('');
                }}
              >
                Unirse a sesión
              </button>
            </div>
          )}
          <form onSubmit={submit}>
            <label>
              Tu nombre
              <input
                autoComplete="nickname"
                placeholder="¿Cómo te llamas?"
                maxLength={60}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {tab === 'create' ? (
              <>
                <label>
                  Nombre de la sesión
                  <input
                    placeholder="Por ejemplo, Sprint del equipo"
                    maxLength={100}
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <ScaleEditor value={scale} onChange={setScale} />
              </>
            ) : (
              <label>
                Código o enlace de la sesión
                <input
                  placeholder="Pega el enlace o escribe el código"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary wide"
              disabled={busy || !name.trim() || (tab === 'create' && !title.trim())}
              type="submit"
            >
              {busy
                ? 'Preparando tu lugar…'
                : tab === 'create'
                ? 'Crear sesión'
                : 'Unirme a la sesión'}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="entry-note">Sin cuentas, sin vueltas. Comparte el enlace y listo.</p>
        </section>
      </main>
      <footer className="home-footer">Menos adivinar. Más conversar.</footer>
    </div>
  );
}
