import { useState, type FormEvent } from 'react';
import { Plus, X, Pencil, Trash2, ChevronUp, ChevronDown, Check, ArrowUpRight } from 'lucide-react';
import type { CommandInput, SessionSnapshot, Task } from '@poker/shared';
export function TaskList({
  state,
  disabled,
  send,
  onClose,
}: {
  state: SessionSnapshot;
  disabled: boolean;
  send: (c: CommandInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const mod = state.selfId === state.session.moderatorId && !state.session.closed;
  const [editing, setEditing] = useState<Task | 'new' | null>(null),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState('');
  const done = state.tasks.filter((t) => t.estimate !== null).length;
  function edit(task: Task | 'new') {
    setEditing(task);
    setTitle(task === 'new' ? '' : task.title);
    setDescription(task === 'new' ? '' : task.description);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (
      await send(
        editing === 'new'
          ? { type: 'task.add', title, description }
          : { type: 'task.edit', taskId: (editing as Task).id, title, description },
      )
    )
      setEditing(null);
  }
  async function select(task: Task) {
    if (state.round?.status === 'open' && task.id !== state.session.activeTaskId) {
      if (!confirm('¿Descartar la votación actual para seleccionar otra tarea?')) return;
      if (!(await send({ type: 'round.discard' }))) return;
    }
    await send({ type: 'task.select', taskId: task.id });
    onClose();
  }
  function move(index: number, direction: number) {
    const ids = state.tasks.map((t) => t.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    void send({ type: 'task.reorder', taskIds: ids });
  }
  return (
    <>
      <div className="task-sidebar-heading">
        <div>
          <h2>Tareas</h2>
          <p>
            {done} de {state.tasks.length} estimadas
          </p>
        </div>
        <button className="icon-button mobile-only" onClick={onClose} aria-label="Cerrar tareas">
          <X size={20} />
        </button>
      </div>
      {mod && (
        <button className="secondary wide add-task" disabled={disabled} onClick={() => edit('new')}>
          <Plus size={18} /> Agregar tarea
        </button>
      )}
      {editing && (
        <form className="task-form" onSubmit={save}>
          <div className="form-heading">
            <h3>{editing === 'new' ? 'Nueva tarea' : 'Editar tarea'}</h3>
            <button
              type="button"
              className="icon-button"
              onClick={() => setEditing(null)}
              aria-label="Cancelar edición"
            >
              <X size={17} />
            </button>
          </div>
          <label>
            Título de la tarea
            <input
              autoFocus
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Descripción
            <textarea
              maxLength={5000}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button className="primary wide" disabled={disabled || !title.trim()}>
            Guardar tarea
          </button>
        </form>
      )}
      <ol className="task-list">
        {state.tasks.map((t, i) => (
          <li
            className={`task-row ${t.id === state.session.activeTaskId ? 'active' : ''}`}
            key={t.id}
          >
            <button
              className="task-select"
              aria-label={`Seleccionar ${t.title}`}
              disabled={!mod || disabled}
              onClick={() => void select(t)}
            >
              <span className={`task-status ${t.estimate !== null ? 'done' : ''}`}>
                {t.estimate !== null ? (
                  <Check size={13} />
                ) : t.id === state.session.activeTaskId ? (
                  <span />
                ) : null}
              </span>
              <span className="task-title">{t.title}</span>
              {t.estimate !== null ? (
                <span className="estimate-badge">{t.estimate}</span>
              ) : t.id === state.session.activeTaskId ? (
                <ArrowUpRight size={16} />
              ) : null}
            </button>
            {mod && (
              <div className="task-actions">
                <button
                  className="icon-button"
                  disabled={disabled || i === 0}
                  aria-label={`Subir ${t.title}`}
                  onClick={() => move(i, -1)}
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  className="icon-button"
                  disabled={disabled || i === state.tasks.length - 1}
                  aria-label={`Bajar ${t.title}`}
                  onClick={() => move(i, 1)}
                >
                  <ChevronDown size={15} />
                </button>
                <button
                  className="icon-button"
                  disabled={disabled}
                  aria-label={`Editar ${t.title}`}
                  onClick={() => edit(t)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="icon-button danger"
                  disabled={
                    disabled ||
                    (state.round?.status === 'open' && state.session.activeTaskId === t.id)
                  }
                  aria-label={`Eliminar ${t.title}`}
                  onClick={() => {
                    if (confirm(`¿Eliminar «${t.title}» y sus resultados?`))
                      void send({ type: 'task.delete', taskId: t.id });
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {!state.tasks.length && (
        <div className="tasks-empty">
          <span className="empty-task-art">
            <Plus size={24} />
          </span>
          <h3>Todo empieza con una tarea</h3>
          <p>
            {mod
              ? 'Agrega lo que el equipo va a estimar.'
              : 'El moderador agregará las tareas del equipo.'}
          </p>
        </div>
      )}
      <div className="sidebar-foot">
        <span className="tiny-leaf" />
        Un paso a la vez, juntos.
      </div>
    </>
  );
}
