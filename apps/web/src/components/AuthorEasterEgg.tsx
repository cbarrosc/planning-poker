import { useEffect, useRef } from 'react';
import { Leaf, X } from 'lucide-react';
import { APP_VERSION, AUTHORS } from '../appInfo';

const konami = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

export function AuthorEasterEgg() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let keys: string[] = [];
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.defaultPrevented ||
        dialog.current?.open ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]')))
      ) {
        keys = [];
        return;
      }
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      keys = [...keys, key].slice(-konami.length);
      if (keys.length === konami.length && keys.every((value, index) => value === konami[index])) {
        keys = [];
        dialog.current?.showModal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <dialog
      className="authors-dialog"
      ref={dialog}
      aria-labelledby="authors-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            dialog.current?.close();
        }
      }}
    >
      <button
        className="icon-button authors-close"
        aria-label="Cerrar información de autores"
        onClick={() => dialog.current?.close()}
      >
        <X size={18} />
      </button>
      <div className="authors-leaf" aria-hidden="true">
        <Leaf size={44} strokeWidth={1.6} />
      </div>
      <h2 id="authors-title">Detrás de la mesa.</h2>
      <p className="authors-intro">Dos personas. Una hoja. Muchas buenas conversaciones.</p>
      <p className="authors-names">{AUTHORS.join(' - ')}</p>
      <p className="authors-version">
        Planning Poker <span aria-hidden="true">·</span> v{APP_VERSION}
      </p>
      <button className="primary authors-return" autoFocus onClick={() => dialog.current?.close()}>
        Volver a la mesa
      </button>
      <p className="authors-secret">Encontraste nuestro pequeño secreto. ☕</p>
    </dialog>
  );
}
